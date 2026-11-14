/**
 * Chave entregue pelo site (supabase/auto-delivery.sql).
 * Cada assinatura com API (Dev + API e Pro) tem uma chave do Roteador (sk-rt-) ligada à conta:
 * - pagamento aprovado: cria a chave (ou adota a que o cliente já tinha, entregue pelo WhatsApp) e
 *   estende a validade até o fim do período pago; estorno puxa a validade de volta;
 * - o cliente vê, copia e troca a chave no painel; a primeira vez que ele vê fica registrada
 *   (data, IP e navegador) como prova de entrega.
 * O teste grátis continua manual, pelo WhatsApp.
 */
import { createRouterAdmin, serviceHeaders } from './router.js'

type Env = Record<string, string | undefined>
type Row = Record<string, any>
export class AutoKeyError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

const DAY = 86400000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Pro: todos os modelos ativos do Roteador (como o admin entregava). Dev + API: só os do plano. */
export const keyModels = (item: { plan_code: string; models?: string[] | null }) => (item.plan_code === 'pro' ? null : [...(item.models || [])])
/** Chave de poucas horas é teste grátis do WhatsApp: nunca vira a chave da assinatura. */
const isTrialKey = (key: Row) => Date.parse(key.expires_at) - Date.parse(key.created_at) < 23 * 3600000

