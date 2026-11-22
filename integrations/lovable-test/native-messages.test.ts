import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createNativeBridge,nativeBody,NATIVE_BODY_LIMIT} from './native-messages.server.ts'
const now=Date.now()
const config={bridgeKey:'test-bridge-key-with-at-least-32-characters',lovableKey:'simulated-upstream-secret',expiresAt:new Date(now+1800000).toISOString()}
const payload={model:'anthropic/claude-opus-5-5',system:[{type:'text',text:'Sistema real'}],messages:[{role:'user',content:'Olá'},{role:'assistant',content:[{type:'tool_use',id:'call_1',name:'Read',input:{path:'a.ts'}}]},{role:'user',content:[{type:'tool_result',tool_use_id:'call_1',content:'arquivo'}]}],tools:[{name:'Read',description:'Ler',input_schema:{type:'object',properties:{path:{type:'string'}}}}],max_tokens:32000,stream:true}
const request=(body:any=payload,key=config.bridgeKey)=>new Request('https://own.test/messages',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)})
test('preserva sistema, histórico, ferramentas e streaming; limita saída',()=>{
 const actual=nativeBody({...payload,thinking:{type:'adaptive'},output_config:{effort:'high'}})
 assert.deepEqual(actual.messages,payload.messages);assert.deepEqual(actual.tools,payload.tools);assert.deepEqual(actual.system,payload.system)
 assert.equal(actual.max_tokens,1024);assert.equal(actual.stream,true);assert.equal(actual.thinking,undefined)
})
test('rejeita modelo diferente e limites inválidos',()=>{for(const change of [{model:'other'},{max_tokens:0},{max_tokens:1.5},{stream:'yes'},{messages:[]},{tools:{}}])assert.throws(()=>nativeBody({...payload,...change}))})
test('autenticação e expiração impedem chamadas externas',async()=>{
 let calls=0;const handle=createNativeBridge(async()=>{calls++;throw Error('unexpected')},()=>now)
 assert.equal((await handle(request(payload,'wrong'),config)).status,401)
 assert.equal((await handle(request(),{...config,expiresAt:new Date(now-1).toISOString()})).status,503)
 assert.equal(calls,0)
})
test('aceita contexto maior que antigo teto e encaminha SSE sem fabricar resposta',async()=>{
 const event='event: content_block_delta\ndata: {"delta":{"type":"text_delta","text":"Resposta real"}}\n\n'
 let forwarded:any
 const handle=createNativeBridge(async(url,init)=>{assert.equal(String(url),'https://ai.gateway.lovable.dev/v1/messages');forwarded=JSON.parse(String(init?.body));return new Response(event,{headers:{'Content-Type':'text/event-stream'}})},()=>now)
 const large={...payload,system:'s'.repeat(300000)}
 const response=await handle(request(large),config)
 assert.equal(response.status,200);assert.equal(await response.text(),event);assert.equal(forwarded.system[0].text.length,300000);assert.deepEqual(forwarded.tools,payload.tools)
})
test('recusa corpo acima de quatro MiB sem usar gateway',async()=>{
 let calls=0;const handle=createNativeBridge(async()=>{calls++;throw Error('unexpected')},()=>now)
 assert.equal((await handle(request({...payload,system:'x'.repeat(NATIVE_BODY_LIMIT)}),config)).status,413);assert.equal(calls,0)
})
test('reserva três tentativas e não repete falhas',async()=>{
 let calls=0;const handle=createNativeBridge(async()=>{calls++;return new Response('internal detail',{status:500})},()=>now)
 for(let i=0;i<3;i++){const r=await handle(request(),config);assert.equal(r.status,502);assert.ok(!(await r.text()).includes('internal detail'))}
 assert.equal((await handle(request(),config)).status,429);assert.equal(calls,3)
})

test('normaliza system dentro de messages sem perder instruções ou ferramentas',()=>{
 const value={...payload,messages:[{role:'user',content:'Olá'},{role:'system',content:'Contexto do Desktop'}]}
 const actual=nativeBody(value)
 assert.deepEqual(actual.messages,[{role:'user',content:'Olá'}])
 assert.deepEqual(actual.system,[...payload.system,{type:'text',text:'Contexto do Desktop'}])
 assert.deepEqual(actual.tools,payload.tools)
 assert.throws(()=>nativeBody({...payload,messages:[{role:'developer',content:'x'}]}))
})
