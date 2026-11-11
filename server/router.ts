/**
 * Roteador estilo 9router dentro do SixtySix (aba "Roteador" do /admin):
 * - Provedores: URL + key mestra, guardada criptografada em router_providers.
 * - Modelos: apelido vendido → modelo no provedor (router_models). in_pro = entra no Pro e no teste grátis.
 * - Chaves manuais sk-rt- (router_keys): nome, validade e modelos; vencidas ou bloqueadas são recusadas.
 * Tudo que passa pelo roteador grava consumo em gateway_usage (server/supplier.ts).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { supplierUrl } from './supplier.js'

type Env = Record<string, string | undefined>
type Row = Record<string, any>

export class RouterError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export type RouterProvider = { id: string; name: string; url: string; key: string }
export type RouterRoute = { alias: string; label: string; upstream: string; inPro: boolean; provider: RouterProvider }
export type RouterConfig = { routes: Map<string, RouterRoute>; proAliases: string[] }
export const EMPTY_ROUTER: RouterConfig = { routes: new Map(), proAliases: [] }

export const ROUTER_KEY_PREFIX = 'sk-rt-'
const CACHE_MS = 30_000

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const providerAad = (id: string) => `router:provider:${id}`
const keyAad = (hash: string) => `router:key:${hash}`
export const serviceHeaders = (secret: string) => ({ apikey: secret, ...(!secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${secret}` } : {}) })

function encryptionKey(secret: string) { return createHash('sha256').update(`sixtysix-router-v1\0${secret}`).digest() }
export function sealSecret(value: string, secret: string, aad: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv)
  cipher.setAAD(Buffer.from(aad))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}
export function unsealSecret(value: string, secret: string, aad: string) {
  const packed = Buffer.from(value, 'base64url')
  if (packed.length < 29) throw new RouterError(503, 'Credencial do roteador ilegível.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), packed.subarray(0, 12))
  decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(packed.subarray(12, 28))
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8')
}

function database(env: Env) {
  const url = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  return url?.startsWith('https://') && secret ? { url, secret } : null
}

let cache: { at: number; url: string; value: RouterConfig } | null = null
/** Depois de mudar algo no admin, a próxima chamada desta instância relê o banco. As outras, em até 30 s. */
export function clearRouterCache() { cache = null }

/** Modelos ativos com provedor ativo. Sem a migração aplicada (ou com falha), devolve um roteador vazio: tudo segue para o 66cloud. */
export async function loadRouter(env: Env, request: typeof fetch = fetch): Promise<RouterConfig> {
  const db = database(env)
  if (!db) return EMPTY_ROUTER
  if (cache && cache.url === db.url && Date.now() - cache.at < CACHE_MS) return cache.value
  let value = EMPTY_ROUTER
  try {
    const params = new URLSearchParams({
      select: 'alias,label,upstream_model,in_pro,provider:router_providers(id,name,base_url,encrypted_key,enabled)',
      enabled: 'eq.true', order: 'created_at.asc,alias.asc',
    })
    const response = await request(`${db.url}/rest/v1/router_models?${params}`, { headers: serviceHeaders(db.secret), signal: AbortSignal.timeout(10000) })
    if (response.ok) {
      const routes = new Map<string, RouterRoute>(), keys = new Map<string, string | null>()
      for (const row of await response.json() as Row[]) {
        const provider = row.provider as Row | null
        if (!provider?.enabled) continue
        if (!keys.has(provider.id)) {
          try { keys.set(provider.id, unsealSecret(provider.encrypted_key, db.secret, providerAad(provider.id))) }
          catch { console.error('Roteador: não foi possível abrir a key do provedor', provider.name); keys.set(provider.id, null) }
        }
        const key = keys.get(provider.id)
        if (!key) continue
        routes.set(row.alias, { alias: row.alias, label: row.label, upstream: row.upstream_model, inPro: Boolean(row.in_pro), provider: { id: provider.id, name: provider.name, url: String(provider.base_url).replace(/\/+$/, ''), key } })
      }
      value = { routes, proAliases: [...routes.values()].filter(route => route.inPro).map(route => route.alias) }
    } else {
      console.error('Roteador indisponível (aplique supabase/router.sql?)', response.status)
    }
  } catch (error) {
    console.error('Falha ao carregar o roteador', error)
    if (cache) return cache.value
  }
  cache = { at: Date.now(), url: db.url, value }
  return value
}

