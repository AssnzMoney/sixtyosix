import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { formatWhatsapp, normalizeWhatsapp } from '../src/lib/whatsapp.js'
import { credentialTitle, isUuid, validateDeliveryInput } from '../src/lib/deliveries.js'
import { adminCodeEmail, emailConfig, sendEmail } from '../server/email.js'
import { createNotifier, userFromAuth, type NotifyResult } from '../server/notifications.js'
import { canonicalModels, createRouterAdmin, loadRouter, RouterError } from '../server/router.js'
import { withPlanModels } from '../server/model-aliases.js'
import { billingPlans } from './mercadopago.js'
class AccountError extends Error { status:number; code?:string; constructor(status:number,message:string,code?:string){super(message);this.status=status;this.code=code} }

/*
 * Verificação em duas etapas do admin: depois do login normal, um código de 6 dígitos vai para o e-mail
 * do administrador. Com o código certo, o aparelho recebe uma sessão assinada que vale 30 dias.
 * Tudo é assinado com uma chave derivada da SUPABASE_SERVICE_ROLE_KEY: não precisa de tabela nova.
 * Sem envio de e-mail configurado (RESEND_API_KEY), a verificação fica desligada para ninguém ficar trancado.
 */
export const ADMIN_SESSION_DAYS=30
const ADMIN_CODE_MINUTES=10
const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
function adminSigner(secret:string){
 const key=createHmac('sha256','sixtysix-admin-2fa').update(secret).digest()
 const mac=(body:string)=>createHmac('sha256',key).update(body).digest('base64url')
 return {
  sign:(payload:Row)=>{const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return `${body}.${mac(body)}`},
  open:(token:unknown):Row|null=>{
   if(typeof token!=='string'||token.length>2000)return null
   const [body,signature,extra]=token.split('.')
   if(!body||!signature||extra!==undefined)return null
   const a=Buffer.from(signature),b=Buffer.from(mac(body))
   if(a.length!==b.length||!timingSafeEqual(a,b))return null
   try{const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return payload&&typeof payload==='object'&&Number(payload.exp)>Date.now()?payload as Row:null}catch{return null}
  },
 }
}
const maskEmail=(email:string)=>email.replace(/^(.{1,2})[^@]*(@.*)$/,(_,start:string,domain:string)=>`${start}***${domain}`)
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

/**
 * Valida a sessão, exige um e-mail confirmado da lista de administradores e, com o envio de e-mail
 * configurado, a sessão do aparelho confirmada pelo código (cabeçalho x-admin-session).
 */
