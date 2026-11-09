import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

type Env = Record<string,string|undefined>
type Trial = { user_id:string; gateway_client_id:string; token_hash:string; token_prefix:string; encrypted_token:string; encrypted_upstream:string; created_at:string; expires_at:string; revoked_at:string|null }
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
    async start(authorization?:string){
      const userId=await identity(authorization)
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      const token=`sk-sx-${randomBytes(32).toString('base64url')}`
      const upstream=`sk-flg-${randomBytes(32).toString('base64url')}`
      const result=await db<Trial|Trial[]>('rpc/account_start_trial',{}, {
        p_user_id:userId,p_hash:sha(token),p_prefix:token.slice(0,14),p_encrypted_token:seal(token,secret,`${userId}:public`),
        p_upstream_hash:sha(upstream),p_encrypted_upstream:seal(upstream,secret,`${userId}:upstream`),
      })
      const trial=Array.isArray(result)?result[0]:result
      if(!trial)throw new AccessError(503,'Não foi possível ativar seu teste.')
      const active=trialActive(trial)
      return {active,revoked:Boolean(trial.revoked_at),created:trial.created_at,expires:trial.expires_at,
        key:active?unseal(trial.encrypted_token,secret,`${userId}:public`):null}
    },
    async authorize(token:string){
      const rows=await db<Trial[]>('gateway_trials',{token_hash:`eq.${sha(token)}`,select:'user_id,expires_at,revoked_at,encrypted_upstream',limit:'1'})
      const trial=rows[0]
      if(!trial)throw new AccessError(401,'Chave de acesso inválida.')
      if(!trialActive(trial))throw new AccessError(403,'Seu teste terminou ou foi revogado. Escolha um plano para continuar.')
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      return unseal(trial.encrypted_upstream,secret,`${trial.user_id}:upstream`)
    },
  }
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
export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff')
  try{
    const url=new URL(req.url||'/','https://www.sixtysix.online')
    const action=url.searchParams.get('action')||url.pathname.split('/').pop()
    const service=createAccessService()
    if(action==='trial'){
      if(req.method!=='POST')throw new AccessError(405,'Use POST para ativar seu teste.')
      res.setHeader('Content-Type','application/json; charset=utf-8')
      res.end(JSON.stringify(await service.start(req.headers.authorization)));return
    }
    if(action!=='proxy')throw new AccessError(404,'Operação não encontrada.')
    if(!['GET','HEAD','POST','OPTIONS'].includes(req.method||''))throw new AccessError(405,'Método não permitido.')
    const path=proxyPath(url.searchParams.get('path')||'')
    const single=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined
    const credential=single(req.headers['x-api-key'])||single(req.headers['anthropic-api-key'])||req.headers.authorization||''
    const token=credential.replace(/^Bearer\s+/i,'').trim()
    if(token.length>256)throw new AccessError(401,'Chave inválida.')
    const upstreamToken=token.startsWith('sk-sx-')?await service.authorize(token):token
    const headers:Record<string,string>={}
    for(const key of ['content-type','accept','anthropic-version','anthropic-beta','openai-beta','anthropic-dangerous-direct-browser-access','origin','access-control-request-method','access-control-request-headers']){
      const value=single(req.headers[key]);if(value)headers[key]=value
    }
    if(upstreamToken){headers['x-api-key']=upstreamToken;headers.Authorization=`Bearer ${upstreamToken}`}
    const params=new URLSearchParams(url.searchParams);params.delete('action');params.delete('path')
    const controller=new AbortController()
    req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort()})
    const body=req.method==='POST'?await rawBody(req):undefined
    const response=await fetch(`https://66cloud.vercel.app${path}${params.size?'?'+params:''}`,{
      method:req.method,headers,...(body===undefined?{}:{body:new Uint8Array(body)}),redirect:'manual',signal:controller.signal,
    })
    if(response.status>=300&&response.status<400)throw new AccessError(502,'Redirecionamento inesperado do gateway.')
    res.statusCode=response.status
    for(const key of ['content-type','retry-after','access-control-allow-origin','access-control-allow-headers','access-control-allow-methods']){
      const value=response.headers.get(key);if(value)res.setHeader(key,value)
    }
    if(!response.body||req.method==='HEAD'){res.end();return}
    await new Promise<void>((resolve,reject)=>{
      const stream=Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
      stream.once('error',reject);res.once('error',reject);res.once('finish',resolve);res.once('close',()=>{stream.destroy();resolve()});stream.pipe(res)
    })
  }catch(error){
    if(res.headersSent){res.destroy();return}
    res.statusCode=error instanceof AccessError?error.status:503
    res.setHeader('Content-Type','application/json; charset=utf-8')
    res.end(JSON.stringify({type:'error',error:{type:res.statusCode===401?'authentication_error':'permission_error',message:error instanceof AccessError?error.message:'Conexão temporariamente indisponível.'}}))
  }
}