/**
 * Diagnóstico público do Roteador (/api/router-status): diz se o gateway consegue ler o banco,
 * quantos provedores estão ligados, se as keys abrem e quantos modelos estão ativos. Nunca devolve keys.
 */
export async function routerStatus(env: Env, request: typeof fetch = fetch) {
  const db = database(env)
  if (!db) return { ok: false, problem: 'O gateway não tem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.' }
  const params = new URLSearchParams({
    select: 'alias,enabled,provider:router_providers(id,name,enabled,encrypted_key)',
    order: 'created_at.asc,alias.asc',
  })
  let response: Response
  try {
    response = await request(`${db.url}/rest/v1/router_models?${params}`, { headers: serviceHeaders(db.secret), signal: AbortSignal.timeout(10000) })
  } catch {
    return { ok: false, problem: 'O gateway não conseguiu falar com o Supabase.' }
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300)
    return { ok: false, problem: 'O gateway não conseguiu ler os modelos do Roteador (a migração supabase/router.sql foi aplicada?).', http: response.status, detail }
  }
  const rows = (await response.json()) as Row[]
  const providers = new Map<string, { name: string; enabled: boolean; keyOpens: boolean; models: number; activeModels: number }>()
  for (const row of rows) {
    const p = row.provider as Row | null
    if (!p) continue
    if (!providers.has(p.id)) {
      let keyOpens = false
      try { unsealSecret(p.encrypted_key, db.secret, providerAad(p.id)); keyOpens = true } catch { keyOpens = false }
      providers.set(p.id, { name: String(p.name), enabled: Boolean(p.enabled), keyOpens, models: 0, activeModels: 0 })
    }
    const info = providers.get(p.id)!
    info.models++
    if (row.enabled && info.enabled && info.keyOpens) info.activeModels++
  }
  const list = [...providers.values()]
  const active = list.reduce((sum, p) => sum + p.activeModels, 0)
  const problem = !rows.length
    ? 'Nenhum modelo cadastrado: em Roteador → Modelos, marque "Vender" e clique em Salvar modelos.'
    : list.some((p) => !p.keyOpens)
      ? 'A key de um provedor não abre: cadastre a key de novo em Roteador → Editar (a SUPABASE_SERVICE_ROLE_KEY pode ter mudado).'
      : !active
        ? 'Os modelos existem, mas o provedor está desligado ou os modelos estão desativados.'
        : null
  return { ok: active > 0, models: rows.length, activeModels: active, providers: list, problem }
}

