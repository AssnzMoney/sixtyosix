import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizeWhatsapp } from '../src/lib/whatsapp.js'
import { credentialTitle, isUuid, validateDeliveryInput } from '../src/lib/deliveries.js'
import { emailConfig } from '../server/email.js'
import { createNotifier, userFromAuth, type NotifyResult } from '../server/notifications.js'
import { createRouterAdmin, RouterError } from '../server/router.js'
class AccountError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status} }
function configuration(env:NodeJS.ProcessEnv){
 const url=env.SUPABASE_URL?.replace(/\/+$/,''),secret=env.SUPABASE_SERVICE_ROLE_KEY,publicKey=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY
 if(!url?.startsWith('https://')||!secret||!publicKey)throw new AccountError(503,'Administração temporariamente indisponível.')
 return {url,secret,publicKey}
}
export const TRIAL_CUTOFF='2026-11-09T21:10:00.000Z'
type Row = Record<string, any>
const resources:Record<string,string>={
 clients:'id,user_id,name,enabled,created_at,key_prefix',
 subscriptions:'id,user_id,plan_code,amount_cents,api_enabled,models,paid_until,provider_status,created_at,entitled,billing_mode',
 keys:'subscription_id,user_id,gateway_client_id,token_prefix,paid_until,revoked_at,api_enabled,created_at,entitled',
 trials:'user_id,gateway_client_id,token_prefix,created_at,expires_at,revoked_at',
 usage:'id,client_id,requested_alias,status_code,input_tokens,output_tokens,latency_ms,created_at',
 payments:'id,subscription_id,status,amount_cents,currency,approved_at,period_start,period_end,recorded_at',
 deliveries:'id,user_id,subscription_id,product,supplier,key_hint,base_url,model_id,notes,expires_at,delivered_at,created_by,replaced_at,revoked_at,revoked_by,confirmed_at,confirm_ip,confirm_user_agent,confirm_text,confirm_text_version',
}
const tables:Record<string,string>={clients:'gateway_clients',subscriptions:'billing_subscription_state',keys:'billing_key_access',trials:'gateway_trials',usage:'gateway_usage',payments:'billing_payments',deliveries:'credential_deliveries'}
const orders:Record<string,string>={usage:'created_at.desc,id.desc',payments:'recorded_at.desc,id.desc',keys:'created_at.desc,subscription_id',trials:'created_at.desc,user_id',deliveries:'delivered_at.desc,id'}
const serviceHeaders=(secret:string)=>({apikey:secret,...(!secret.startsWith('sb_secret_')?{Authorization:`Bearer ${secret}`}:{})})

/** Valida a sessão e exige um e-mail confirmado da lista de administradores. */
async function requireAdmin(env:NodeJS.ProcessEnv,request:typeof fetch,authorization:string|undefined){
 if(!authorization?.startsWith('Bearer ')||authorization.length>16000)throw new AccountError(401,'Entre na sua conta para acessar a administração.')
 const config=configuration(env)
 const identity=await request(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)})
 if(!identity.ok)throw new AccountError(401,'Entre novamente para continuar.')
 const user=await identity.json() as Row
 const allowed=(env.SIXTYSIX_ADMIN_EMAILS||'alissonmedeiroz007@gmail.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
 if(!user.id||user.is_anonymous||!user.email_confirmed_at||!allowed.includes(String(user.email||'').toLowerCase()))throw new AccountError(403,'Esta área é exclusiva da administração.')
 return {config,email:String(user.email).toLowerCase()}
}

