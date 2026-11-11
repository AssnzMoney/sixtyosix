import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { PRO_BASE_MODELS, withPlanModels } from '../server/model-aliases.js'
import { recordUsage, supplierRequestBody, supplierUrl, UsageTap } from '../server/supplier.js'
import { clientIp, gateRequest, releaseRequest } from '../server/guard.js'
import { authorizeRouterKey, EMPTY_ROUTER, loadRouter, RouterError, ROUTER_KEY_PREFIX, routerStatus, canonicalModels, findRoute, type RouterConfig, type RouterRoute } from '../server/router.js'

type Env = Record<string,string|undefined>
type Trial = { user_id:string; gateway_client_id:string; token_hash:string; token_prefix:string; encrypted_token:string; encrypted_upstream:string; created_at:string; expires_at:string; revoked_at:string|null }
type PaidAccess = {user_id:string;subscription_id:string;gateway_client_id:string;encrypted_upstream:string;paid_until:string|null;revoked_at:string|null;api_enabled:boolean;models:string[];entitled:boolean}
/** O teste grátis libera os mesmos modelos do Pro, incluindo os do Roteador marcados para o Pro. */
export const trialModels=(router:RouterConfig=EMPTY_ROUTER)=>withPlanModels(PRO_BASE_MODELS,router.proAliases)
export class AccessError extends Error {
  status:number
  constructor(status:number,message:string){super(message);this.status=status}
}
const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
function encryptionKey(secret:string){return createHash('sha256').update(`sixtysix-trial-v1\0${secret}`).digest()}
export function seal(value:string,secret:string,aad:string){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(secret),iv)
  cipher.setAAD(Buffer.from(aad))
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()])
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64url')
}
export function unseal(value:string,secret:string,aad:string){
  const packed=Buffer.from(value,'base64url')
  if(packed.length<29)throw new AccessError(503,'Não foi possível recuperar sua chave.')
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(secret),packed.subarray(0,12))
  decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(packed.subarray(12,28))
  return Buffer.concat([decipher.update(packed.subarray(28)),decipher.final()]).toString('utf8')
}
export function trialActive(trial:Pick<Trial,'expires_at'|'revoked_at'>,now=Date.now()){
  return !trial.revoked_at && Date.parse(trial.expires_at)>now
}
export function createAccessService(env:Env=process.env,request:typeof fetch=fetch){
  const base=env.SUPABASE_URL?.replace(/\/+$/,''),secret=env.SUPABASE_SERVICE_ROLE_KEY
  async function db<T>(resource:string,query:Record<string,string>={},body?:unknown):Promise<T>{
    if(!base?.startsWith('https://')||!secret)throw new AccessError(503,'A ativação do teste está temporariamente indisponível.')
    const response=await request(`${base}/rest/v1/${resource}?${new URLSearchParams(query)}`,{
      method:body===undefined?'GET':'POST',headers:{apikey:secret,...(!secret.startsWith('sb_secret_')?{Authorization:`Bearer ${secret}`} :{}),'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000),
    })
    if(!response.ok)throw new AccessError(503,'Não foi possível consultar seu teste. Tente novamente.')
    return await response.json() as T
  }
  async function identity(authorization?:string){
    const publicKey=env.VITE_SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY
    if(!authorization?.startsWith('Bearer ')||authorization.length>16000)throw new AccessError(401,'Entre na sua conta para ativar o teste.')
    if(!base||!publicKey)throw new AccessError(503,'Conexão temporariamente indisponível.')
    const response=await request(`${base}/auth/v1/user`,{headers:{apikey:publicKey,Authorization:authorization},signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw new AccessError(response.status>=500?503:401,'Entre novamente na sua conta.')
    const user=await response.json() as {id?:string;is_anonymous?:boolean;email_confirmed_at?:string}
    if(!user.id||!/^[0-9a-f-]{36}$/i.test(user.id)||user.is_anonymous)throw new AccessError(401,'Entre com uma conta válida.')
    if(!user.email_confirmed_at)throw new AccessError(403,'Confirme seu e-mail antes de ativar o teste.')
    return user.id
  }
  return {
    async start(authorization?:string,replace=false){
      const userId=await identity(authorization)
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      const token=`sk-sx-${randomBytes(32).toString('base64url')}`
      const upstream=`sk-flg-${randomBytes(32).toString('base64url')}`
      const result=await db<Trial|Trial[]>(replace?'rpc/account_replace_trial_key':'rpc/account_start_trial_3h',{}, {
        p_user_id:userId,p_hash:sha(token),p_prefix:token.slice(0,14),p_encrypted_token:seal(token,secret,`${userId}:public`),
        p_upstream_hash:sha(upstream),p_encrypted_upstream:seal(upstream,secret,`${userId}:upstream`),
      })
      const trial=Array.isArray(result)?result[0]:result
      if(!trial)throw new AccessError(503,'Não foi possível ativar seu teste.')
      const active=trialActive(trial)
      return {active,revoked:Boolean(trial.revoked_at),created:trial.created_at,expires:trial.expires_at,
        key:active?unseal(trial.encrypted_token,secret,`${userId}:public`):null}
    },
    async authorize(token:string,router:RouterConfig=EMPTY_ROUTER){
      const rows=await db<Trial[]>('gateway_trials',{token_hash:`eq.${sha(token)}`,select:'user_id,gateway_client_id,expires_at,revoked_at,encrypted_upstream',limit:'1'})
      const trial=rows[0]
      if(!trial)throw new AccessError(401,'Chave de acesso inválida.')
      if(!trialActive(trial))throw new AccessError(403,'Seu teste terminou ou foi revogado. Escolha um plano para continuar.')
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      return {token:unseal(trial.encrypted_upstream,secret,`${trial.user_id}:upstream`),clientId:trial.gateway_client_id,models:trialModels(router)}
    },
    async authorizePaid(token:string,model?:string,proExtras:readonly string[]=[]){
      const rows=await db<PaidAccess[]>('billing_key_access',{token_hash:`eq.${sha(token)}`,select:'user_id,subscription_id,gateway_client_id,encrypted_upstream,paid_until,revoked_at,api_enabled,models,entitled',limit:'1'}),access=rows[0]
      if(!access)throw new AccessError(401,'Chave de acesso inválida.')
      if(!access.entitled||access.revoked_at||!access.paid_until||Date.parse(access.paid_until)<=Date.now())throw new AccessError(403,'O período pago terminou ou a chave foi revogada. Confira sua assinatura no painel.')
      if(!access.api_enabled)throw new AccessError(403,'Seu plano permite uso pelo site. Para usar uma chave externa, escolha um plano com API.')
      const models=withPlanModels(access.models,proExtras)
      if(model&&!models.includes(model))throw new AccessError(403,'Este modelo não está incluído no seu plano.')
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      return {token:unseal(access.encrypted_upstream,secret,`${access.user_id}:paid:${access.subscription_id}:upstream`),models,clientId:access.gateway_client_id}
    },
  }
}

/** /glm/v1/... e /api/codex/... (endereços antigos) → /v1/... no provedor. */
export function supplierPath(path:string){
  if(path.startsWith('/glm/v1'))return '/v1'+path.slice('/glm/v1'.length)
  if(path.startsWith('/api/codex'))return '/v1'+path.slice('/api/codex'.length)
  return path
}
export function proxyPath(value:string){
  if(!/^\/(?:v1|glm\/v1|api\/codex)(?:\/[A-Za-z0-9_.-]+)*\/?$/.test(value)||value.split('/').some(s=>s==='.'||s==='..'))throw new AccessError(400,'Endereço inválido.')
  return value
}
async function rawBody(req:IncomingMessage & {body?:unknown}){
  if(req.body!==undefined){
    const value=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body))
    if(value.length>4*1024*1024)throw new AccessError(413,'Solicitação muito grande.')
    return value
  }
  const chunks:Buffer[]=[];let size=0
  for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>4*1024*1024)throw new AccessError(413,'Solicitação muito grande.');chunks.push(bytes)}
  return Buffer.concat(chunks)
}
const single=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined
const modelEntry=(id:string,label?:string)=>({id,object:'model',type:'model',display_name:label||id,owned_by:'sixtysix',created:1767225600,created_at:'2026-01-01T00:00:00Z'})