/** Confere uma chave manual sk-rt-: existe, não está bloqueada nem vencida. Devolve os modelos liberados. */
export async function authorizeRouterKey(env: Env, request: typeof fetch, token: string, router: RouterConfig) {
  const db = database(env)
  if (!db) throw new RouterError(503, 'Conexão temporariamente indisponível.')
  const params = new URLSearchParams({ token_hash: `eq.${sha(token)}`, select: 'gateway_client_id,models,expires_at,revoked_at', limit: '1' })
  const response = await request(`${db.url}/rest/v1/router_keys?${params}`, { headers: serviceHeaders(db.secret), signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new RouterError(503, 'Não foi possível conferir sua chave. Tente novamente.')
  const row = (await response.json() as Row[])[0]
  if (!row) throw new RouterError(401, 'Chave de acesso inválida.')
  if (row.revoked_at) throw new RouterError(403, 'Esta chave foi bloqueada. Fale com a SixtySix.')
  if (!(Date.parse(row.expires_at) > Date.now())) throw new RouterError(403, 'Sua chave venceu. Fale com a SixtySix para renovar.')
  const active = [...router.routes.keys()]
  const allowed = Array.isArray(row.models) ? (row.models as string[]).filter(model => router.routes.has(model)) : active
  return { clientId: String(row.gateway_client_id), allowed }
}

/* ------------------------------------------------------------------ admin */

const URL_RE = /^https:\/\/[^\s]+$/
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const keyHint = (key: string) => '…' + key.slice(-4)

/** Operações da aba Roteador. Só é chamado depois de requireAdmin (api/management.ts). */
export function createRouterAdmin(db: { url: string; secret: string }, request: typeof fetch, adminEmail: string) {
  const headers = { ...serviceHeaders(db.secret), 'Content-Type': 'application/json' }
  async function rest<T>(path: string, init: RequestInit = {}, fail = 'Operação incompleta. Atualize e tente novamente.'): Promise<T> {
    const response = await request(`${db.url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> || {}) }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (/router_(providers|models|keys)/.test(detail) && /does not exist|Could not find/i.test(detail)) throw new RouterError(503, 'Aplique a migração supabase/router.sql no Supabase para usar o Roteador.')
      throw new RouterError(response.status === 409 ? 409 : 503, fail)
    }
    const body = await response.text()
    return (body ? JSON.parse(body) : null) as T
  }
  async function providerKey(id: string) {
    const rows = await rest<Row[]>(`router_providers?${new URLSearchParams({ id: `eq.${id}`, select: 'id,base_url,encrypted_key', limit: '1' })}`)
    if (!rows[0]) throw new RouterError(404, 'Provedor não encontrado.')
    return { url: String(rows[0].base_url), key: unsealSecret(rows[0].encrypted_key, db.secret, providerAad(id)) }
  }
  const done = <T>(value: T) => { clearRouterCache(); return value }

  return {
    async overview() {
      const [providers, models, keys] = await Promise.all([
        rest<Row[]>(`router_providers?select=id,name,base_url,key_hint,enabled,created_at&order=created_at.asc`),
        rest<Row[]>(`router_models?select=alias,provider_id,upstream_model,label,enabled,in_pro,created_at&order=created_at.asc,alias.asc`),
        rest<Row[]>(`router_keys?select=id,gateway_client_id,name,contact,token_prefix,models,expires_at,revoked_at,created_by,created_at&order=created_at.desc&limit=1000`),
      ])
      return { providers, models, keys }
    },

    async saveProvider(body: Row) {
      const id = text(body.id, 40), name = text(body.name, 60), url = text(body.base_url, 300).replace(/\/+$/, ''), key = text(body.key, 500)
      if (!name) throw new RouterError(400, 'Dê um nome ao provedor.')
      if (!URL_RE.test(url)) throw new RouterError(400, 'A URL precisa começar com https://')
      if (!id && !key) throw new RouterError(400, 'Cole a API key do provedor.')
      if (id) {
        const patch: Row = { name, base_url: url, updated_at: new Date().toISOString(), ...(key ? { encrypted_key: sealSecret(key, db.secret, providerAad(id)), key_hint: keyHint(key) } : {}) }
        await rest(`router_providers?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
        return done({ id })
      }
      const created = randomUUID()
      await rest('router_providers', { method: 'POST', body: JSON.stringify({ id: created, name, base_url: url, encrypted_key: sealSecret(key, db.secret, providerAad(created)), key_hint: keyHint(key) }) })
      return done({ id: created })
    },

    async setProviderEnabled(body: Row) {
      await rest(`router_providers?id=eq.${encodeURIComponent(text(body.id, 40))}`, { method: 'PATCH', body: JSON.stringify({ enabled: body.enabled === true, updated_at: new Date().toISOString() }) })
      return done({ ok: true })
    },

    async deleteProvider(body: Row) {
      await rest(`router_providers?id=eq.${encodeURIComponent(text(body.id, 40))}`, { method: 'DELETE' })
      return done({ ok: true })
    },

    /** Testa a key e lista os modelos que o provedor oferece (GET /models). Não gasta crédito. */
    async providerModels(body: Row) {
      const provider = await providerKey(text(body.id, 40))
      let response: Response
      try {
        response = await request(supplierUrl(provider.url, '/v1/models'), { headers: { Authorization: `Bearer ${provider.key}`, 'x-api-key': provider.key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(20000) })
      } catch {
        throw new RouterError(502, 'O provedor não respondeu. Confira a URL.')
      }
      if (response.status === 401 || response.status === 403) throw new RouterError(400, 'O provedor recusou a key. Confira se ela está certa e ativa.')
      if (!response.ok) throw new RouterError(502, `O provedor respondeu com erro ${response.status}.`)
      const list = await response.json().catch(() => ({})) as Row
      const items = (Array.isArray(list.data) ? list.data : Array.isArray(list.models) ? list.models : []) as Row[]
      return { models: items.map(item => ({ id: String(item.id || item.name || ''), name: String(item.display_name || item.name || item.id || '') })).filter(item => item.id).slice(0, 500) }
    },

    /** Grava a lista de modelos vendidos deste provedor: os que saírem da lista deixam de ser vendidos. */
    async saveModels(body: Row) {
      const providerId = text(body.provider_id, 40)
      if (!providerId) throw new RouterError(400, 'Provedor inválido.')
      const items = (Array.isArray(body.models) ? body.models : []).slice(0, 200).map((item: Row) => ({
        alias: text(item.alias, 80).toLowerCase(), provider_id: providerId, upstream_model: text(item.upstream_model, 200),
        label: text(item.label, 80) || text(item.alias, 80), enabled: item.enabled !== false, in_pro: item.in_pro !== false,
      }))
      const aliases = new Set<string>()
      for (const item of items) {
        if (!ALIAS_RE.test(item.alias)) throw new RouterError(400, `Nome inválido: "${item.alias}". Use letras minúsculas, números, ponto, hífen ou _.`)
        if (!item.upstream_model) throw new RouterError(400, 'Modelo do provedor ausente.')
        if (aliases.has(item.alias)) throw new RouterError(400, `O nome "${item.alias}" aparece duas vezes.`)
        aliases.add(item.alias)
      }
      const keep = items.length ? `&alias=not.in.(${items.map(item => `"${item.alias}"`).join(',')})` : ''
      await rest(`router_models?provider_id=eq.${encodeURIComponent(providerId)}${keep}`, { method: 'DELETE' })
      if (items.length) await rest('router_models?on_conflict=alias', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(items) })
      return done({ saved: items.length })
    },

    async createKey(body: Row) {
      const name = text(body.name, 80), contact = text(body.contact, 80), days = Number(body.days)
      if (!name) throw new RouterError(400, 'Dê um nome para a chave (ex.: nome do cliente).')
      if (!Number.isInteger(days) || days < 1 || days > 366) throw new RouterError(400, 'Escolha uma validade entre 1 e 366 dias.')
      const models = Array.isArray(body.models) ? (body.models as unknown[]).map(model => text(model, 80)).filter(Boolean).slice(0, 200) : null
      if (models && !models.length) throw new RouterError(400, 'Escolha pelo menos um modelo.')
      const key = `${ROUTER_KEY_PREFIX}${randomBytes(32).toString('base64url')}`, hash = sha(key)
      const created = await rest<Row | Row[]>('rpc/router_create_key', { method: 'POST', body: JSON.stringify({
        p_name: name, p_contact: contact || null, p_hash: hash, p_prefix: key.slice(0, 14), p_encrypted_token: sealSecret(key, db.secret, keyAad(hash)),
        p_bridge_hash: sha(randomBytes(32).toString('hex')), p_models: models, p_days: days, p_created_by: adminEmail,
      }) })
      return { key, row: Array.isArray(created) ? created[0] : created }
    },

    async renewKey(body: Row) {
      const days = Number(body.days)
      if (!Number.isInteger(days) || days < 1 || days > 366) throw new RouterError(400, 'Escolha entre 1 e 366 dias.')
      const renewed = await rest<Row | Row[]>('rpc/router_renew_key', { method: 'POST', body: JSON.stringify({ p_id: text(body.id, 40), p_days: days }) })
      return { row: Array.isArray(renewed) ? renewed[0] : renewed }
    },

    async setKeyBlocked(body: Row) {
      const changed = await rest<boolean>('rpc/router_set_blocked', { method: 'POST', body: JSON.stringify({ p_id: text(body.id, 40), p_blocked: body.blocked === true }) })
      if (!changed) throw new RouterError(404, 'Chave não encontrada.')
      return { ok: true }
    },

    /** Mostra a chave completa de novo, para reenviar ao cliente. */
    async revealKey(body: Row) {
      const rows = await rest<Row[]>(`router_keys?${new URLSearchParams({ id: `eq.${text(body.id, 40)}`, select: 'token_hash,encrypted_token', limit: '1' })}`)
      if (!rows[0]) throw new RouterError(404, 'Chave não encontrada.')
      return { key: unsealSecret(rows[0].encrypted_token, db.secret, keyAad(rows[0].token_hash)) }
    },
  }
}
