import type { IncomingMessage, ServerResponse } from 'node:http'
import { configuration, AccountError } from './account.ts'
type Row = Record<string, any>
const resources:Record<string,string>={
 clients:'id,user_id,name,enabled,created_at,key_prefix',
 subscriptions:'id,user_id,plan_code,amount_cents,api_enabled,models,paid_until,provider_status,created_at,entitled,billing_mode',
 keys:'subscription_id,user_id,gateway_client_id,token_prefix,paid_until,revoked_at,api_enabled,created_at,entitled',
 trials:'user_id,gateway_client_id,token_prefix,created_at,expires_at,revoked_at',
 usage:'id,client_id,requested_alias,status_code,input_tokens,output_tokens,latency_ms,created_at',
 payments:'id,subscription_id,status,amount_cents,currency,approved_at,period_start,period_end,recorded_at',
}
const tables:Record<string,string>={clients:'gateway_clients',subscriptions:'billing_subscription_state',keys:'billing_key_access',trials:'gateway_trials',usage:'gateway_usage',payments:'billing_payments'}
export function createAdminService(env=process.env,request:typeof fetch=fetch){
 return async (authorization:string|undefined,query:URLSearchParams)=>{
  if(!authorization?.startsWith('Bearer ')||authorization.length>16000)throw new AccountError(401,'Entre na sua conta para acessar a administração.')
  const config=configuration(env)
  const identity=await request(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)})
  if(!identity.ok)throw new AccountError(401,'Entre novamente para continuar.')
  const user=await identity.json() as Row
  const allowed=(env.SIXTYSIX_ADMIN_EMAILS||'alisongeneral25@gmail.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
  if(!user.id||user.is_anonymous||!user.email_confirmed_at||!allowed.includes(String(user.email||'').toLowerCase()))throw new AccountError(403,'Esta área é exclusiva da administração.')
  const resource=query.get('resource')||'clients',offset=Number(query.get('offset')||0)
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||(!resources[resource]&&resource!=='users'))throw new AccountError(400,'Consulta inválida.')
  const headers={apikey:config.secret,...(!config.secret.startsWith('sb_secret_')?{Authorization:`Bearer ${config.secret}`}:{})}
  let url:string
  if(resource==='users')url=`${config.url}/auth/v1/admin/users?page=${Math.floor(offset/500)+1}&per_page=500`
  else{
   const params=new URLSearchParams({select:resources[resource],limit:'500',offset:String(offset),order:resource==='usage'?'created_at.desc,id.desc':resource==='payments'?'recorded_at.desc,id.desc':resource==='keys'?'created_at.desc,subscription_id':'created_at.desc,id.desc'})
   if(['usage','payments'].includes(resource)){
    const from=query.get('from')||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=query.get('to')||new Date().toISOString().slice(0,10)
    if(![from,to].every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw new AccountError(400,'Escolha um período de até 366 dias.')
    const field=resource==='usage'?'created_at':'recorded_at'
    params.set('and',`(${field}.gte.${from}T00:00:00Z,${field}.lt.${new Date(Date.parse(to)+86400000).toISOString()})`)
   }
   url=`${config.url}/rest/v1/${tables[resource]}?${params}`
  }
  const response=await request(url,{headers,signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new AccountError(503,'Não foi possível carregar '+resource+'. Tente atualizar o painel.')
  const data=await response.json()
  const rows:Row[]=resource==='users'?(data.users||[]).map((u:Row)=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,email_confirmed_at:u.email_confirmed_at,name:u.user_metadata?.custom_name||u.user_metadata?.preferred_name||u.user_metadata?.full_name||u.user_metadata?.name||'',provider:u.app_metadata?.provider||''})):data
  return {rows,hasMore:rows.length===500,admin:user.email}
 }
}
export default async function handler(req:IncomingMessage,res:ServerResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff')
 try{
  if(req.method!=='GET')throw new AccountError(405,'Operação não disponível.')
  const result=await createAdminService()(req.headers.authorization,new URL(req.url||'/', 'http://localhost').searchParams)
  res.statusCode=200;res.end(JSON.stringify(result))
 }catch(error){res.statusCode=error instanceof AccountError?error.status:503;res.end(JSON.stringify({error:error instanceof AccountError?error.message:'Administração temporariamente indisponível.'}))}
}