type SupplierCall={route:RouterRoute;path:string;params:URLSearchParams;payload:Record<string,unknown>;clientId:string}
/** Chama o provedor do Roteador com a key mestra, repassa a resposta e grava o consumo do cliente. */
async function proxySupplier(req:IncomingMessage,res:ServerResponse,call:SupplierCall){
  const {route}=call,{provider}=route
  const {body,injectedUsage}=supplierRequestBody(call.payload,call.path,route.upstream)
  const headers:Record<string,string>={'content-type':'application/json','x-api-key':provider.key,Authorization:`Bearer ${provider.key}`}
  for(const key of ['accept','anthropic-version','anthropic-beta','openai-beta']){const value=single(req.headers[key]);if(value)headers[key]=value}
  const controller=new AbortController(),started=Date.now()
  req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort()})
  let status=502,tap:UsageTap|null=null
  try{
    const response=await fetch(supplierUrl(provider.url,call.path,call.params.size?`?${call.params}`:''),{method:'POST',headers,body,redirect:'manual',signal:controller.signal})
    status=response.status
    // Recusa da key mestra (saldo, bloqueio) ou falha do fornecedor: o cliente não vê detalhes do fornecedor.
    if(status===401||status===402||status===403||status>=500||(status>=300&&status<400)){
      console.error('Provedor recusou a chamada',provider.name,status,(await response.text().catch(()=>'')).slice(0,500))
      throw new AccessError(503,'Este modelo está temporariamente indisponível. Tente novamente em instantes.')
    }
    res.statusCode=status
    for(const key of ['content-type','retry-after']){const value=response.headers.get(key);if(value)res.setHeader(key,value)}
    if(req.headers.origin)res.setHeader('access-control-allow-origin','*')
    tap=new UsageTap({stream:(response.headers.get('content-type')||'').includes('text/event-stream'),alias:route.alias,supplierId:route.upstream,dropInjectedUsage:injectedUsage})
    const write=async(text:string)=>{if(text&&!res.write(text))await new Promise(resolve=>{res.once('drain',resolve);res.once('close',resolve)})}
    if(response.body){const reader=response.body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;await write(tap.push(value))}}
    await write(tap.end())
  }finally{
    await recordUsage(process.env,fetch,{client_id:call.clientId,requested_alias:route.alias,status_code:status,input_tokens:tap?.usage.input??0,output_tokens:tap?.usage.output??0,latency_ms:Date.now()-started})
  }
  res.end()
}

