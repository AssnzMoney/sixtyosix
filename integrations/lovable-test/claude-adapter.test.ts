import {test} from 'node:test'
import assert from 'node:assert/strict'
import {bridgeBody,anthropicReply,OPUS,PROMPT} from './claude-adapter.ts'
test('aceita texto do CLI e descarta campos de controle sem ampliar o prompt',()=>{
 assert.deepEqual(bridgeBody({model:OPUS,system:'instruções locais',stream:true,max_tokens:32000,messages:[{role:'user',content:[{type:'text',text:PROMPT}]}]}),{model:OPUS,messages:[{role:'user',content:PROMPT}],max_tokens:64,stream:false})
 for(const body of [{model:OPUS,messages:[{role:'user',content:'x'.repeat(2001)}]},{model:OPUS,tools:[{name:'Bash'}],messages:[{role:'user',content:PROMPT}]}]) assert.throws(()=>bridgeBody(body))
})
test('SSE contém texto real, eventos finais e contagem, sem inventar resposta',async()=>{
 const response=await anthropicReply(Response.json({choices:[{message:{content:'Texto real'},finish_reason:'length'}],usage:{prompt_tokens:16,completion_tokens:4}}),true)
 const sse=await response.text()
 assert.ok(sse.includes('Texto real') && sse.includes('max_tokens') && sse.includes('event: message_stop'))
 assert.ok(!sse.includes('"text":"OK"'))
})
test('preserva falha e texto vazio',async()=>{
 assert.equal((await anthropicReply(new Response('erro',{status:409}),true)).status,409)
 const r=await anthropicReply(Response.json({choices:[{message:{content:''},finish_reason:'stop'}]}),false)
 assert.equal((await r.json()).content[0].text,'')
})

test('encaminha o texto real do Desktop sem substituir por OK',()=>{assert.equal(bridgeBody({model:OPUS,messages:[{role:'user',content:'Responda uma saudação curta'}]}).messages[0].content,'Responda uma saudação curta')})
