/** Usa o handler REAL da Six, com banco e configurações isolados em memória. */
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bridgeBody, anthropicReply } from './claude-adapter.ts'
import { createHash, randomBytes } from 'node:crypto'
import accessHandler from '../../api/access.ts'
import { clearRouterCache, sealSecret } from '../../server/router.ts'
const probe = false
const mock = process.argv.includes('--mock')
const bridgeKey = mock ? 'local-simulated-key-1234567890123456' : process.env.SIX_TEST_BRIDGE_KEY
if (!bridgeKey || bridgeKey.length < 32) throw Error('Configure SIX_TEST_BRIDGE_KEY no ambiente local; não passe como argumento.')
const db = 'https://six-local-test.invalid'
const dbSecret = 'sb_secret_' + randomBytes(24).toString('hex')
const clientKey = 'sk-rt-' + randomBytes(24).toString('hex')
const providerId = '33333333-3333-4333-8333-333333333333'
const clientId = '44444444-4444-4444-8444-444444444444'
const alias = 'claude-opus-5-5'
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
 if (url === bridge + '/messages' && init.method === 'POST') {
  const payload=JSON.parse(String(init.body))
  const translated=bridgeBody(payload)
  if(externalCalls>=1)throw Error('Uma tentativa por execução.')
  externalCalls++
  const response=mock ? Response.json({model:'anthropic/claude-opus-5-5',choices:[{message:{content:'SIMULADO_LOCAL'},finish_reason:'stop'}],usage:{prompt_tokens:16,completion_tokens:4,total_tokens:20}})
   : await realFetch(bridge+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bridgeKey},body:JSON.stringify(translated),redirect:'manual',signal:AbortSignal.timeout(35000)})
  bridgeStatus=response.status
  return anthropicReply(response,payload.stream===true)
 }
 throw Error('Destino bloqueado pelo isolamento do teste local.')
}) as typeof fetch
const server=createServer((req,res)=>{ const u=new URL(req.url||'/', 'http://localhost'); if(u.pathname.startsWith('/v1/'))req.url='/api/access?action=proxy&path='+encodeURIComponent(u.pathname); void accessHandler(req,res) })
try {
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
 const port=(server.address() as {port:number}).port
 const sandbox=await mkdtemp(join(tmpdir(),'six-claude-smoke-'))
 try {
  const env={...process.env,ANTHROPIC_BASE_URL:'http://127.0.0.1:'+port,ANTHROPIC_API_KEY:clientKey,ANTHROPIC_MODEL:alias,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'16',MAX_THINKING_TOKENS:'0'}
  for(const key of ['ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','ANTHROPIC_CUSTOM_HEADERS']) delete env[key]
  try {
   const result=await promisify(execFile)('C:/Users/Alysson/AppData/Roaming/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe',[
    '--bare','--print','Responda apenas OK','--model',alias,'--tools','','--system-prompt','Responda somente à mensagem do usuário.','--no-session-persistence','--output-format','json','--setting-sources',''
   ],{cwd:sandbox,env,windowsHide:true,timeout:50000,maxBuffer:1024*1024})
   let data:any
   try {data=JSON.parse(result.stdout)}catch{data={result:result.stdout.trim()}}
   console.log(JSON.stringify({mode:mock?'CLI-SIMULADO-SEM-IA':'CLI-REAL',bridgeStatus,externalCalls,answer:data.result,isError:data.is_error,usage:data.usage,usageRecords:usage.length},null,2))
   if(data.is_error || externalCalls!==1 || (mock?data.result!=='SIMULADO_LOCAL':data.result!=='OK'))process.exitCode=1
  }catch(error:any){console.log(JSON.stringify({mode:mock?'CLI-SIMULADO-SEM-IA':'CLI-REAL',bridgeStatus,externalCalls,output:error.stdout?.slice(0,2000),errorOutput:error.stderr?.slice(0,1200),exitCode:error.code,usageRecords:usage.length},null,2));process.exitCode=1}
 }finally{await rm(sandbox,{recursive:true,force:true})}

} finally {
 server.closeAllConnections()
 await new Promise<void>(resolve=>server.close(()=>resolve()))
 globalThis.fetch=realFetch
 for(const [key,value] of Object.entries(saved)) if(value===undefined) delete process.env[key]; else process.env[key]=value
 clearRouterCache()
}
