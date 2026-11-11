import { createHash, randomBytes } from 'node:crypto'
import { PRO_BASE_MODELS, withPlanModels } from '../server/model-aliases.js'
import { canonicalModels, loadRouter } from '../server/router.js'
import { CONFIRMATION_TEXT_VERSION, deliveryConfirmationText, deliveryState, type DeliveryRow } from '../src/lib/deliveries.js'
import { emailConfig, type EmailConfig } from '../server/email.js'
import { createNotifier, userFromAuth } from '../server/notifications.js'

type Config = { url: string; secret: string; publicKey: string;billingConnected?:boolean }
type Client = { id: string; name: string; enabled: boolean; created_at: string; key_prefix: string | null;managed?:boolean;visible?:boolean;expires?:string|null }
type Subscription = {id:string;plan_code:string;amount_cents:number;api_enabled:boolean;models:string[];paid_until:string|null;provider_status:string;created_at:string;entitled:boolean;billing_mode:string}
type PaidAccess = {subscription_id:string;gateway_client_id:string;token_prefix:string;paid_until:string|null;revoked_at:string|null;api_enabled:boolean;created_at:string;entitled:boolean;billing_mode:string}
type Trial = { gateway_client_id:string; token_prefix:string; created_at:string; expires_at:string; revoked_at:string|null }
type Usage = { id: number; client_id: string; requested_alias: string; status_code: number; input_tokens: number; output_tokens: number; latency_ms: number; created_at: string }
export class AccountError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function configuration(env = process.env): Config {
  const url = env.SUPABASE_URL?.replace(/\/+$/, '')
  const secret = env.SUPABASE_SERVICE_ROLE_KEY
  const publicKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !secret || !publicKey) throw new AccountError(503, 'A conexão do painel está sendo configurada. Tente novamente em instantes.')
  if (!url.startsWith('https://')) throw new AccountError(503, 'Configuração de conexão inválida.')
  return { url, secret, publicKey,billingConnected:Boolean(env.MERCADOPAGO_ACCESS_TOKEN&&env.MERCADOPAGO_WEBHOOK_SECRET) }
}