async function requireAdmin(env:NodeJS.ProcessEnv,request:typeof fetch,authorization:string|undefined,adminSession?:string,skipCode=false){
 if(!authorization?.startsWith('Bearer ')||authorization.length>16000)throw new AccountError(401,'Entre na sua conta para acessar a administração.')
 const config=configuration(env)
 const identity=await request(`${config.url}/auth/v1/user`,{headers:{apikey:config.publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)})
 if(!identity.ok)throw new AccountError(401,'Entre novamente para continuar.')
 const user=await identity.json() as Row
 const allowed=(env.SIXTYSIX_ADMIN_EMAILS||'alissonmedeiroz007@gmail.com,alysontrx@gmail.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
 if(!user.id||user.is_anonymous||!user.email_confirmed_at||!allowed.includes(String(user.email||'').toLowerCase()))throw new AccountError(403,'Esta área é exclusiva da administração.')
 const email=String(user.email).toLowerCase(),userId=String(user.id)
 const twoFactor=emailConfig(env)?'on':'off'
 if(twoFactor==='on'&&!skipCode){
  const session=adminSigner(config.secret).open(adminSession)
  if(!session||session.kind!=='session'||session.u!==userId||session.e!==email)throw new AccountError(401,'Confirme o código enviado para o seu e-mail para entrar na administração.','admin_2fa_required')
 }
 return {config,email,userId,twoFactor}
}

/** Envio e conferência do código do admin. Funciona antes da sessão do aparelho existir. */
async function adminTwoFactor(env:NodeJS.ProcessEnv,request:typeof fetch,authorization:string|undefined,body:Row){
 const {config,email,userId}=await requireAdmin(env,request,authorization,undefined,true)
 const mail=emailConfig(env)
 if(!mail)return {twoFactor:'off'}
 const signer=adminSigner(config.secret)
 if(body.action==='admin-2fa-send'){
  const code=String(randomInt(0,1000000)).padStart(6,'0')
  const challenge=signer.sign({kind:'code',u:userId,e:email,h:sha(code),n:randomUUID(),exp:Date.now()+ADMIN_CODE_MINUTES*60000})
  try{await sendEmail(mail,adminCodeEmail({to:email,code}),request)}catch{throw new AccountError(503,'Não foi possível enviar o código agora. Tente de novo em instantes.')}
  return {challenge,sentTo:maskEmail(email),minutes:ADMIN_CODE_MINUTES}
 }
 const pending=signer.open(body.challenge)
 if(!pending||pending.kind!=='code'||pending.u!==userId||pending.e!==email)throw new AccountError(400,'O código venceu. Peça um novo.')
 const code=String(body.code??'').replace(/\D/g,'')
 const a=Buffer.from(sha(code)),b=Buffer.from(String(pending.h))
 if(code.length!==6||a.length!==b.length||!timingSafeEqual(a,b)){
  // Pausa curta a cada erro para não dar para testar códigos em sequência.
  await new Promise(resolve=>setTimeout(resolve,800))
  throw new AccountError(400,'Código incorreto. Confira o e-mail e tente de novo.')
 }
 const expires=Date.now()+ADMIN_SESSION_DAYS*86400000
 return {session:signer.sign({kind:'session',u:userId,e:email,exp:expires}),expiresAt:new Date(expires).toISOString()}
}

export function createAdminService(env=process.env,request:typeof fetch=fetch){
 return async (authorization:string|undefined,query:URLSearchParams,adminSession?:string)=>{
  const {config,email,twoFactor}=await requireAdmin(env,request,authorization,adminSession)
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
  return {rows,hasMore:rows.length===500,admin:email,twoFactor}
 }
}

/** Ações do admin. Sempre exigem `action` explícita — nunca uma ação em massa por acidente. */
export function createAdminActions(env=process.env,request:typeof fetch=fetch){
 return async (authorization:string|undefined,body:Row,adminSession?:string)=>{
  if(body.action==='admin-2fa-send'||body.action==='admin-2fa-verify')return adminTwoFactor(env,request,authorization,body)
  const {config,email}=await requireAdmin(env,request,authorization,adminSession)
  const headers={...serviceHeaders(config.secret),'Content-Type':'application/json'}
  const rpc=async<T>(name:string,args:Row):Promise<T>=>{
   const response=await request(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000)})
   if(!response.ok)throw new AccountError(503,name.includes('delivery')?'Não foi possível salvar. Confira se a migração supabase/whatsapp-delivery.sql foi aplicada.':'Operação incompleta. Atualize e tente novamente.')
   return await response.json() as T
  }
  const action=typeof body.action==='string'?body.action:''
  if(action.startsWith('router-')){
   const router=createRouterAdmin(config,request,email)
   // Acha a conta cadastrada pelo e-mail (vazio = desligar a chave da conta).
   const findUser=async(raw:unknown)=>{
    const wanted=typeof raw==='string'?raw.trim().toLowerCase():''
    if(!wanted)return null
    if(wanted.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wanted))throw new RouterError(400,'Digite um e-mail válido.')
    for(let page=1;page<=40;page++){
     const response=await request(`${config.url}/auth/v1/admin/users?page=${page}&per_page=500`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(15000)})
     if(!response.ok)throw new RouterError(503,'Não foi possível consultar as contas. Tente de novo.')
     const list=(((await response.json()) as Row).users||[]) as Row[]
     const found=list.find(u=>String(u.email||'').toLowerCase()===wanted)
     if(found){const u=userFromAuth(found);return {id:u.id,email:u.email,name:u.name}}
     if(list.length<500)break
    }
    throw new RouterError(404,'Nenhuma conta com esse e-mail. Peça para o cliente criar a conta em sixtysix.online e tente de novo.')
   }
   const actions:Record<string,(input:Row)=>Promise<unknown>>={
    'router-key-link':async(input:Row)=>{const user=await findUser(input.email);return {...await router.linkKey({id:input.id,user_id:user?.id||null}),user}},
    'router-provider-save':router.saveProvider,'router-provider-enabled':router.setProviderEnabled,'router-provider-delete':router.deleteProvider,
    'router-provider-models':router.providerModels,'router-models-save':router.saveModels,
    'router-key-create':router.createKey,'router-key-renew':router.renewKey,'router-key-block':router.setKeyBlocked,'router-key-reveal':router.revealKey,
    'router-guard-save':router.saveGuardSettings,'router-network-block':router.setNetworkBlocked,
    'router-key-ips':router.keyIps,'router-key-ip-block':router.setKeyIpBlocked,'router-key-limits':router.saveKeyLimits,
    'router-key-ip-accept':router.acceptKeyIp,'router-key-ip-remove':router.removeKeyIp,'router-key-update':router.updateKey,'router-key-delete':router.deleteKey,
   }
   if(!actions[action])throw new AccountError(400,'Ação inválida.')
   try{return await actions[action](body)}catch(error){if(error instanceof RouterError)throw new AccountError(error.status,error.message);throw error}
  }
  if(action==='revoke-old-trials'){
   const query=new URLSearchParams({resource:'trials',history:'1'}),read=createAdminService(env,request);let count=0
   for(let offset=0;offset<=1000000;offset+=500){query.set('offset',String(offset));const page=await read(authorization,query,adminSession);for(const trial of page.rows){if(Date.parse(trial.created_at)>=Date.parse(TRIAL_CUTOFF)||trial.revoked_at)continue;if(await rpc<boolean>('account_revoke_trial',{p_user_id:trial.user_id,p_client_id:trial.gateway_client_id})!==true)throw new AccountError(503,'Revogação incompleta. Atualize e tente novamente.');count++}if(!page.hasMore)break}
   return {revoked:count,cutoff:TRIAL_CUTOFF}
  }
  // Entrega da operação atual: cria a chave SixtySix (sk-rt-) no Roteador, liga à conta do cliente
  // (ele vê a chave e o consumo no painel) e registra a entrega para ele confirmar o recebimento.
  if(action==='deliver-key'){
   if(!isUuid(body.user_id))throw new AccountError(400,'Cliente inválido.')
   const subscription=body.subscription_id==null||body.subscription_id===''?null:body.subscription_id
   if(subscription!==null&&!isUuid(subscription))throw new AccountError(400,'Assinatura inválida.')
   const raw=typeof body.expires==='string'?body.expires.trim():''
   const until=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T23:59:59-03:00`:'')
   if(!Number.isFinite(until)||until<=Date.now())throw new AccountError(400,'Escolha uma validade a partir de hoje.')
   const days=Math.ceil((until-Date.now())/86400000)
   if(days>366)throw new AccountError(400,'Escolha uma validade de até 1 ano.')
   const models=Array.isArray(body.models)?(body.models as unknown[]).map(m=>String(m).trim()).filter(Boolean).slice(0,200):null
   if(models&&!models.length)throw new AccountError(400,'Escolha pelo menos um modelo.')
   const found=await request(`${config.url}/auth/v1/admin/users/${body.user_id}`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(10000)})
   if(!found.ok)throw new AccountError(404,'Cliente não encontrado.')
   const customer=userFromAuth(await found.json())
   const name=(customer.name||customer.email||'Cliente').trim().slice(0,80)
   const contact=(customer.whatsapp?formatWhatsapp(customer.whatsapp):customer.email||'').slice(0,80)
   const router=createRouterAdmin(config,request,email)
   let created:{key:string;row:Row}
   try{
    created=await router.createKey({name,contact,days,models}) as {key:string;row:Row}
    // Validade exata: até o fim do dia escolhido, no horário de Brasília.
    await router.updateKey({id:created.row.id,name,contact,models,expires_at:raw})
   }catch(error){if(error instanceof RouterError)throw new AccountError(error.status,error.message);throw error}
   const headers2={...serviceHeaders(config.secret),'Content-Type':'application/json'}
   // Liga a chave à conta do cliente: ela e o consumo aparecem no painel dele.
   // Antes, uma falha aqui (ex.: id errado, erro do banco) era engolida em silêncio: a chave saía
   // sem dono e nunca aparecia no painel do cliente, sem nenhum aviso para o admin. Agora o resultado
   // avisa (campo "linked") em vez de só seguir como se tivesse dado certo.
   const linkResponse=await request(`${config.url}/rest/v1/gateway_clients?${new URLSearchParams({id:`eq.${created.row.gateway_client_id}`})}`,{method:'PATCH',headers:headers2,body:JSON.stringify({user_id:customer.id}),signal:AbortSignal.timeout(10000)}).catch(()=>null)
   const linked=Boolean(linkResponse?.ok)
   if(!linked)console.error('deliver-key: não foi possível ligar a chave à conta',customer.id,created.row.gateway_client_id,linkResponse?.status,await linkResponse?.text().catch(()=>''))
   // Registro da entrega: o cliente confirma no painel que recebeu a chave terminada em …xxxx.
   const hint=created.key.slice(-4),deliveryId=randomUUID()
   let delivered:string|null=null
   try{
    delivered=await rpc<string|null>('admin_register_delivery',{p_id:deliveryId,p_user_id:customer.id,p_subscription_id:subscription,p_product:'outro',p_supplier:'SixtySix',p_key_hint:hint,p_base_url:'https://www.sixtysix.online',p_model_id:null,p_notes:null,p_expires_at:new Date(until).toISOString(),p_replaces:null,p_created_by:email})
   }catch{delivered=null}
   let notice:NotifyResult='skipped'
   const mail=emailConfig(env)
   if(mail&&delivered)notice=await createNotifier(config,mail,request).delivery(customer,{id:deliveryId,title:'SixtySix',key_hint:hint}).catch(()=>'failed' as NotifyResult)
   return {key:created.key,hint,expires_at:new Date(until).toISOString(),models,keyId:created.row.id,deliveryId:delivered,email:notice,linked}
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
  // Afiliados (supabase/affiliates.sql): só as contas que o admin ativar. Cada pagamento aprovado de quem
  // chegou pelo link do afiliado (inclusive renovações) dá a ele `days` dias de acesso.
  if(action==='affiliate-list'||action==='affiliate-save'){
   const read=async<T>(path:string,params:Record<string,string>):Promise<T>=>{
    const response=await request(`${config.url}/rest/v1/${path}?${new URLSearchParams(params)}`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new AccountError(503,'Afiliados indisponíveis: aplique a migração supabase/affiliates.sql.')
    return await response.json() as T
   }
   if(action==='affiliate-save'){
    const wanted=typeof body.email==='string'?body.email.trim().toLowerCase():''
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wanted)||wanted.length>200)throw new AccountError(400,'Digite o e-mail da conta do afiliado.')
    let user:Row|null=null
    for(let page=1;page<=40&&!user;page++){
     const response=await request(`${config.url}/auth/v1/admin/users?page=${page}&per_page=500`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(15000)})
     if(!response.ok)throw new AccountError(503,'Não foi possível consultar as contas. Tente de novo.')
     const list=(((await response.json()) as Row).users||[]) as Row[]
     user=list.find(u=>String(u.email||'').toLowerCase()===wanted)||null
     if(list.length<500)break
    }
    if(!user)throw new AccountError(404,'Nenhuma conta com esse e-mail. Peça para o afiliado criar a conta em sixtysix.online e tente de novo.')
    const days=body.days===undefined||body.days===''?7:Number(body.days)
    if(!Number.isInteger(days)||days<1||days>60)throw new AccountError(400,'Escolha de 1 a 60 dias por pagamento.')
    const enabled=body.enabled!==false
    const current=(await read<Row[]>('affiliates',{user_id:`eq.${user.id}`,select:'code',limit:'1'}))[0]
    const typed=typeof body.code==='string'?body.code.trim().toLowerCase():''
    if(typed&&!/^[a-z0-9][a-z0-9-]{2,29}$/.test(typed))throw new AccountError(400,'O código do link usa de 3 a 30 letras minúsculas, números ou hífen.')
    const base=(wanted.split('@')[0].replace(/[^a-z0-9]/g,'').slice(0,20)||'six').padEnd(3,'6')
    const candidates=typed?[typed]:current?[String(current.code)]:[base,...Array.from({length:5},()=>`${base}${randomInt(10,1000)}`)]
    let saved:Row|null=null
    for(const code of candidates){
     const response=await request(`${config.url}/rest/v1/affiliates?on_conflict=user_id`,{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({user_id:user.id,code,days_per_payment:days,enabled,created_by:email}),signal:AbortSignal.timeout(15000)})
     if(response.ok){saved=((await response.json()) as Row[])[0];break}
     const error=(await response.json().catch(()=>({}))) as Row
     if(error.code!=='23505')throw new AccountError(503,'Afiliados indisponíveis: aplique a migração supabase/affiliates.sql.')
     if(typed)throw new AccountError(409,'Esse código de link já é de outro afiliado. Escolha outro.')
    }
    if(!saved)throw new AccountError(409,'Não foi possível criar um código de link. Digite um código.')
    console.log('affiliate-save:',email,enabled?'ativou':'desativou','o afiliado',user.id,'código',saved.code,'dias',days)
    return {ok:true,code:saved.code,enabled:saved.enabled,days:saved.days_per_payment,link:`https://www.sixtysix.online/convite/${saved.code}`}
   }
   const affiliates=await read<Row[]>('affiliates',{select:'user_id,code,days_per_payment,enabled,created_at',order:'created_at.desc'})
   if(!affiliates.length)return {affiliates:[]}
   const ids=affiliates.map(a=>a.user_id).join(',')
   const [referrals,rewards]=await Promise.all([
    read<Row[]>('affiliate_referrals',{affiliate_user_id:`in.(${ids})`,select:'affiliate_user_id,referred_user_id'}),
    read<Row[]>('affiliate_rewards',{affiliate_user_id:`in.(${ids})`,select:'affiliate_user_id,referred_user_id,days,revoked_at'}),
   ])
   const out=[]
   for(const a of affiliates){
    const found=await request(`${config.url}/auth/v1/admin/users/${a.user_id}`,{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(10000)}).catch(()=>null)
    const user=found?.ok?userFromAuth(await found.json()):null
    const valid=rewards.filter(r=>r.affiliate_user_id===a.user_id&&!r.revoked_at)
    out.push({user_id:a.user_id,email:user?.email||'',name:user?.name||'',code:a.code,days:a.days_per_payment,enabled:a.enabled,created_at:a.created_at,link:`https://www.sixtysix.online/convite/${a.code}`,
     referred:referrals.filter(r=>r.affiliate_user_id===a.user_id).length,paying:new Set(valid.map(r=>r.referred_user_id)).size,payments:valid.length,totalDays:valid.reduce((s,r)=>s+Number(r.days||0),0)})
   }
   return {affiliates:out}
  }
  // Cliente comprou o plano errado: troca o plano de uma assinatura paga por Pix, sem mexer no período pago.
  // O painel dele, a chave do plano (sk-sp-), o chat do site e a renovação passam a seguir o plano novo.
  // Chaves do Roteador ligadas à conta com uma lista de modelos ganham os modelos do plano novo;
  // as que têm todos os modelos ficam como estão (o resultado diz qual foi o caso de cada uma).
  if(action==='subscription-plan'){
   if(!isUuid(body.id))throw new AccountError(400,'Assinatura inválida.')
   const code=typeof body.plan==='string'&&Object.prototype.hasOwnProperty.call(billingPlans,body.plan)?body.plan as keyof typeof billingPlans:null
   if(!code)throw new AccountError(400,'Escolha um plano válido.')
   const target=billingPlans[code]
   const rest=async<T>(path:string,params:Record<string,string>,patch?:Row):Promise<T>=>{
    const response=await request(`${config.url}/rest/v1/${path}?${new URLSearchParams(params)}`,patch?{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify(patch),signal:AbortSignal.timeout(15000)}:{headers:serviceHeaders(config.secret),signal:AbortSignal.timeout(15000)})
    if(!response.ok)throw new AccountError(503,patch?'Não foi possível salvar. Atualize e tente de novo.':'Não foi possível ler a assinatura. Atualize e tente de novo.')
    return await response.json() as T
   }
   const item=(await rest<Row[]>('billing_subscription_state',{id:`eq.${body.id}`,select:'id,user_id,plan_code,billing_mode,entitled,paid_until',limit:'1'}))[0]
   if(!item)throw new AccountError(404,'Assinatura não encontrada.')
   if(item.billing_mode!=='pix')throw new AccountError(409,'Esta assinatura é no cartão: o Mercado Pago continuaria cobrando o valor do plano antigo. Cancele e peça para o cliente assinar o plano certo.')
   if(!item.entitled||!item.paid_until||Date.parse(item.paid_until)<=Date.now())throw new AccountError(409,'Só dá para trocar o plano de uma assinatura paga e ativa.')
   if(item.plan_code===code)throw new AccountError(409,`Esta assinatura já é do plano ${target.name}.`)
   const changed=await rest<Row[]>('billing_subscriptions',{id:`eq.${item.id}`},{plan_code:code,api_enabled:target.api,models:[...target.models],amount_cents:target.amount})
   if(!changed[0])throw new AccountError(404,'Assinatura não encontrada.')
   console.log('subscription-plan:',email,'trocou a assinatura',item.id,'de',item.plan_code,'para',code)
   const keys:{name:string;models:string[]|null;updated:boolean}[]=[]
   try{
    const router=await loadRouter(env,request)
    const models=canonicalModels(router,withPlanModels(target.models,router.proAliases))
    const clients=await rest<Row[]>('gateway_clients',{user_id:`eq.${item.user_id}`,select:'id'})
    const linked=clients.length?await rest<Row[]>('router_keys',{gateway_client_id:`in.(${clients.map(c=>c.id).join(',')})`,revoked_at:'is.null',select:'id,name,models'}):[]
    for(const key of linked){
     const explicit=Array.isArray(key.models)&&key.models.length>0
     if(explicit&&models.length)await rest('router_keys',{id:`eq.${key.id}`},{models})
     keys.push({name:String(key.name||'Chave'),models:explicit&&models.length?models:explicit?key.models:null,updated:explicit&&models.length>0})
    }
   }catch(error){
    console.error('subscription-plan: plano trocado, mas as chaves do Roteador não foram conferidas',item.id,error)
    return {ok:true,plan:target.name,api:target.api,keys,keysChecked:false}
   }
   return {ok:true,plan:target.name,api:target.api,keys,keysChecked:true}
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
  const header=req.headers['x-admin-session'],adminSession=typeof header==='string'?header:undefined
  if(req.method==='POST'){
   const result=await createAdminActions()(req.headers.authorization,await readBody(req),adminSession)
   res.statusCode=200;res.end(JSON.stringify(result));return
  }
  if(req.method!=='GET')throw new AccountError(405,'Operação não disponível.')
  const result=await createAdminService()(req.headers.authorization,new URL(req.url||'/', 'http://localhost').searchParams,adminSession)
  res.statusCode=200;res.end(JSON.stringify(result))
 }catch(error){res.statusCode=error instanceof AccountError?error.status:503;res.end(JSON.stringify({error:error instanceof AccountError?error.message:'Administração temporariamente indisponível.',...(error instanceof AccountError&&error.code?{code:error.code}:{})}))}
}
