/** Usa o handler REAL da Six, com banco e configurações isolados em memória. */
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import accessHandler from '../../api/access.ts'
import { clearRouterCache, sealSecret } from '../../server/router.ts'
const probe = process.argv.includes('--probe')
const bridgeKey = probe ? 'probe-without-valid-bridge-credential' : process.env.SIX_TEST_BRIDGE_KEY
if (!bridgeKey || bridgeKey.length < 32) throw Error('Configure SIX_TEST_BRIDGE_KEY no ambiente local; não passe como argumento.')
const db = 'https://six-local-test.invalid'
const dbSecret = 'sb_secret_' + randomBytes(24).toString('hex')
const clientKey = 'sk-rt-' + randomBytes(24).toString('hex')
const providerId = '33333333-3333-4333-8333-333333333333'
const clientId = '44444444-4444-4444-8444-444444444444'
const alias = 'six-opus-test'
const bridge = 'https://hidden-key-checker.lovable.app/api/public/six-test/v1'
const realFetch = globalThis.fetch
const saved = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }
process.env.SUPABASE_URL = db
process.env.SUPABASE_SERVICE_ROLE_KEY = dbSecret
const usage: unknown[] = []
let externalCalls = 0, bridgeStatus: number | undefined
clearRouterCache()
globalThis.fetch = (async (input, init = {}) => {
 const url = String(input)
 if (url.startsWith(db + '/rest/v1/router_models?')) return Response.json([{alias,label:'Opus teste local',upstream_model:'anthropic/claude-opus-5-5',in_pro:false,provider:{id:providerId,name:'Lovable local test',base_url:bridge,encrypted_key:sealSecret(bridgeKey,dbSecret,'router:provider:'+providerId),enabled:true}}])
 if (url.startsWith(db + '/rest/v1/router_keys?')) {
  const hash=createHash('sha256').update(clientKey).digest('hex')
  return Response.json(url.includes(hash) ? [{gateway_client_id:clientId,models:[alias],expires_at:new Date(Date.now()+300000).toISOString(),revoked_at:null}] : [])
 }
 if (url.startsWith(db + '/rest/v1/gateway_usage')) {usage.push(JSON.parse(String(init.body)));return new Response(null,{status:201})}
 if (url === db + '/rest/v1/rpc/gateway_gate') return Response.json({ok:true,leased:true})
 if (url.startsWith(db + '/rest/v1/rpc/gateway_')) return new Response(null,{status:204})
 if (url === bridge + '/chat/completions' && init.method === 'POST') {
  if (externalCalls >= 1) throw Error('Teste local permite uma única chamada externa, sem retries.')
  externalCalls++
  // No modo probe, corpo inválido garante recusa antes do fetch de IA mesmo se a ponte estiver ativa.
  const response=await realFetch(url,{...init,...(probe?{body:'{}',headers:{'Content-Type':'application/json'}}:{}),redirect:'manual',signal:AbortSignal.timeout(35000)})
  bridgeStatus=response.status
  return response
 }
 throw Error('Destino bloqueado pelo isolamento do teste local.')
}) as typeof fetch
const server=createServer(accessHandler)
try {
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 const port=(server.address() as {port:number}).port
 const response=await realFetch('http://127.0.0.1:'+port+'/api/access?action=proxy&path=/v1/chat/completions',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+clientKey},
  body:JSON.stringify({model:alias,messages:[{role:'user',content:'Responda apenas OK'}],max_tokens:16,stream:false}),signal:AbortSignal.timeout(45000)
 })
 const result=await response.json() as any
 console.log(JSON.stringify({mode:probe?'probe-sem-IA':'teste-real',localAddress:'127.0.0.1',sixStatus:response.status,bridgeStatus,externalCalls,answer:result?.choices?.[0]?.message?.content,finishReason:result?.choices?.[0]?.finish_reason,usage:result?.usage,error:result?.error,usageRecords:usage.length},null,2))
 if(probe && ![400,401,503].includes(bridgeStatus||0)) process.exitCode=1
 if(!probe && (response.status!==200 || !result?.choices?.[0]?.message?.content || result?.choices?.[0]?.finish_reason!=='stop')) process.exitCode=1
} finally {
 server.closeAllConnections()
 await new Promise<void>(resolve=>server.close(()=>resolve()))
 globalThis.fetch=realFetch
 for(const [key,value] of Object.entries(saved)) if(value===undefined) delete process.env[key]; else process.env[key]=value
 clearRouterCache()
}
