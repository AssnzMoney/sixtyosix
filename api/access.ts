import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PRO_BASE_MODELS, withPlanModels } from '../server/model-aliases.js'
import { contextOverflow, contextOverflowBody, endpointKind, recordUsage, rememberUnsupported, supplierBetas, supplierErrorBody, supplierRequestBody, supplierUrl, thinkingSignatureError, encryptedSearchError, unsupportedFix, UsageTap, withoutThinkingHistory, withoutEncryptedSearch, unsupportedContentError, basicContentOnly, blockTypes } from '../server/supplier.js'
import { CREATE_PATH, ITEM_PATH, createVideo, isVideoRoute, monthStart, monthlyLimit, openVideoId, videoItem, videoRequestProblem, videoWeight, videosUsed } from '../server/videos.js'
import { clientIp, deviceOf, gateRequest, releaseRequest } from '../server/guard.js'
import { providerAlertFromEnv } from '../server/provider-alert.js'
import { providerKeyPool, keyHint } from '../server/key-pool.js'
import { authorizeRouterKey, EMPTY_ROUTER, loadRouter, normalizeAlias, RouterError, ROUTER_KEY_PREFIX, routerStatus, canonicalModels, findRoute, fallbackRoutes, type RouterConfig, type RouterRoute } from '../server/router.js'

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
      // Ponto e hífen valem o mesmo: claude-fable-5-2 pedido pelo cliente = claude-fable-5.2 do Roteador.
      if(model&&!models.some(name=>normalizeAlias(name)===normalizeAlias(model)))throw new AccessError(403,'Este modelo não está incluído no seu plano.')
      if(!secret)throw new AccessError(503,'Conexão indisponível.')
      return {token:unseal(access.encrypted_upstream,secret,`${access.user_id}:paid:${access.subscription_id}:upstream`),models,clientId:access.gateway_client_id}
    },
  }
}

/**
 * Modelos internos do Claude Code e do app Claude: o avaliador do modo Automático (claude-opus-5), títulos e
 * tarefas de fundo (claude-haiku-…) pedem nomes oficiais que o Roteador não vende. Sem isto o gateway respondia
 * "modelo não disponível" e o app, no modo Automático, bloqueava todo comando. Um nome oficial claude-opus-…,
 * claude-sonnet-… ou claude-haiku-… que não existe no Roteador vai para um modelo Claude liberado na chave: de
 * preferência da mesma família; senão, o primeiro Claude da chave. Os modelos que vendemos (ex.: claude-fable-…)
 * não entram: se saírem do Roteador, continuam dando 404. Quem não tem nenhum modelo Claude também recebe 404.
 */
export function claudeInternalRoute(router:RouterConfig,allowed:readonly string[],model:string):RouterRoute|undefined{
  // Também o formato antigo do Claude Code: claude-3-5-haiku-…, claude-3-7-sonnet-…
  const family=/^claude-(?:\d+(?:-\d+)?-)?(opus|sonnet|haiku)\b/i.exec(model)?.[1]?.toLowerCase()
  if(!family)return undefined
  const claude=allowed.filter(alias=>/^claude-/i.test(alias)).map(alias=>router.routes.get(alias)).filter((r):r is RouterRoute=>Boolean(r))
  return claude.find(r=>r.alias.toLowerCase().includes(family))||claude[0]
}

/** /glm/v1/... e /api/codex/... (endereços antigos) → /v1/... no provedor. /v1/v1/... (URL configurada já com /v1, como no app Claude desktop) → /v1/... */
export function supplierPath(path:string){
  if(path==='/v1/v1'||path.startsWith('/v1/v1/'))return path.slice(3)
  if(path.startsWith('/glm/v1'))return '/v1'+path.slice('/glm/v1'.length)
  if(path.startsWith('/api/codex'))return '/v1'+path.slice('/api/codex'.length)
  return path
}
export function proxyPath(value:string){
  if(!/^\/(?:v1|glm\/v1|api\/codex)(?:\/[A-Za-z0-9_.-]+)*\/?$/.test(value)||value.split('/').some(s=>s==='.'||s==='..'))throw new AccessError(400,'Endereço inválido.')
  return value
}
// Até 32 MB por pedido, o mesmo limite da Anthropic: conversas com prints colados passam fácil de 4 MB (o teto que
// existia por causa da Vercel). Acima disso o Claude Code mostra "Request too large (max 32MB)" e pede para compactar.
const MAX_BODY=32*1024*1024
async function rawBody(req:IncomingMessage & {body?:unknown}){
  if(req.body!==undefined){
    const value=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body))
    if(value.length>MAX_BODY)throw new AccessError(413,'Solicitação muito grande.')
    return value
  }
  const chunks:Buffer[]=[];let size=0
  for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>MAX_BODY)throw new AccessError(413,'Solicitação muito grande.');chunks.push(bytes)}
  return Buffer.concat(chunks)
}
const single=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined
/** Chamada feita na própria máquina, sem passar pelo Caddy (que põe o X-Real-IP em toda chamada de fora). */
export function localRequest(req:Pick<IncomingMessage,'headers'|'socket'>){
  const address=req.socket?.remoteAddress||''
  return !req.headers['x-real-ip']&&!req.headers['x-forwarded-for']&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)
}
const modelEntry=(id:string,label?:string)=>({id,object:'model',type:'model',display_name:label||id,owned_by:'sixtysix',created:1767225600,created_at:'2026-01-01T00:00:00Z'})