export function createAdminService(env=process.env,request:typeof fetch=fetch){
 return async (authorization:string|undefined,query:URLSearchParams)=>{
  const {config,email}=await requireAdmin(env,request,authorization)
  const resource=query.get('resource')||'clients',offset=Number(query.get('offset')||0)
  if(!Number.isSafeInteger(offset)||offset<0||offset>1000000||(!resources[resource]&&resource!=='users'&&resource!=='router'))throw new AccountError(400,'Consulta inválida.')
  // Aba Roteador: provedores (sem a key), modelos vendidos e chaves manuais.
  if(resource==='router'){try{return {...await createRouterAdmin(config,request,email).overview(),rows:[] as Row[],hasMore:false,admin:email}}catch(error){if(error instanceof RouterError)throw new AccountError(error.status,error.message);throw error}}
  const headers=serviceHeaders(config.secret)
  let url:string
  if(resource==='users')url=`${config.url}/auth/v1/admin/users?page=${Math.floor(offset/500)+1}&per_page=500`
  else{
   const params=new URLSearchParams({select:resources[resource],limit:'500',offset:String(offset),order:orders[resource]||'created_at.desc,id.desc'})
   if(resource==='trials'&&query.get('history')!=='1')params.set('created_at','gte.'+TRIAL_CUTOFF)
   if(['usage','payments'].includes(resource)){
    const from=query.get('from')||new Date(Date.now()-29*86400000).toISOString().slice(0,10),to=query.get('to')||new Date().toISOString().slice(0,10)
    if(![from,to].every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x)||from>to||Date.parse(to)-Date.parse(from)>365*86400000)throw new AccountError(400,'Escolha um período de até 366 dias.')
    const field=resource==='usage'?'created_at':'recorded_at'
    params.set('and',`(${field}.gte.${from}T00:00:00Z,${field}.lt.${new Date(Date.parse(to)+86400000).toISOString()})`)
   }
   url=`${config.url}/rest/v1/${tables[resource]}?${params}`
  }
  const response=await request(url,{headers,signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new AccountError(503,resource==='deliveries'?'Credenciais indisponíveis: aplique a migração supabase/whatsapp-delivery.sql.':'Não foi possível carregar '+resource+'. Tente atualizar o painel.')
  const data=await response.json()
  const rows:Row[]=resource==='users'?(data.users||[]).map((u:Row)=>({id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,email_confirmed_at:u.email_confirmed_at,name:u.user_metadata?.custom_name||u.user_metadata?.preferred_name||u.user_metadata?.full_name||u.user_metadata?.name||'',whatsapp:normalizeWhatsapp(u.user_metadata?.whatsapp)||'',provider:u.app_metadata?.provider||''})):data
  return {rows,hasMore:rows.length===500,admin:email}
 }
}

/** Ações do admin. Sempre exigem `action` explícita — nunca uma ação em massa por acidente. */
export function createAdminActions(env=process.env,request:typeof fetch=fetch){
 return async (authorization:string|undefined,body:Row)=>{
  const {config,email}=await requireAdmin(env,request,authorization)
  const headers={...serviceHeaders(config.secret),'Content-Type':'application/json'}
  const rpc=async<T>(name:string,args:Row):Promise<T>=>{
   const response=await request(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000)})
   if(!response.ok)throw new AccountError(503,name.includes('delivery')?'Não foi possível salvar. Confira se a migração supabase/whatsapp-delivery.sql foi aplicada.':'Operação incompleta. Atualize e tente novamente.')
   return await response.json() as T
  }
  const action=typeof body.action==='string'?body.action:''
  if(action.startsWith('router-')){
   const router=createRouterAdmin(config,request,email)
   const actions:Record<string,(input:Row)=>Promise<unknown>>={
    'router-provider-save':router.saveProvider,'router-provider-enabled':router.setProviderEnabled,'router-provider-delete':router.deleteProvider,
    'router-provider-models':router.providerModels,'router-models-save':router.saveModels,
    'router-key-create':router.createKey,'router-key-renew':router.renewKey,'router-key-block':router.setKeyBlocked,'router-key-reveal':router.revealKey,
   }
   if(!actions[action])throw new AccountError(400,'Ação inválida.')
   try{return await actions[action](body)}catch(error){if(error instanceof RouterError)throw new AccountError(error.status,error.message);throw error}
  }
  if(action==='revoke-old-trials'){
   const query=new URLSearchParams({resource:'trials',history:'1'}),read=createAdminService(env,request);let count=0
   for(let offset=0;offset<=1000000;offset+=500){query.set('offset',String(offset));const page=await read(authorization,query);for(const trial of page.rows){if(Date.parse(trial.created_at)>=Date.parse(TRIAL_CUTOFF)||trial.revoked_at)continue;if(await rpc<boolean>('account_revoke_trial',{p_user_id:trial.user_id,p_client_id:trial.gateway_client_id})!==true)throw new AccountError(503,'Revogação incompleta. Atualize e tente novamente.');count++}if(!page.hasMore)break}
   return {revoked:count,cutoff:TRIAL_CUTOFF}
  }
  if(action==='register-delivery'){
   let input
   try{input=validateDeliveryInput(body.delivery&&typeof body.delivery==='object'?body.delivery:{})}catch(error){throw new AccountError(400,error instanceof Error?error.message:'Entrega inválida.')}
   const id=await rpc<string|null>('admin_register_delivery',{p_id:input.id,p_user_id:input.user_id,p_subscription_id:input.subscription_id,p_product:input.product,p_supplier:input.supplier,p_key_hint:input.key_hint,p_base_url:input.base_url,p_model_id:input.model_id,p_notes:input.notes,p_expires_at:input.expires_at,p_replaces:input.replaces,p_created_by:email})
   if(!id)throw new AccountError(409,'Não foi possível registrar: a credencial a substituir ou a assinatura não pertence a este cliente.')
   // Avisa o cliente por e-mail (sem a chave). Falha no e-mail nunca desfaz a entrega.
   let notice:NotifyResult='skipped'
   const mail=emailConfig(env)
   if(mail)try{
    const found=await request(`${config.url}/auth/v1/admin/users/${input.user_id}`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(10000)})
    if(found.ok)notice=await createNotifier(config,mail,request).delivery(userFromAuth(await found.json()),{id:input.id,title:credentialTitle(input),key_hint:input.key_hint})
   }catch{notice='failed'}
   return {id,email:notice}
  }
  if(action==='revoke-delivery'){
   if(!isUuid(body.id))throw new AccountError(400,'Credencial inválida.')
   const revoked=await rpc<boolean>('admin_revoke_delivery',{p_id:body.id,p_by:email})
   if(!revoked)throw new AccountError(409,'Esta credencial já estava revogada.')
   return {ok:true}
  }
  throw new AccountError(400,'Ação inválida.')
 }
}

async function readBody(req:IncomingMessage&{body?:unknown}):Promise<Row>{
 let body=req.body
 if(body===undefined){
  let text=''
  for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>65536)throw new AccountError(413,'Solicitação muito grande.')}
  try{body=JSON.parse(text||'{}')}catch{throw new AccountError(400,'Solicitação inválida.')}
 }
 if(!body||typeof body!=='object'||Array.isArray(body))throw new AccountError(400,'Solicitação inválida.')
 return body as Row
}

export default async function handler(req:IncomingMessage&{body?:unknown},res:ServerResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff')
 try{
  if(req.method==='POST'){
   const result=await createAdminActions()(req.headers.authorization,await readBody(req))
   res.statusCode=200;res.end(JSON.stringify(result));return
  }
  if(req.method!=='GET')throw new AccountError(405,'Operação não disponível.')
  const result=await createAdminService()(req.headers.authorization,new URL(req.url||'/', 'http://localhost').searchParams)
  res.statusCode=200;res.end(JSON.stringify(result))
 }catch(error){res.statusCode=error instanceof AccountError?error.status:503;res.end(JSON.stringify({error:error instanceof AccountError?error.message:'Administração temporariamente indisponível.'}))}
}