export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff')
  try{
    const url=new URL(req.url||'/','https://www.sixtysix.online')
    const action=url.searchParams.get('action')||url.pathname.split('/').pop()
    const service=createAccessService()
    if(action==='trial'){
      if(req.method!=='POST')throw new AccessError(405,'Use POST para ativar seu teste.')
      // Teste grátis de 3 horas, um por conta, mais lento que os planos pagos (supabase/trial-3h.sql). SIXTYSIX_SELF_TRIAL=0 pausa.
      if(process.env.SIXTYSIX_SELF_TRIAL==='0')throw new AccessError(410,'O teste grátis está pausado no momento. Fale com a gente no WhatsApp: (81) 99237-6036.')
      res.setHeader('Content-Type','application/json; charset=utf-8')
      res.end(JSON.stringify(await service.start(req.headers.authorization,url.searchParams.get('replace')==='1')));return
    }
    // Diagnóstico público do Roteador (sem keys): /api/router-status
    if(action==='router-status'){
      const status=await routerStatus(process.env)
      res.setHeader('Content-Type','application/json; charset=utf-8');res.statusCode=200;res.end(JSON.stringify(status));return
    }
    // Status público (/api/health): o gateway está pronto quando há modelos ativos no Roteador.
    if(action==='health'){
      const router=await loadRouter(process.env)
      res.setHeader('Content-Type','application/json; charset=utf-8');res.statusCode=router.routes.size?200:503
      res.end(JSON.stringify({ok:router.routes.size>0,models:router.routes.size}));return
    }
    if(action!=='proxy')throw new AccessError(404,'Operação não encontrada.')
    if(!['GET','HEAD','POST','OPTIONS'].includes(req.method||''))throw new AccessError(405,'Método não permitido.')
    // CORS para apps no navegador: respondido aqui, sem gateway externo.
    res.setHeader('access-control-allow-origin','*')
    if(req.method==='OPTIONS'){
      res.setHeader('access-control-allow-methods','GET, POST, OPTIONS')
      res.setHeader('access-control-allow-headers','authorization, x-api-key, anthropic-api-key, content-type, accept, anthropic-version, anthropic-beta, openai-beta, anthropic-dangerous-direct-browser-access')
      res.setHeader('access-control-max-age','86400');res.statusCode=204;res.end();return
    }
    // Endereços antigos (/glm/v1 e /api/codex) continuam aceitos e viram /v1 no provedor.
    const path=supplierPath(proxyPath(url.searchParams.get('path')||''))
    const credential=single(req.headers['x-api-key'])||single(req.headers['anthropic-api-key'])||req.headers.authorization||''
    const token=credential.replace(/^Bearer\s+/i,'').trim()
    if(token.length>256)throw new AccessError(401,'Chave inválida.')
    // Só as chaves do SixtySix: Roteador (sk-rt-), plano do site (sk-sp-) e teste (sk-sx-). As antigas (sk-flg-) foram desativadas.
    if(!/^sk-(sx|sp|rt)-/.test(token))throw new AccessError(401,token?'Esta chave foi desativada. Peça uma nova pelo WhatsApp: (81) 99237-6036.':'Informe sua chave de acesso.')
    const body=req.method==='POST'?await rawBody(req):undefined
    const params=new URLSearchParams(url.searchParams);params.delete('action');params.delete('path')
    let payload:Record<string,unknown>|null=null
    if(body){
      try{const parsed=JSON.parse(body.toString('utf8')||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))payload=parsed}catch{/* tratado abaixo */}
      if(!payload)throw new AccessError(400,'JSON inválido.')
    }
    const model=typeof payload?.model==='string'?payload.model:''
    if(req.method==='POST'&&!model)throw new AccessError(400,'Selecione um modelo para continuar.')
    const router=await loadRouter(process.env)
    let allowed:string[]=[],clientId=''
    if(token.startsWith('sk-sx-')){const trial=await service.authorize(token,router);allowed=trial.models;clientId=trial.clientId}
    if(token.startsWith('sk-sp-')){const paid=await service.authorizePaid(token,model||undefined,router.proAliases);allowed=paid.models;clientId=paid.clientId}
    if(token.startsWith(ROUTER_KEY_PREFIX)){
      try{const key=await authorizeRouterKey(process.env,fetch,token,router);allowed=key.allowed;clientId=key.clientId}
      catch(error){if(error instanceof RouterError)throw new AccessError(error.status,error.message);throw error}
    }
    // Só existe o que está ativo no Roteador.
    allowed=canonicalModels(router,allowed)
    if((req.method==='GET'||req.method==='HEAD')&&/^\/v1\/models\/?$/.test(path)){
      const data=allowed.map(alias=>modelEntry(alias,router.routes.get(alias)?.label))
      res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8')
      res.end(req.method==='HEAD'?undefined:JSON.stringify({object:'list',data,has_more:false,first_id:data[0]?.id??null,last_id:data[data.length-1]?.id??null}));return
    }
    if(req.method==='POST'&&payload&&path.startsWith('/v1/')){
      const route=findRoute(router,model)
      if(!route)throw new AccessError(404,'Este modelo não está disponível. Veja os modelos liberados para a sua chave em /v1/models.')
      if(!allowed.includes(route.alias)||!clientId)throw new AccessError(403,'Este modelo não está incluído no seu plano.')
      // Proteção contra sobrecarga e IP bloqueado: acima do limite, 429 com Retry-After (a ferramenta tenta de novo).
      const requestId=randomUUID()
      const gate=await gateRequest(process.env,fetch,{clientId,ip:clientIp(req.headers,req.socket?.remoteAddress||''),requestId})
      if(!gate.ok){if(gate.retryAfter)res.setHeader('retry-after',String(gate.retryAfter));throw new AccessError(gate.status,gate.message)}
      try{await proxySupplier(req,res,{route,path,params,payload,clientId})}
      finally{if(gate.leased)await releaseRequest(process.env,fetch,requestId)}
      return
    }
    throw new AccessError(404,'Endereço não disponível.')
  }catch(error){
    if(res.headersSent){res.destroy();return}
    res.statusCode=error instanceof AccessError?error.status:503
    res.setHeader('Content-Type','application/json; charset=utf-8')
    const type=({400:'invalid_request_error',401:'authentication_error',404:'not_found_error',413:'request_too_large',429:'rate_limit_error'} as Record<number,string>)[res.statusCode]||(res.statusCode>=500?'api_error':'permission_error')
    res.end(JSON.stringify({type:'error',error:{type,message:error instanceof AccessError?error.message:'Conexão temporariamente indisponível.'}}))
  }
}