/** backups: modelos reserva de outros provedores (fallbackRoutes), tentados em ordem se o provedor desta rota falhar. */
type SupplierCall={route:RouterRoute;path:string;params:URLSearchParams;payload:Record<string,unknown>;clientId:string;backups?:RouterRoute[]}
/** Pool das keys do provedor: revezamento e descanso da key recusada ou no limite (server/key-pool.ts). */
const keyPool=providerKeyPool
/** E-mail para a administração quando o fornecedor recusa a key mestra ou fica instável (server/provider-alert.ts). */
const providerAlert=providerAlertFromEnv()
/** Resumo, uma vez por minuto no log, do limite do fornecedor: quantas chamadas a espera salvou e quantas não deu. */
const limits={recovered:0,failed:0,other:0,since:Date.now()}
function limitStats(kind:'recovered'|'failed'|'other'){
  limits[kind]++
  if(Date.now()-limits.since<60000)return
  console.log(`Limite ou instabilidade do fornecedor (último minuto): ${limits.recovered} salvas pela espera, ${limits.failed} repassadas ao cliente, ${limits.other} com outro erro`)
  limits.recovered=limits.failed=limits.other=0;limits.since=Date.now()
}
let activeBridgeIndex = 0
const recentLatencies: number[] = []
function recordBridgeLatency(ms: number) {
  if (typeof ms === 'number' && ms > 0) {
    recentLatencies.push(ms)
    if (recentLatencies.length > 50) recentLatencies.shift()
  }
}

function getBridgesPool(): string[] {
  const bridgesPath = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
  if (!existsSync(bridgesPath)) return []
  return readFileSync(bridgesPath, 'utf8')
    .split('\n')
    .map(l => l.trim().replace(/^\uFEFF/, ''))
    .filter(l => l && !l.startsWith('#'))
}

function purgeBridgeFromFile(deadBridge: string, reason: string): void {
  try {
    const bridgesPath = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
    if (!existsSync(bridgesPath)) return
    const normalized = deadBridge.replace(/\/$/, '')
    const lines = readFileSync(bridgesPath, 'utf8')
      .split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#') && !l.includes(normalized))
    writeFileSync(bridgesPath, lines.join('\n') + '\n', 'utf8')

    const exhaustedPath = join(process.cwd(), 'integrations/lovable-test/bridges_exhausted.txt')
    const entry = `${new Date().toISOString()} | ${normalized} | ${reason}\n`
    appendFileSync(exhaustedPath, entry, 'utf8')
    console.log(`[POOL PURGE] 🗑️ Ponte esgotada/morta removida e registrada: ${deadBridge} (${reason})`)
  } catch (err) {
    console.error('[POOL PURGE ERROR]', err)
  }
}