export function createAccountService(config: Config, request: typeof fetch = fetch, email: EmailConfig | null = null) {
  const headers = { apikey: config.secret, ...(!config.secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${config.secret}` } : {}), 'Content-Type': 'application/json' }
  async function db<T>(resource: string, query: Record<string, string> = {}, method = 'GET', body?: unknown): Promise<T> {
    const response = await request(`${config.url}/rest/v1/${resource}?${new URLSearchParams(query)}`, {
      method, headers: { ...headers, Prefer: 'return=representation' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const code = (await response.json().catch(() => ({}))) as { code?: string }
      if (code.code === 'P0001') throw new AccountError(403, 'Acesso não disponível. Confira sua chave ou solicite a liberação do teste.')
      throw new AccountError(503, 'Não foi possível consultar sua conta. Tente novamente.')
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : null) as T
  }
  async function identity(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16000) throw new AccountError(401, 'Entre na sua conta para continuar.')
    const response = await request(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.publicKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new AccountError(response.status >= 500 ? 503 : 401, 'Sua sessão não pôde ser validada. Entre novamente.')
    const user = await response.json() as { id?: string; is_anonymous?: boolean; email_confirmed_at?: string }
    if (!user.id || !uuid.test(user.id) || user.is_anonymous) throw new AccountError(401, 'Entre com uma conta válida.')
    if (!user.email_confirmed_at) throw new AccountError(403, 'Confirme seu e-mail para acessar as chaves e o consumo da sua conta.')
    return user.id
  }
  async function clients(userId: string) {
    return db<Client[]>('gateway_clients', { user_id: `eq.${userId}`, select: 'id,name,enabled,created_at,key_prefix', order: 'created_at.desc' })
  }
  return {
    async execute(method: string, path: string, authorization?: string, body: Record<string, unknown> = {}, query = new URLSearchParams(), meta: { ip?: string; userAgent?: string } = {}) {
      const userId = await identity(authorization)
      if (method === 'GET' && path === 'summary') {
        const from = query.get('from') || new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10)
        const to = query.get('to') || new Date().toISOString().slice(0,10)
        if (![from,to].every(day => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day) || from > to || Date.parse(to) - Date.parse(from) > 365 * 86400000) throw new AccountError(400, 'Escolha um intervalo válido de até 366 dias.')
        const timezone = Number(query.get('timezone') || 0)
        if (!Number.isInteger(timezone) || Math.abs(timezone) > 840) throw new AccountError(400, 'Fuso horário inválido.')
        const asOf = query.get('asOf') || new Date().toISOString()
        if (!Number.isFinite(Date.parse(asOf)) || Date.parse(asOf) > Date.now() + 60000) throw new AccountError(400, 'Intervalo inválido.')
        const start = new Date(Date.parse(from) + timezone * 60000).toISOString()
        const end = new Date(Date.parse(to) + 86400000 + timezone * 60000).toISOString()
        const offset = Number(query.get('offset') || 0)
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) throw new AccountError(400, 'Página inválida.')
        const mine = await clients(userId)
        // Chaves do Roteador ligadas a esta conta: validade e bloqueio vêm de router_keys.
        if (mine.length) {
          const routerKeys = await db<{ gateway_client_id: string; expires_at: string; revoked_at: string | null }[]>('router_keys', {
            gateway_client_id: `in.(${mine.map(c => c.id).join(',')})`, select: 'gateway_client_id,expires_at,revoked_at',
          }).catch(() => [])
          for (const k of routerKeys) {
            const client = mine.find(c => c.id === k.gateway_client_id)
            if (!client) continue
            client.name = 'Chave SixtySix'
            client.enabled = !k.revoked_at && Date.parse(k.expires_at) > Date.now()
            client.managed = true
            client.expires = k.expires_at
          }
        }
        const trials = await db<Trial[]>('gateway_trials', { user_id:`eq.${userId}`,select:'gateway_client_id,token_prefix,created_at,expires_at,revoked_at',limit:'1' })
        const trial=trials[0]
        if(trial) mine.push({id:trial.gateway_client_id,name:'Teste grátis · 7 dias',enabled:!trial.revoked_at && Date.parse(trial.expires_at)>Date.now(),created_at:trial.created_at,key_prefix:trial.token_prefix,managed:true})
        const paid=await db<PaidAccess[]>('billing_key_access',{user_id:`eq.${userId}`,select:'subscription_id,gateway_client_id,token_prefix,paid_until,revoked_at,api_enabled,created_at,entitled'})
        const subscriptions=await db<Subscription[]>('billing_subscription_state',{user_id:`eq.${userId}`,select:'id,plan_code,amount_cents,api_enabled,models,paid_until,provider_status,created_at,entitled,billing_mode',order:'created_at.desc',limit:'50'})
        for(const access of paid)mine.push({id:access.gateway_client_id,name:'Assinatura · '+(access.api_enabled?'API':'Site'),enabled:access.entitled&&!access.revoked_at&&Boolean(access.paid_until&&Date.parse(access.paid_until)>Date.now()),created_at:access.created_at,key_prefix:access.token_prefix,managed:true,visible:access.api_enabled})
        const router=await loadRouter({SUPABASE_URL:config.url,SUPABASE_SERVICE_ROLE_KEY:config.secret},request)
        const selected=subscriptions.find(item=>item.entitled&&item.paid_until&&Date.parse(item.paid_until)>Date.now())||subscriptions[0]
        const subscription=selected?{id:selected.id,plan:selected.plan_code,name:selected.plan_code==='pro'?'Pro':selected.plan_code==='devApi'?'Dev + API':'Dev',amount:selected.amount_cents/100,api:selected.api_enabled,models:canonicalModels(router,withPlanModels(selected.models,router.proAliases)),active:selected.entitled&&Boolean(selected.paid_until&&Date.parse(selected.paid_until)>Date.now()),expires:selected.paid_until,status:selected.provider_status,mode:selected.billing_mode}:null
        const usage = mine.length ? await db<Usage[]>('gateway_usage', {
          select: 'id,client_id,requested_alias,status_code,input_tokens,output_tokens,latency_ms,created_at',
          client_id: `in.(${mine.map(c => c.id).join(',')})`, and: `(created_at.gte.${start},created_at.lt.${end},created_at.lte.${new Date(asOf).toISOString()})`,
          order: 'created_at.desc,id.desc', limit: '1000', offset: String(offset),
        }) : []
        return { keys: mine.filter(c=>c.visible!==false).map(c => ({ id: c.id, name: c.name, prefix: c.key_prefix || 'Chave anterior', active: c.enabled, created: c.created_at,managed:Boolean(c.managed),expires:c.expires||null })), usage, hasMore: usage.length === 1000, subscription, billingConnected:Boolean(config.billingConnected),
          trial:trial?{expires:trial.expires_at,active:!trial.revoked_at && Date.parse(trial.expires_at)>Date.now(),revoked:Boolean(trial.revoked_at),models:canonicalModels(router,withPlanModels(PRO_BASE_MODELS,router.proAliases))}:null }
      }
      // Chaves antigas do gateway (sk-flg-) foram desativadas: a chave agora sai do Roteador e é entregue pelo WhatsApp.
      if (method === 'POST' && (path === 'claim' || path === 'keys')) {
        throw new AccountError(410, 'As chaves antigas foram desativadas. Peça sua chave pelo WhatsApp: (81) 99237-6036.')
      }
      if (method === 'POST' && path === 'claim') {
        const key = typeof body.key === 'string' ? body.key.trim() : ''
        if (!/^sk-flg-[A-Za-z0-9_-]{30,100}$/.test(key)) throw new AccountError(400, 'Cole sua chave individual completa, iniciada por sk-flg-.')
        await db('rpc/account_claim_gateway_key', {}, 'POST', { p_user_id: userId, p_token_hash: hash(key), p_prefix: key.slice(0,14) })
        return { ok: true }
      }
      if (method === 'POST' && path === 'keys') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name || name.length > 80) throw new AccountError(400, 'Dê um nome à chave com até 80 caracteres.')
        const key = `sk-flg-${randomBytes(32).toString('base64url')}`
        const created = await db('rpc/account_issue_gateway_key', {}, 'POST', { p_user_id: userId, p_name: name, p_token_hash: hash(key), p_prefix: key.slice(0,14) })
        return { key, created }
      }
      if (method === 'POST' && path === 'revoke') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!uuid.test(id)) throw new AccountError(400, 'Chave inválida.')
        const trialRevoked=await db<boolean>('rpc/account_revoke_trial',{},'POST',{p_user_id:userId,p_client_id:id})
        if(trialRevoked)return {ok:true}
        if(await db<boolean>('rpc/billing_revoke_key',{},'POST',{p_user_id:userId,p_client_id:id}))return {ok:true}
        const updated = await db<Client[]>('gateway_clients', { id: `eq.${id}`, user_id: `eq.${userId}`, enabled: 'eq.true', select: 'id' }, 'PATCH', { enabled: false, revoked_at: new Date().toISOString() })
        if (!updated.length) throw new AccountError(404, 'Chave não encontrada ou já revogada.')
        return { ok: true }
      }
      // Credenciais do fornecedor entregues pelo WhatsApp (só o final da chave; nunca o segredo).
      if (method === 'GET' && path === 'credentials') {
        let rows: DeliveryRow[]
        try {
          rows = await db<DeliveryRow[]>('credential_deliveries', {
            user_id: `eq.${userId}`,
            select: 'id,product,key_hint,base_url,model_id,delivered_at,expires_at,replaced_at,revoked_at,confirmed_at',
            order: 'delivered_at.desc', limit: '30',
          })
        } catch {
          return { available: false, credentials: [] }
        }
        return { available: true, credentials: rows.map(row => ({ ...row, state: deliveryState(row) })) }
      }
      if (method === 'POST' && path === 'confirm-delivery') {
        const id = typeof body.id === 'string' ? body.id : ''
        if (!uuid.test(id)) throw new AccountError(400, 'Credencial inválida.')
        const rows = await db<DeliveryRow[]>('credential_deliveries', {
          id: `eq.${id}`, user_id: `eq.${userId}`,
          select: 'id,product,key_hint,base_url,model_id,delivered_at,expires_at,replaced_at,revoked_at,confirmed_at', limit: '1',
        })
        const row = rows[0]
        if (!row) throw new AccountError(404, 'Credencial não encontrada.')
        if (row.confirmed_at) return { confirmed_at: row.confirmed_at }
        const state = deliveryState(row)
        if (state !== 'pending') {
          throw new AccountError(409, state === 'replaced'
            ? 'Esta credencial foi substituída. Confirme a nova credencial.'
            : state === 'revoked' ? 'Esta credencial foi revogada.' : 'Esta credencial venceu. Fale com a gente no WhatsApp.')
        }
        const confirmed = await db<string | null>('rpc/account_confirm_delivery', {}, 'POST', {
          p_user_id: userId, p_id: id,
          p_ip: (meta.ip || '').slice(0, 64), p_user_agent: (meta.userAgent || '').slice(0, 300),
          p_text: deliveryConfirmationText(row.key_hint, row.base_url), p_version: CONFIRMATION_TEXT_VERSION,
        })
        if (!confirmed) throw new AccountError(409, 'Esta credencial não está mais ativa. Atualize o painel.')
        return { confirmed_at: confirmed }
      }
      // E-mail de boas-vindas ao concluir o cadastro (nome e WhatsApp). Enviado uma vez só.
      if (method === 'POST' && path === 'welcome') {
        const response = await request(`${config.url}/auth/v1/user`, {
          headers: { apikey: config.publicKey, Authorization: authorization! }, signal: AbortSignal.timeout(10000),
        })
        if (!response.ok) throw new AccountError(401, 'Sua sessão não pôde ser validada. Entre novamente.')
        const user = userFromAuth(await response.json())
        if (user.id !== userId) throw new AccountError(401, 'Sua sessão não pôde ser validada. Entre novamente.')
        return { email: await createNotifier(config, email, request).welcome(user) }
      }
      throw new AccountError(405, 'Operação não disponível.')
    },
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http'

export default async function handler(req: IncomingMessage & { body?: Record<string, unknown> }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const path = url.searchParams.get('action') || url.pathname.replace(/^\/api\/account\//, '')
    if (!['GET','POST'].includes(req.method || '')) throw new AccountError(405, 'Operação não disponível.')
    let body = req.body
    if (!body && req.method === 'POST') {
      let text = ''
      for await (const chunk of req) {
        text += chunk
        if (Buffer.byteLength(text) > 4096) throw new AccountError(413, 'Solicitação muito grande.')
      }
      try { body = JSON.parse(text || '{}') } catch { throw new AccountError(400, 'Solicitação inválida.') }
    }
    if (body && (typeof body !== 'object' || Array.isArray(body))) throw new AccountError(400, 'Solicitação inválida.')
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    const meta = { ip: String(req.headers['x-real-ip'] || forwarded || ''), userAgent: String(req.headers['user-agent'] || '') }
    const data = await createAccountService(configuration(), fetch, emailConfig()).execute(req.method!, path, req.headers.authorization, body, url.searchParams, meta)
    res.statusCode = 200
    res.end(JSON.stringify(data))
  } catch (error) {
    res.statusCode = error instanceof AccountError ? error.status : 503
    res.end(JSON.stringify({ error: error instanceof AccountError ? error.message : 'Serviço temporariamente indisponível.' }))
  }
}
