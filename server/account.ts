import { createHash, randomBytes } from 'node:crypto'

type Config = { url: string; secret: string; publicKey: string }
type Client = { id: string; name: string; enabled: boolean; created_at: string; key_prefix: string | null }
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
  return { url, secret, publicKey }
}

export function createAccountService(config: Config, request: typeof fetch = fetch) {
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
    return response.json() as Promise<T>
  }
  async function identity(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ') || authorization.length > 16000) throw new AccountError(401, 'Entre na sua conta para continuar.')
    const response = await request(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.publicKey, Authorization: authorization }, signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new AccountError(response.status >= 500 ? 503 : 401, 'Sua sessão não pôde ser validada. Entre novamente.')
    const user = await response.json() as { id?: string; is_anonymous?: boolean }
    if (!user.id || !uuid.test(user.id) || user.is_anonymous) throw new AccountError(401, 'Entre com uma conta válida.')
    return user.id
  }
  async function clients(userId: string) {
    return db<Client[]>('gateway_clients', { user_id: `eq.${userId}`, select: 'id,name,enabled,created_at,key_prefix', order: 'created_at.desc' })
  }
  return {
    async execute(method: string, path: string, authorization?: string, body: Record<string, unknown> = {}, query = new URLSearchParams()) {
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
        const usage = mine.length ? await db<Usage[]>('gateway_usage', {
          select: 'id,client_id,requested_alias,status_code,input_tokens,output_tokens,latency_ms,created_at',
          client_id: `in.(${mine.map(c => c.id).join(',')})`, and: `(created_at.gte.${start},created_at.lt.${end},created_at.lte.${new Date(asOf).toISOString()})`,
          order: 'created_at.desc,id.desc', limit: '1000', offset: String(offset),
        }) : []
        return { keys: mine.map(c => ({ id: c.id, name: c.name, prefix: c.key_prefix || 'Chave anterior', active: c.enabled, created: c.created_at })), usage, hasMore: usage.length === 1000, subscription: null, billingConnected: false }
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
        const updated = await db<Client[]>('gateway_clients', { id: `eq.${id}`, user_id: `eq.${userId}`, enabled: 'eq.true', select: 'id' }, 'PATCH', { enabled: false, revoked_at: new Date().toISOString() })
        if (!updated.length) throw new AccountError(404, 'Chave não encontrada ou já revogada.')
        return { ok: true }
      }
      throw new AccountError(405, 'Operação não disponível.')
    },
  }
}