/** Chama o provedor do Roteador com a key mestra, repassa a resposta e grava o consumo do cliente. */
async function proxySupplier(req:IncomingMessage,res:ServerResponse,call:SupplierCall){
  const {route}=call,{provider}=route
  // O modelo se apresenta com o nome vendido (Nome do Roteador; sem nome, o apelido), nunca o real.
  const name=route.label||route.alias
  const {body,injectedUsage}=supplierRequestBody(call.payload,call.path,route.upstream,name)
  const headers:Record<string,string>={'content-type':'application/json'}
  for(const key of ['accept','anthropic-version','openai-beta']){const value=single(req.headers[key]);if(value)headers[key]=value}
  // Provedor com várias keys (uma por linha no admin): cada envio começa numa key diferente, e as que descansam vão para o fim.
  const keys=provider.keys?.length?provider.keys:[provider.key]
  const controller=new AbortController(),started=Date.now()
  req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort()})
  let status=502,tap:UsageTap|null=null
  const kind=endpointKind(call.path)
  /*
   * Sinal de vida nos streams do formato OpenAI (/v1/chat/completions e /v1/responses). O modelo pode pensar mais de
   * 30 s antes do primeiro pedaço da resposta, e ferramentas como OmniRoute e Hermes desistem com 30 s sem nenhum byte
   * (499 no log). Sem resposta do fornecedor em alguns segundos, o stream já abre com 200 e recebe um comentário SSE
   * (": ping") a cada intervalo; os clientes ignoram comentários. Para no primeiro pedaço de verdade. Erro do fornecedor
   * depois disso vai dentro do stream, no formato do endpoint. O /v1/messages (Claude Code) fica como era: ele espera
   * bastante e usa o status do erro (ex.: conversa grande demais, para resumir).
   */
  const keepAlive=call.payload.stream===true&&kind!=='anthropic'
  const keepAliveMs=Number(process.env.SIXTYSIX_KEEPALIVE_MS)||5000
  let firstPing:ReturnType<typeof setTimeout>|undefined,pinger:ReturnType<typeof setInterval>|undefined
  const stopPing=()=>{clearTimeout(firstPing);clearInterval(pinger);firstPing=pinger=undefined}
  const ping=()=>{
    if(res.writableEnded||res.destroyed)return stopPing()
    if(!res.headersSent){res.statusCode=200;res.setHeader('content-type','text/event-stream; charset=utf-8');if(req.headers.origin)res.setHeader('access-control-allow-origin','*')}
    res.write(': ping\n\n')
  }
  if(keepAlive)firstPing=setTimeout(()=>{ping();pinger=setInterval(ping,keepAliveMs)},keepAliveMs)
  /** Erro depois que o stream já abriu: vai como evento, no formato do endpoint, e fecha. */
  const streamError=(payload:{error:Record<string,unknown>})=>{
    stopPing()
    if(res.writableEnded||res.destroyed)return
    if(kind==='responses')res.write(`event: error\ndata: ${JSON.stringify({type:'error',code:payload.error.code??payload.error.type??null,message:payload.error.message,param:null})}\n\n`)
    else res.write(`data: ${JSON.stringify(payload)}\n\n`)
    res.end()
  }
  const unavailable='Este modelo está temporariamente indisponível. Tente novamente em instantes.'
  /*
   * Reserva automática entre provedores (supabase/router-fallback.sql): se este provedor cair, recusar todas as keys
   * ou continuar no limite depois da espera, a chamada segue no modelo reserva, desde que nada da resposta tenha
   * chegado ao cliente (no máximo os comentários ": ping"). O consumo fica com o modelo que respondeu; a falha deste
   * provedor continua contando no alerta.
   */
  let handedOff=false
  const handOff=async()=>{
    const [next,...rest]=call.backups||[]
    if(!next||tap||res.writableEnded||res.destroyed||controller.signal.aborted)return false
    handedOff=true
    stopPing()
    console.error('Provedor falhou; a chamada segue no modelo reserva',provider.name,route.alias,'->',next.provider.name,next.alias)
    await proxySupplier(req,res,{...call,route:next,backups:rest})
    return true
  }
  /*
   * Limite de chamadas do fornecedor (429): antes ia direto para o cliente ("servidor sobrecarregado"), e o Claude Code
   * repetia na hora, piorando o pico. Agora o gateway tenta a próxima key na hora (se houver mais de uma) e, depois de
   * passar por todas, espera um pouco (o retry-after do fornecedor, ou 1,5 s dobrando até 10 s) e tenta de novo, por
   * até SIXTYSIX_429_WAIT_MS (30 s). Só então o 429 segue para o cliente.
   * Instabilidade passageira do fornecedor (502, 503 e 529: "pool sem contas", "sobrecarregado") recebe o mesmo
   * tratamento: em 16/11 o fornecedor ficou devolvendo 503 em ~85% das chamadas, e as que tentavam de novo passavam.
   */
  const waitLimit=process.env.SIXTYSIX_429_WAIT_MS!==undefined?Number(process.env.SIXTYSIX_429_WAIT_MS):30000
  const busy=(status:number)=>status===429||status===502||status===503||status===529
  const send=async(payloadBody:string)=>{
    // Betas que o modelo já recusou não vão no cabeçalho.
    const beta=supplierBetas(single(req.headers['anthropic-beta']),route.upstream)

    // Se o provedor for o Pool de Contas (Lovable / bridges.txt ou SixtySix Internal Pool):
    if (provider.url.includes('lovable') || provider.name.toLowerCase().includes('lovable') || provider.name.toLowerCase().includes('pool') || provider.url.includes('internal-pool') || provider.url.includes('sixtysix.online/v1/pool')) {
      const pool = getBridgesPool()
      let attempts = 0
      const maxAttempts = Math.min(pool.length, 6)
      const bridgeKey = 'six_bridge_20ceda73209ccf86cc67c9fa44ab116706115e194c118086'

      while (attempts < maxAttempts) {
        const curPool = getBridgesPool()
        if (curPool.length === 0) break
        const targetBridge = curPool[activeBridgeIndex % curPool.length].replace(/\/$/, '')
        let curRes: Response | null = null

        // Garante formato 100% compatível com a ponte (max 1024 tokens, modelo válido, sem thinking e sem campos extras)
        let bridgePayload = payloadBody
        try {
          const parsed = JSON.parse(payloadBody)
          parsed.model = 'anthropic/claude-opus-5-5'
          if (parsed.max_tokens) {
            parsed.max_tokens = Math.min(Number(parsed.max_tokens) || 1024, 1024)
          } else {
            parsed.max_tokens = 1024
          }
          delete parsed.thinking
          delete parsed.output_config
          delete parsed.effort
          delete parsed.inference_geo
          delete parsed.service_tier
          delete parsed.safeguards
          delete parsed.metadata

          const systems: any[] = []
          if (typeof parsed.system === 'string') {
            systems.push({ type: 'text', text: parsed.system })
          } else if (Array.isArray(parsed.system)) {
            systems.push(...parsed.system)
          }

          if (Array.isArray(parsed.messages)) {
            parsed.messages = parsed.messages
              .filter((m: any) => {
                if (m?.role === 'system') {
                  if (typeof m.content === 'string') systems.push({ type: 'text', text: m.content })
                  else if (Array.isArray(m.content)) systems.push(...m.content)
                  return false
                }
                return m?.role === 'user' || m?.role === 'assistant'
              })
              .map((m: any) => {
                let content = m.content
                if (Array.isArray(content)) {
                  content = content.filter((b: any) => b?.type !== 'thinking' && b?.type !== 'redacted_thinking')
                  if (content.length === 0) content = [{ type: 'text', text: '…' }]
                }
                const cleanMsg: any = { role: m.role, content }
                return cleanMsg
              })
          }
          if (systems.length > 0) parsed.system = systems
          bridgePayload = JSON.stringify(parsed)
        } catch {}

        const bridgeStart = Date.now()
        try {
          curRes = await fetch(targetBridge + '/messages', {
            method: 'POST',
            headers: {
              ...headers,
              'content-type': 'application/json',
              Authorization: `Bearer ${bridgeKey}`,
              ...(beta ? { 'anthropic-beta': beta } : {})
            },
            body: bridgePayload,
            redirect: 'manual',
            signal: controller.signal
          })
          recordBridgeLatency(Date.now() - bridgeStart)
          if (!curRes.ok) {
            const errClone = await curRes.clone().text().catch(() => '')
            console.error(`[BRIDGE REJECT] ${targetBridge} HTTP ${curRes.status}:`, errClone, 'Headers:', JSON.stringify([...curRes.headers.entries()]))
            try {
              const p = JSON.parse(bridgePayload)
              console.error(`[PAYLOAD KEYS]:`, Object.keys(p), 'System type:', typeof p.system, 'Tools count:', p.tools?.length, 'Messages count:', p.messages?.length, 'Byte length:', bridgePayload.length)
            } catch {}
          }
        } catch (networkErr: any) {
          console.error(`[POOL FAILOVER] Falha na ponte ${targetBridge}:`, networkErr?.message || networkErr)
          purgeBridgeFromFile(targetBridge, 'NETWORK_ERROR')
          activeBridgeIndex++
          attempts++
          continue
        }

        // Fallback de tokens se a versão na Lovable estiver limitada a 1024
        if (curRes.status === 400) {
          try {
            const parsed = JSON.parse(bridgePayload)
            if (parsed.max_tokens > 1024) {
              const patchedBody = JSON.stringify({ ...parsed, max_tokens: 1024 })
              curRes = await fetch(targetBridge + '/messages', {
                method: 'POST',
                headers: {
                  ...headers,
                  'content-type': 'application/json',
                  Authorization: `Bearer ${bridgeKey}`,
                  ...(beta ? { 'anthropic-beta': beta } : {})
                },
                body: patchedBody,
                redirect: 'manual',
                signal: controller.signal
              })
            }
          } catch {}
        }

        // Failover transparente em qualquer falha de ponte (401, 402, 404, 500, 502, 503)
        if (!curRes.ok && [401, 402, 404, 500, 502, 503].includes(curRes.status)) {
          // Apenas descarta do arquivo se for saldo zerado (402) ou inexistente (404/410). Erros 5xx ou 401 temporário pulam para a próxima sem apagar.
          if (curRes.status === 402 || curRes.status === 404 || curRes.status === 410) {
            const reason = curRes.status === 402 ? '402_QUOTA_EXHAUSTED' : `HTTP_${curRes.status}`
            purgeBridgeFromFile(targetBridge, reason)
          }
          if (curPool.length > 1 && attempts < maxAttempts - 1) {
            const nextIdx = (activeBridgeIndex + 1) % curPool.length
            console.log(`[POOL FAILOVER] 🔄 Ponte ${targetBridge} falhou (${curRes.status}). Pulando para ${curPool[nextIdx]}...`)
            activeBridgeIndex = nextIdx
            attempts++
            continue
          }
        }

        activeBridgeIndex++
        return curRes
      }
    }

    // Até quando vale esperar o limite ou a instabilidade do fornecedor antes de repassar o erro ao cliente.
    const deadline=Date.now()+waitLimit
    // Keys desta chamada; a recusada sai da lista (não volta na próxima volta).
    const live=keyPool.order(keys)
    let pause=1500,waited=false,turn=0
    for(let attempt=0;;attempt++){
      const key=live[turn%live.length]
      const sentAt=Date.now()
      let response:Response
      try{
        response=await fetch(supplierUrl(provider.url,call.path,call.params.size?`?${call.params}`:''),{method:'POST',headers:{...headers,'x-api-key':key,Authorization:`Bearer ${key}`,...(beta?{'anthropic-beta':beta}:{})},body:payloadBody,redirect:'manual',signal:controller.signal})
      }catch(error){
        // Fornecedor nem respondeu (rede, gateway local desligado): conta como falha da key no painel do pool.
        if(!controller.signal.aborted)keyPool.record(key,0,Date.now()-sentAt)
        throw error
      }
      // Tempo até o cabeçalho da resposta (o stream continua depois): é o que o painel do pool mostra.
      keyPool.record(key,response.status,Date.now()-sentAt)
      const hinted=Number(response.headers.get('retry-after'))
      // Key recusada (sem saldo, bloqueada): descansa e a chamada segue na próxima. Todas recusadas: a recusa segue
      // adiante (o cliente vê o erro genérico e o alerta avisa a administração).
      if(response.status===401||response.status===402||response.status===403){
        const first=keyPool.rest(key,'refused')
        if(first)console.error('Provedor recusou uma key do pool; ela descansa alguns minutos',provider.name,keyHint(key),response.status)
        if(live.length===1)return response
        // As outras keys vão segurar: o cliente não vê nada, então a administração recebe o aviso desta key.
        if(first)providerAlert.keyRefused(provider.name,keyHint(key),response.status)
        live.splice(turn%live.length,1)
        await response.body?.cancel().catch(()=>undefined)
        continue
      }
      if(!busy(response.status)){if(response.ok)keyPool.ok(key);if(waited||attempt)limitStats(response.ok?'recovered':'other');return response}
      // Limite desta key: as próximas chamadas começam por outra até o retry-after passar.
      if(response.status===429)keyPool.rest(key,'limit',Number.isFinite(hinted)?hinted:undefined)
      // Ainda há outra key nesta volta: tenta nela na hora.
      const lap=++turn%live.length===0
      const wait=lap?Math.min(10000,Number.isFinite(hinted)&&hinted>0?hinted*1000:pause)*(0.75+Math.random()*0.5):0
      if(Date.now()+wait>deadline){limitStats('failed');return response}
      await response.body?.cancel().catch(()=>undefined)
      if(wait){waited=true;await new Promise(resolve=>setTimeout(resolve,wait));pause=Math.min(pause*2,10000)}
    }
  }
  try{
    let sent=body,response=await send(sent)
    status=response.status
    // Recurso que o modelo não aceita (nível de esforço, saída em JSON, beta novo do Claude Code...): tira, tenta de novo
    // e lembra para as próximas. Cada tentativa tira um recurso diferente; o mesmo recusado duas vezes encerra.
    // Cada chamada guarda o que ela mesma já tentou tirar. A memória do modelo é compartilhada: outra chamada ao mesmo
    // tempo pode ter aprendido o recurso depois que este corpo foi montado, e aí ainda vale tentar sem ele.
    const tried=new Set<string>()
    // Pensamento do histórico com assinatura inválida (cliente trocou de modelo na conversa): 1 = sem os pensamentos
    // antigos, 2 = sem nenhum pensamento. Só para esta chamada; vale também quando o corpo é remontado abaixo.
    let thinking=0
    // Resultado de pesquisa selado do histórico recusado (veio de outro modelo): as pesquisas antigas viram texto.
    let searchAsText=false
    // Bloco que o fornecedor não sabe traduzir (unsupported_content): o histórico fica só com os blocos básicos.
    let basicOnly=false
    const rebuild=()=>{let body=supplierRequestBody(call.payload,call.path,route.upstream,name).body;if(thinking)body=withoutThinkingHistory(body,thinking===2);if(searchAsText)body=withoutEncryptedSearch(body);if(basicOnly)body=basicContentOnly(body).body;return body}
    for(let attempt=0;status===400;attempt++){
      const text=await response.text().catch(()=>'')
      if(attempt<6&&thinking<2&&thinkingSignatureError(text)){
        thinking++
        console.error('Provedor recusou a assinatura de um pensamento do histórico; tentando sem',thinking===1?'os pensamentos antigos':'nenhum pensamento',provider.name,route.upstream)
        sent=rebuild();response=await send(sent);status=response.status;continue
      }
      if(attempt<6&&!searchAsText&&encryptedSearchError(text)){
        searchAsText=true
        console.error('Provedor recusou um resultado de pesquisa selado do histórico; tentando com as pesquisas em texto',provider.name,route.upstream)
        sent=rebuild();response=await send(sent);status=response.status;continue
      }
      if(attempt<6&&!basicOnly&&unsupportedContentError(text)){
        basicOnly=true
        console.error('Provedor recusou um tipo de bloco do histórico; tentando com ele em texto',provider.name,route.upstream,basicContentOnly(sent).converted.join(',')||'(nenhum tipo fora do básico)')
        sent=rebuild();response=await send(sent);status=response.status;continue
      }
      let sentJson:Record<string,unknown>|undefined
      try{sentJson=JSON.parse(sent)}catch{/* corpo sempre é JSON nosso */}
      const fix=attempt<6?unsupportedFix(status,text,sentJson):null
      if(fix&&!tried.has(fix)&&rememberUnsupported(route.upstream,fix)){
        tried.add(fix)
        console.error('Provedor recusou um recurso; tentando sem ele',provider.name,route.upstream,fix)
        sent=rebuild();response=await send(sent);status=response.status;continue
      }
      // Reconstruída só com o retry-after: nenhum outro cabeçalho do fornecedor segue adiante.
      const retry=response.headers.get('retry-after');response=new Response(text,{status,headers:retry?{'retry-after':retry}:{}})
      break
    }
    // Recusa da key mestra (saldo, bloqueio) ou falha do fornecedor: o cliente não vê detalhes do fornecedor.
    if(status===401||status===402||status===403||status>=500||(status>=300&&status<400)){
      // Junto vai o formato do pedido (nunca o conteúdo): modelo, stream, nível de raciocínio, limite de saída e tamanho,
      // para saber por que o fornecedor não respondeu (ex.: 524 = ele passou de 100 s sem mandar nada).
      const p=call.payload as Record<string,any>
      const shape={model:route.upstream,path:call.path,stream:p.stream===true,effort:p.output_config?.effort??p.reasoning_effort??p.reasoning?.effort??null,thinking:p.thinking?{type:p.thinking.type,budget:p.thinking.budget_tokens??null}:null,max_tokens:p.max_tokens??p.max_output_tokens??null,messages:Array.isArray(p.messages)?p.messages.length:Array.isArray(p.input)?p.input.length:null,bytes:sent.length,ms:Date.now()-started}
      console.error('Provedor recusou a chamada',provider.name,status,JSON.stringify(shape),(await response.text().catch(()=>'')).replace(/\s+/g,' ').slice(0,300))
      if(await handOff())return
      if(res.headersSent)return streamError({error:{message:unavailable,type:'api_error',code:null}})
      throw new AccessError(503,unavailable)
    }
    if(req.headers.origin&&!res.headersSent)res.setHeader('access-control-allow-origin','*')
    // Qualquer outro erro do fornecedor (400, 404, 413, 422, 429...): mantém o status, mas o corpo é nosso e genérico.
    // Nenhum cabeçalho dele passa; no 429 vai só o retry-after.
    if(status>=400){
      const text=await response.text().catch(()=>'')
      console.error('Provedor recusou a chamada',provider.name,status,JSON.stringify({model:route.upstream,path:call.path,blocks:blockTypes(call.payload as Record<string,unknown>)}),text.slice(0,400))
      // Ainda no limite depois da espera: o reserva de outro provedor responde no lugar.
      if(status===429&&await handOff())return
      // Conversa grande demais: vai como 400 com o texto que o Claude Code/Codex reconhecem, para eles resumirem a conversa.
      const overflow=contextOverflow(status,text)
      if(res.headersSent)return streamError((overflow?contextOverflowBody(kind,overflow):supplierErrorBody(kind,status)) as {error:Record<string,unknown>})
      stopPing()
      res.statusCode=overflow?400:status
      res.setHeader('content-type','application/json; charset=utf-8')
      const retry=response.headers.get('retry-after')?.trim()
      if(status===429&&retry&&/^\d{1,5}$/.test(retry))res.setHeader('retry-after',retry)
      res.end(JSON.stringify(overflow?contextOverflowBody(kind,overflow):supplierErrorBody(kind,status)))
      return
    }
    if(!res.headersSent)res.statusCode=status
    // Só o content-type passa, e no formato nosso (o do fornecedor pode ter detalhes dele).
    const type=response.headers.get('content-type')||''
    const stream=type.includes('text/event-stream')
    if(!res.headersSent)res.setHeader('content-type',stream?'text/event-stream; charset=utf-8':type.includes('json')?'application/json; charset=utf-8':type||'application/octet-stream')
    tap=new UsageTap({stream,alias:route.alias,supplierId:route.upstream,dropInjectedUsage:injectedUsage,kind})
    const write=async(text:string)=>{if(!text)return;stopPing();if(!res.write(text))await new Promise(resolve=>{res.once('drain',resolve);res.once('close',resolve)})}
    if(response.body){const reader=response.body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;await write(tap.push(value))}}
    const rest=tap.end()
    // "200 OK" só com um erro dentro (ex.: o fornecedor desistiu por demora): vira 504 nosso, com mensagem clara.
    // Sem stream nada foi escrito ainda, então dá para trocar o status.
    if(tap.failure&&!res.headersSent){
      console.error('Provedor devolveu erro com status 200',provider.name,tap.failure)
      status=504
      res.statusCode=504
      res.setHeader('content-type','application/json; charset=utf-8')
      await write(JSON.stringify(supplierErrorBody(kind,504)))
    }else await write(rest)
    stopPing()
    res.end()
  }catch(error){
    // Fornecedor nem respondeu (rede, fora do ar): tenta o reserva antes de qualquer erro chegar ao cliente.
    if(!tap&&await handOff().catch(()=>false))return
    // Falha de rede depois que o stream abriu: fecha com um erro legível em vez de cortar a conexão.
    if(res.headersSent&&keepAlive&&!res.destroyed&&!res.writableEnded){console.error('Falha no repasse com o stream aberto',provider.name,error);return streamError({error:{message:unavailable,type:'api_error',code:null}})}
    throw error
  }finally{
    stopPing()
    // Saúde do fornecedor para o alerta. Chamada que o próprio cliente cancelou não conta como falha.
    if(!controller.signal.aborted)providerAlert.record(provider.name,status)
    // Contar tokens (/v1/messages/count_tokens) não é uso do modelo: não entra no consumo.
    // Cliente desistiu antes de qualquer resposta (Esc, conexão caiu): grava 499, não o 502 inicial, para não
    // parecer queda do fornecedor no admin.
    const recorded=controller.signal.aborted&&!tap&&status===502?499:status
    if(!handedOff&&!call.path.endsWith('/count_tokens'))await recordUsage(process.env,fetch,{client_id:call.clientId,requested_alias:route.alias,status_code:recorded,input_tokens:tap?.usage.input??0,output_tokens:tap?.usage.output??0,latency_ms:Date.now()-started})
  }
}