export function createAutoKeys(env: Env, request: typeof fetch = fetch) {
  const url = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.startsWith('https://') || !secret) throw new AutoKeyError(503, 'Conexão temporariamente indisponível.')
  const db = { url, secret }
  const headers = { ...serviceHeaders(secret), 'Content-Type': 'application/json' }
  async function rest<T = Row[]>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await request(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, Prefer: 'return=representation', ...((init.headers as Record<string, string>) || {}) },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (/billing_router_keys/.test(detail) && /does not exist|Could not find/i.test(detail)) throw new AutoKeyError(503, 'Aplique a migração supabase/auto-delivery.sql no Supabase.')
      throw new AutoKeyError(response.status === 409 ? 409 : 503, 'Não foi possível consultar sua chave. Tente novamente.')
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : null) as T
  }
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString()
  const router = () => createRouterAdmin(db, request, 'site')

  async function customer(userId: string) {
    const response = await request(`${url}/auth/v1/admin/users/${userId}`, { headers: serviceHeaders(secret!), signal: AbortSignal.timeout(10000) })
    const user = response.ok ? ((await response.json()) as Row) : {}
    const meta = (user.user_metadata || {}) as Row
    const name = String(meta.name || meta.full_name || user.email || 'Cliente').trim().slice(0, 70) || 'Cliente'
    const contact = String(meta.whatsapp || user.email || '').trim().slice(0, 80)
    return { name, contact }
  }

  /** Liga a chave à conta (ela e o consumo aparecem no painel do cliente). */
  async function linkUser(clientId: string, userId: string) {
    await rest(`gateway_clients?${q({ id: `eq.${clientId}` })}`, { method: 'PATCH', body: JSON.stringify({ user_id: userId }) })
  }

  /** Chave que o cliente já tinha (entregue pelo WhatsApp), ainda sem assinatura: passa a renovar sozinha. */
  async function adoptable(userId: string): Promise<Row | null> {
    const clients = await rest(`gateway_clients?${q({ user_id: `eq.${userId}`, select: 'id' })}`)
    if (!clients.length) return null
    const keys = await rest(`router_keys?${q({ gateway_client_id: `in.(${clients.map((c) => c.id).join(',')})`, revoked_at: 'is.null', select: 'id,gateway_client_id,created_at,expires_at', order: 'created_at.desc' })}`)
    const candidates = keys.filter((k) => !isTrialKey(k))
    if (!candidates.length) return null
    const taken = await rest(`billing_router_keys?${q({ router_key_id: `in.(${candidates.map((k) => k.id).join(',')})`, select: 'router_key_id' })}`)
    return candidates.find((k) => !taken.some((t) => t.router_key_id === k.id)) || null
  }

  /**
   * Deixa a chave da assinatura em dia com o pagamento. `shrink`: estorno ou contestação, a validade
   * pode voltar; senão ela só aumenta (dias dados à mão pelo admin não somem).
   */
  async function sync(subscriptionId: string, options: { shrink?: boolean } = {}): Promise<'sem_api' | 'inativa' | 'criada' | 'adotada' | 'renovada'> {
    if (!UUID.test(subscriptionId)) throw new AutoKeyError(400, 'Assinatura inválida.')
    const [item] = await rest(`billing_subscription_state?${q({ id: `eq.${subscriptionId}`, select: 'id,user_id,plan_code,api_enabled,models,paid_until,entitled', limit: '1' })}`)
    if (!item?.api_enabled) return 'sem_api'
    const paid = item.entitled !== false && item.paid_until && Date.parse(item.paid_until) > Date.now() ? new Date(item.paid_until).toISOString() : null
    const models = keyModels(item as { plan_code: string; models?: string[] })
    let [link] = await rest(`billing_router_keys?${q({ subscription_id: `eq.${subscriptionId}`, select: 'router_key_id', limit: '1' })}`)
    let result: 'criada' | 'adotada' | 'renovada' = 'renovada'
    if (!link) {
      if (!paid) return 'inativa'
      const old = await adoptable(item.user_id)
      if (old) {
        await rest('billing_router_keys?on_conflict=subscription_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ subscription_id: subscriptionId, router_key_id: old.id, adopted: true }) })
        result = 'adotada'
      } else {
        const who = await customer(item.user_id)
        const created = (await router().createKey({ name: `${who.name} (site)`, contact: who.contact, days: Math.max(1, Math.min(366, Math.ceil((Date.parse(paid) - Date.now()) / DAY))), models })) as { key: string; row: Row }
        await linkUser(created.row.gateway_client_id, item.user_id)
        const saved = await rest('billing_router_keys?on_conflict=subscription_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ subscription_id: subscriptionId, router_key_id: created.row.id }) })
        // Dois avisos do Mercado Pago ao mesmo tempo: fica a chave que chegou primeiro.
        if (!saved?.length) await router().deleteKey({ id: created.row.id }).catch(() => undefined)
        else result = 'criada'
      }
      ;[link] = await rest(`billing_router_keys?${q({ subscription_id: `eq.${subscriptionId}`, select: 'router_key_id', limit: '1' })}`)
      if (!link) throw new AutoKeyError(503, 'Não foi possível preparar sua chave. Tente novamente.')
    }
    const [key] = await rest(`router_keys?${q({ id: `eq.${link.router_key_id}`, select: 'id,gateway_client_id,expires_at', limit: '1' })}`)
    if (!key) throw new AutoKeyError(404, 'Chave não encontrada.')
    const until = paid || new Date().toISOString()
    const expires = options.shrink ? until : new Date(Math.max(Date.parse(key.expires_at), Date.parse(until))).toISOString()
    await rest(`router_keys?${q({ id: `eq.${key.id}` })}`, { method: 'PATCH', body: JSON.stringify({ expires_at: expires, models }) })
    await linkUser(key.gateway_client_id, item.user_id)
    return result
  }

  /** Assinaturas com API do cliente, a ativa primeiro. */
  async function subscriptions(userId: string) {
    const rows = await rest(`billing_subscription_state?${q({ user_id: `eq.${userId}`, api_enabled: 'eq.true', select: 'id,plan_code,paid_until,entitled', order: 'paid_until.desc.nullslast', limit: '20' })}`)
    return rows.sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
  }
  const isActive = (s: Row) => s.entitled !== false && Boolean(s.paid_until && Date.parse(s.paid_until) > Date.now())

  /** A chave da conta (sem o segredo), para o painel. Cria na hora se o aviso do pagamento falhou. */
  async function status(userId: string) {
    const subs = await subscriptions(userId)
    const active = subs.find(isActive)
    if (!active) return { ready: false as const, reason: subs.length ? 'vencida' : 'sem_plano' }
    let [link] = await rest(`billing_router_keys?${q({ subscription_id: `eq.${active.id}`, select: 'router_key_id,revealed_at,adopted', limit: '1' })}`)
    if (!link) {
      await sync(active.id)
      ;[link] = await rest(`billing_router_keys?${q({ subscription_id: `eq.${active.id}`, select: 'router_key_id,revealed_at,adopted', limit: '1' })}`)
    }
    if (!link) return { ready: false as const, reason: 'preparando' }
    const [key] = await rest(`router_keys?${q({ id: `eq.${link.router_key_id}`, select: 'id,token_prefix,expires_at,revoked_at,models', limit: '1' })}`)
    if (!key) return { ready: false as const, reason: 'preparando' }
    return { ready: true as const, subscriptionId: active.id, keyId: key.id, prefix: key.token_prefix, expires: key.expires_at, blocked: Boolean(key.revoked_at), models: key.models, revealed: link.revealed_at }
  }

  /** Mostra a chave completa. A primeira vez fica registrada como entrega. */
  async function reveal(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
    const info = await status(userId)
    if (!info.ready) throw new AutoKeyError(409, info.reason === 'sem_plano' ? 'Sua chave aparece aqui depois do pagamento de um plano com API.' : info.reason === 'vencida' ? 'Seu plano venceu. Renove para voltar a usar a chave.' : 'Sua chave está sendo preparada. Atualize em alguns segundos.')
    if (info.blocked) throw new AutoKeyError(403, 'Esta chave foi bloqueada. Fale com a SixtySix pelo WhatsApp: (81) 99237-6036.')
    const { key } = (await router().revealKey({ id: info.keyId })) as { key: string }
    if (!info.revealed) {
      await rest(`billing_router_keys?${q({ subscription_id: `eq.${info.subscriptionId}`, revealed_at: 'is.null' })}`, {
        method: 'PATCH',
        body: JSON.stringify({ revealed_at: new Date().toISOString(), revealed_ip: (meta.ip || '').slice(0, 64) || null, revealed_user_agent: (meta.userAgent || '').slice(0, 300) || null }),
      }).catch(() => undefined)
    }
    return { key, expires: info.expires, models: info.models }
  }

  /** Troca a chave (vazou, ou quer começar do zero): a antiga para na hora. Uma troca a cada 10 minutos. */
  async function rotate(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
    const info = await status(userId)
    if (!info.ready) throw new AutoKeyError(409, 'Você ainda não tem uma chave ativa para trocar.')
    if (info.blocked) throw new AutoKeyError(403, 'Esta chave foi bloqueada. Fale com a SixtySix pelo WhatsApp: (81) 99237-6036.')
    const [link] = await rest(`billing_router_keys?${q({ subscription_id: `eq.${info.subscriptionId}`, select: 'rotated_at', limit: '1' })}`)
    if (link?.rotated_at && Date.now() - Date.parse(link.rotated_at) < 10 * 60000) throw new AutoKeyError(429, 'Você acabou de trocar a chave. Aguarde alguns minutos para trocar de novo.')
    const who = await customer(userId)
    const days = Math.max(1, Math.min(366, Math.ceil((Date.parse(info.expires) - Date.now()) / DAY)))
    const created = (await router().createKey({ name: `${who.name} (site)`, contact: who.contact, days, models: info.models ?? null })) as { key: string; row: Row }
    await rest(`router_keys?${q({ id: `eq.${created.row.id}` })}`, { method: 'PATCH', body: JSON.stringify({ expires_at: info.expires }) })
    await linkUser(created.row.gateway_client_id, userId)
    await rest(`billing_router_keys?${q({ subscription_id: `eq.${info.subscriptionId}` })}`, {
      method: 'PATCH',
      body: JSON.stringify({ router_key_id: created.row.id, adopted: false, rotated_at: new Date().toISOString(), revealed_at: new Date().toISOString(), revealed_ip: (meta.ip || '').slice(0, 64) || null, revealed_user_agent: (meta.userAgent || '').slice(0, 300) || null }),
    })
    // A antiga é bloqueada (não apagada): para de funcionar na hora e o consumo dela continua no painel.
    await router().setKeyBlocked({ id: info.keyId, blocked: true }).catch((error) => console.error('troca de chave: a antiga não foi bloqueada', info.keyId, error))
    return { key: created.key, expires: info.expires, models: info.models }
  }

  /** Cadastro interno (gateway_clients) da chave ativa: é nele que ficam os IPs vistos. */
  async function activeClient(userId: string) {
    const info = await status(userId)
    if (!info.ready) return null
    const [key] = await rest(`router_keys?${q({ id: `eq.${info.keyId}`, select: 'gateway_client_id', limit: '1' })}`)
    return key ? String(key.gateway_client_id) : null
  }

  /**
   * Endereços (IPs) que usaram a chave, para o painel do cliente. `current` é o IP de quem está
   * olhando o painel agora; `inUse` é o IP que usou a chave por último.
   */
  async function ips(userId: string, meta: { ip?: string } = {}) {
    const client = await activeClient(userId)
    const current = (meta.ip || '').slice(0, 64) || null
    if (!client) return { current, inUse: null, maxIps: null, items: [] as Row[] }
    const [rows, settings, controls] = await Promise.all([
      rest(`gateway_client_ips?${q({ client_id: `eq.${client}`, select: '*', order: 'last_seen.desc', limit: '20' })}`),
      rest(`gateway_settings?${q({ select: '*', limit: '1' })}`).catch(() => [] as Row[]),
      rest(`gateway_controls?${q({ client_id: `eq.${client}`, select: '*', limit: '1' })}`).catch(() => [] as Row[]),
    ])
    const recent = (row: Row) => Date.now() - Date.parse(row.last_seen) < 10 * 60000
    const items = rows
      .filter((row) => Date.now() - Date.parse(row.last_seen) < 30 * DAY)
      .map((row) => ({
        ip: String(row.ip),
        device: row.device_label || null,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        requests: Number(row.requests) || 0,
        state: row.blocked_at ? 'bloqueado' : row.accepted === false ? 'recusado' : recent(row) ? 'em_uso' : 'liberado',
        here: Boolean(current && String(row.ip) === current),
      }))
    const inUse = items.find((item) => item.state === 'em_uso' || item.state === 'liberado')?.ip || null
    return { current, inUse, maxIps: controls[0]?.max_ips ?? settings[0]?.max_ips ?? null, items }
  }

  /**
   * O cliente tira um endereço da chave (ex.: o computador antigo). A vaga abre na hora: o próximo
   * endereço entra sem esperar. Conta como troca no limite diário; endereço bloqueado pelo admin não sai.
   */
  async function removeIp(userId: string, ip: unknown) {
    const value = typeof ip === 'string' ? ip.trim() : ''
    if (!value || value.length > 64 || !/^[0-9a-f.:]+$/i.test(value)) throw new AutoKeyError(400, 'Endereço inválido.')
    const client = await activeClient(userId)
    if (!client) throw new AutoKeyError(409, 'Você ainda não tem uma chave ativa.')
    const [row] = await rest(`gateway_client_ips?${q({ client_id: `eq.${client}`, ip: `eq.${value}`, select: '*', limit: '1' })}`)
    if (!row) throw new AutoKeyError(404, 'Este endereço não está mais na sua chave.')
    if (row.blocked_at) throw new AutoKeyError(403, 'Este endereço foi bloqueado pela SixtySix. Fale com a gente pelo WhatsApp: (81) 99237-6036.')
    const [settings] = await rest(`gateway_settings?${q({ select: '*', limit: '1' })}`).catch(() => [] as Row[])
    const perDay = Number(settings?.ip_swaps_per_day) || 12
    const since = new Date(Date.now() - DAY).toISOString()
    const swaps = await rest(`gateway_ip_swaps?${q({ client_id: `eq.${client}`, at: `gte.${since}`, select: 'id' })}`).catch(() => [] as Row[])
    if (swaps.length >= perDay) throw new AutoKeyError(429, 'Sua chave já trocou de endereço muitas vezes nas últimas 24 horas. Tente mais tarde ou fale com a gente pelo WhatsApp.')
    await rest(`gateway_client_ips?${q({ client_id: `eq.${client}`, ip: `eq.${value}` })}`, { method: 'DELETE' })
    await rest('gateway_ip_swaps', { method: 'POST', body: JSON.stringify({ client_id: client, from_ip: value, to_ip: value, same_device: false, device_label: 'removido pelo cliente no painel' }) }).catch(() => undefined)
    return { ok: true }
  }

  return { sync, status, reveal, rotate, ips, removeIp }
}