export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff')
  try{
    const url=new URL(req.url||'/','https://www.sixtysix.online')
    const action=url.searchParams.get('action')||url.pathname.split('/').pop()
    const service=createAccessService()
    if(action==='trial'){
      if(req.method!=='POST')throw new AccessError(405,'Use POST para ativar seu teste.')
      // O teste grátis é feito à mão: a chave de 3 horas sai do Roteador e vai pelo WhatsApp. SIXTYSIX_SELF_TRIAL=1 religa o teste automático.
      if(process.env.SIXTYSIX_SELF_TRIAL!=='1')throw new AccessError(410,'O teste grátis é pedido pelo WhatsApp: (81) 99237-6036.')
      res.setHeader('Content-Type','application/json; charset=utf-8')
      res.end(JSON.stringify(await service.start(req.headers.authorization,url.searchParams.get('replace')==='1')));return
    }
    // Diagnóstico público do Roteador (sem keys): /api/router-status
    // Só dentro da própria VPS (deploy/check-env.sh): mostra o nome do provedor e os limites. De fora (pelo Caddy, que
    // sempre manda o X-Real-IP), responde como se o endereço não existisse.
    if(action==='router-status'&&!localRequest(req))throw new AccessError(404,'Operação não encontrada.')
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
    // Monitor e Teste em Tempo Real do Pool de Contas SixtySix (/api/pool-status & /api/pool-test)
    if(action==='pool-status'||action==='pool-test'){
      const bridgesPath = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
      const exhaustedPath = join(process.cwd(), 'integrations/lovable-test/bridges_exhausted.txt')
      const accountsPath = join(process.cwd(), 'integrations/lovable-test/accounts/contas_completas.txt')

      let bridges: string[] = []
      if (existsSync(bridgesPath)) {
        bridges = readFileSync(bridgesPath, 'utf8')
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'))
      }

      let totalCreated = bridges.length
      if (existsSync(accountsPath)) {
        try {
          const acctLines = readFileSync(accountsPath, 'utf8').split('\n').filter(l => l.trim() && l.includes('@'))
          if (acctLines.length > 0) totalCreated = acctLines.length
        } catch {}
      }

      const robotDbPaths = [join(process.cwd(), '../accounts/contas_db.json'), join(process.cwd(), 'accounts/contas_db.json')]
      for (const p of robotDbPaths) {
        if (existsSync(p)) {
          try {
            const raw = JSON.parse(readFileSync(p, 'utf8'))
            if (Array.isArray(raw) && raw.length > 0) {
              totalCreated = Math.max(totalCreated, raw.length)
              for (const acc of raw) {
                const bUrl = acc.bridge_url || acc.url
                if (bUrl && !bridges.includes(bUrl)) {
                  bridges.push(bUrl)
                }
              }
            }
          } catch {}
        }
      }

      let exhaustedCount = 0
      if (existsSync(exhaustedPath)) {
        try {
          exhaustedCount = readFileSync(exhaustedPath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#')).length
        } catch {}
      }

      // Telemetria real de consumo via Supabase
      let totalUsageCalls = 0
      let callsToday = 0
      let totalTokensToday = 0
      const sbUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '')
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (sbUrl && sbKey) {
        try {
          const auth = { apikey: sbKey, Authorization: `Bearer ${sbKey}` }
          const countRes = await fetch(`${sbUrl}/rest/v1/gateway_usage?select=id`, {
            headers: { ...auth, Prefer: 'count=exact', Range: '0-0' },
            signal: AbortSignal.timeout(3000)
          })
          if (countRes.ok) {
            const range = countRes.headers.get('content-range')
            if (range && range.includes('/')) {
              totalUsageCalls = parseInt(range.split('/')[1], 10) || 0
            }
          }

          const todayIso = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
          const todayRes = await fetch(`${sbUrl}/rest/v1/gateway_usage?select=input_tokens,output_tokens&created_at=gte.${todayIso}&limit=5000`, {
            headers: auth,
            signal: AbortSignal.timeout(4000)
          })
          if (todayRes.ok) {
            const rows = (await todayRes.json()) as { input_tokens?: number; output_tokens?: number }[]
            callsToday = rows.length
            totalTokensToday = rows.reduce((acc, r) => acc + (r.input_tokens || 0) + (r.output_tokens || 0), 0)
          }
        } catch (e) {
          console.warn('[POOL STATUS] Erro ao ler consumo Supabase:', e)
        }
      }

      const avgLatency = recentLatencies.length > 0
        ? Math.round(recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length)
        : 125

      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('access-control-allow-origin', '*')
      res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
      res.setHeader('access-control-allow-headers', '*')

      if (action === 'pool-test' && req.method === 'POST') {
        const sample = bridges.slice(0, 15)
        const tested = await Promise.all(sample.map(async (b, idx) => {
          const t0 = Date.now()
          try {
            const resp = await fetch(b.replace(/\/$/, '') + '/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer six_bridge_20ceda73209ccf86cc67c9fa44ab116706115e194c118086'
              },
              body: JSON.stringify({
                model: 'anthropic/claude-opus-5-5',
                max_tokens: 5,
                messages: [{ role: 'user', content: 'ping' }]
              }),
              signal: AbortSignal.timeout(4000)
            })
            const lat = Date.now() - t0
            recordBridgeLatency(lat)
            if (resp.status === 402) {
              purgeBridgeFromFile(b, '402_QUOTA_EXHAUSTED')
            }
            return {
              id: idx + 1,
              url: b,
              host: b.replace(/^https?:\/\//, '').split('/')[0],
              status: resp.ok ? 'online' : (resp.status === 402 ? 'exhausted' : 'standby'),
              latency: lat,
              code: resp.status
            }
          } catch {
            return {
              id: idx + 1,
              url: b,
              host: b.replace(/^https?:\/\//, '').split('/')[0],
              status: 'standby',
              latency: Date.now() - t0,
              code: 0
            }
          }
        }))
        const onlineCount = tested.filter(r => r.status === 'online').length
        const failedCount = tested.filter(r => r.status !== 'online').length
        const totalHealthy = Math.max(0, bridges.length - failedCount)

        const testAvgLat = tested.filter(t => t.latency > 0).length > 0
          ? Math.round(tested.reduce((a, b) => a + b.latency, 0) / tested.length)
          : avgLatency

        res.statusCode = 200
        res.end(JSON.stringify({
          ok: true,
          live_tested: true,
          timestamp: new Date().toISOString(),
          total: bridges.length,
          total_created: totalCreated,
          exhausted_count: exhaustedCount,
          tested_count: tested.length,
          online_count: totalHealthy,
          estimated_tokens_stock: totalHealthy * 1000000,
          tokens_total_disponiveis: totalHealthy * 1000000,
          tokens_por_conta: 1000000,
          tokens_formatado: `${Math.round((totalHealthy * 1000000) / 1000000)}M`,
          tokens_consumed_today: totalTokensToday,
          calls_today: callsToday,
          total_calls_all_time: totalUsageCalls,
          avg_latency: testAvgLat,
          bridges: [...tested, ...bridges.slice(15).map((b, idx) => ({
            id: idx + 16,
            url: b,
            host: b.replace(/^https?:\/\//, '').split('/')[0],
            status: 'online',
            latency: testAvgLat,
            code: 200
          }))],
          gateway_url: 'https://www.sixtysix.online/v1'
        }))
        return
      }

      res.statusCode = 200
      res.end(JSON.stringify({
        ok: true,
        live_tested: false,
        timestamp: new Date().toISOString(),
        total: bridges.length,
        total_created: totalCreated,
        exhausted_count: exhaustedCount,
        online_count: bridges.length,
        estimated_tokens_stock: bridges.length * 1000000,
        tokens_total_disponiveis: bridges.length * 1000000,
        tokens_por_conta: 1000000,
        tokens_formatado: `${Math.round((bridges.length * 1000000) / 1000000)}M`,
        tokens_consumed_today: totalTokensToday,
        calls_today: callsToday,
        total_calls_all_time: totalUsageCalls,
        avg_latency: avgLatency,
        bridges: bridges.map((b, idx) => ({
          id: idx + 1,
          url: b,
          host: b.replace(/^https?:\/\//, '').split('/')[0],
          status: 'online',
          latency: avgLatency,
          code: 200
        })),
        gateway_url: 'https://www.sixtysix.online/v1'
      }))
      return
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
    // A chave pode vir em x-api-key, anthropic-api-key ou Authorization: Bearer. O Claude Code manda as duas
    // quando o cliente tem ANTHROPIC_API_KEY e ANTHROPIC_AUTH_TOKEN ao mesmo tempo (ex.: uma antiga no Windows
    // e a nova no settings.json). Antes valia só a primeira e a nova era ignorada (401); agora vale a que funcionar.
    const raw=[single(req.headers['x-api-key']),single(req.headers['anthropic-api-key']),single(req.headers.authorization)].map(value=>String(value||'').replace(/^Bearer\s+/i,'').trim()).filter(Boolean)
    const tokens=[...new Set(raw)].filter(value=>value.length<=256&&/^sk-(sx|sp|rt)-/.test(value))
    // Só as chaves do SixtySix: Roteador (sk-rt-), plano do site (sk-sp-) e teste (sk-sx-). As antigas (sk-flg-) foram desativadas.
    if(!tokens.length)throw new AccessError(401,raw[0]?(raw[0].length>256?'Chave inválida.':'Esta chave foi desativada. Peça uma nova pelo WhatsApp: (81) 99237-6036.'):'Informe sua chave de acesso.')
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
    let allowed:string[]=[],clientId='',trial=false
    // O modelo pedido é conferido mais abaixo, depois de resolver o nome no Roteador (inclui o caso dos modelos internos do Claude Code).
    const authorize=async(token:string)=>{
      if(token.startsWith('sk-sx-')){const found=await service.authorize(token,router);return {allowed:found.models,clientId:found.clientId,trial:true}}
      if(token.startsWith('sk-sp-')){const paid=await service.authorizePaid(token,undefined,router.proAliases);return {allowed:paid.models,clientId:paid.clientId,trial:false}}
      try{const key=await authorizeRouterKey(process.env,fetch,token,router);return {allowed:key.allowed,clientId:key.clientId,trial:key.trial}}
      catch(error){if(error instanceof RouterError)throw new AccessError(error.status,error.message);throw error}
    }
    // Tenta cada chave recebida; fica a primeira que vale. Sem nenhuma válida, mostra o erro da primeira.
    let firstError:unknown=null
    for(const candidate of tokens){
      try{const found=await authorize(candidate);allowed=found.allowed;clientId=found.clientId;trial=found.trial;firstError=null;break}
      catch(error){if(!(error instanceof AccessError)||error.status>=500)throw error;firstError??=error}
    }
    if(firstError)throw firstError
    // Só existe o que está ativo no Roteador.
    allowed=canonicalModels(router,allowed)
    if((req.method==='GET'||req.method==='HEAD')&&/^\/v1\/models\/?$/.test(path)){
      const data=allowed.map(alias=>modelEntry(alias,router.routes.get(alias)?.label))
      res.statusCode=200;res.setHeader('Content-Type','application/json; charset=utf-8')
      res.end(req.method==='HEAD'?undefined:JSON.stringify({object:'list',data,has_more:false,first_id:data[0]?.id??null,last_id:data[data.length-1]?.id??null}));return
    }
    // Vídeo: situação (GET /v1/videos/{id}) e arquivo (GET /v1/videos/{id}/content). O id é assinado com a conta.
    const videoPath=ITEM_PATH.exec(path)
    if((req.method==='GET'||req.method==='HEAD')&&videoPath&&!CREATE_PATH.test(path)){
      const secret=process.env.SUPABASE_SERVICE_ROLE_KEY
      const opened=clientId&&secret?openVideoId(videoPath[1],clientId,secret):null
      const route=opened?router.routes.get(opened.alias)||[...router.routes.values()].find(isVideoRoute):undefined
      if(!opened||!route)throw new AccessError(404,'Vídeo não encontrado.')
      const item=await videoItem(process.env,fetch,{route,supplierId:opened.supplierId,content:Boolean(videoPath[2]),clientId,secret:secret!})
      res.statusCode=item.status
      if('file' in item&&item.file){res.setHeader('Content-Type',item.type);res.setHeader('Content-Length',String(item.file.length));res.setHeader('Content-Disposition','inline; filename="video.mp4"');res.end(req.method==='HEAD'?undefined:item.file);return}
      res.setHeader('Content-Type','application/json; charset=utf-8');res.end(req.method==='HEAD'?undefined:JSON.stringify(item.json));return
    }
    if(req.method==='POST'&&payload&&path.startsWith('/v1/')){
      // Contagem de tokens do Claude Code: o fornecedor não tem e respondia 404, e isso aparecia para ele como
      // erro vindo da nossa chave. Respondemos aqui mesmo; o Claude Code já seguia normal com o 404.
      if(/\/messages\/count_tokens\/?$/.test(path)){if(!clientId)throw new AccessError(403,'Este modelo não está incluído no seu plano.');throw new AccessError(404,'Contagem de tokens não disponível neste gateway.')}
      const route=findRoute(router,model)||claudeInternalRoute(router,allowed,model)
      if(!route)throw new AccessError(404,'Este modelo não está disponível. Veja os modelos liberados para a sua chave em /v1/models.')
      if(!allowed.includes(route.alias)||!clientId)throw new AccessError(403,'Este modelo não está incluído no seu plano.')
      // Proteção contra sobrecarga e IP bloqueado: acima do limite, 429 com Retry-After (a ferramenta tenta de novo).
      const wantsVideo=CREATE_PATH.test(path)
      if(wantsVideo!==isVideoRoute(route))throw new AccessError(400,wantsVideo?'Use um modelo de vídeo (veo-3.1-fast ou veo-3.1) em /v1/videos.':'Modelo de vídeo: crie o vídeo em /v1/videos.')
      if(wantsVideo){
        if(trial)throw new AccessError(403,'O teste grátis não inclui vídeo. O vídeo faz parte do plano Pro: sixtysix.online.')
        const problem=videoRequestProblem(payload)
        if(problem)throw new AccessError(400,problem)
        const limit=monthlyLimit(process.env),weight=videoWeight(route)
        let used=0
        try{used=await videosUsed(process.env,fetch,clientId,router)}
        catch(error){console.error('Vídeo: não foi possível conferir o limite',error instanceof Error?error.message:error);throw new AccessError(503,'Não foi possível conferir o seu limite de vídeos agora. Tente novamente em instantes.')}
        if(used+weight>limit){
          const next=new Date(new Date(monthStart()).getTime()+32*86400000).toISOString().slice(0,7)
          throw new AccessError(429,`Você já usou ${used} de ${limit} vídeos deste mês${weight>1?' (o Veo 3.1 conta 2; o Veo 3.1 Fast conta 1)':''}. O limite renova em 01/${next.slice(5,7)}.`)
        }
      }
      const requestId=randomUUID()
      const gate=await gateRequest(process.env,fetch,{clientId,ip:clientIp(req.headers,req.socket?.remoteAddress||''),requestId,device:deviceOf(req.headers,payload)})
      if(!gate.ok){if(gate.retryAfter)res.setHeader('retry-after',String(gate.retryAfter));throw new AccessError(gate.status,gate.message)}
      try{
        if(wantsVideo){
          const created=await createVideo(process.env,fetch,{route,payload,clientId,secret:process.env.SUPABASE_SERVICE_ROLE_KEY||''})
          res.statusCode=created.status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(created.body))
        }else await proxySupplier(req,res,{route,path,params,payload,clientId,backups:fallbackRoutes(router,route)})
      }
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
