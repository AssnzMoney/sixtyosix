/**
 * Ranking de uso da IA no Discord.
 *
 * Lê o consumo (gateway_usage) de um período, junta cada chave ao cliente dono dela e publica no canal
 * do Discord, por webhook, três rankings: quem mais usou (tokens), quem mais trabalhou (sessões de
 * trabalho) e os modelos mais usados.
 *
 * - "Sessão de trabalho" = bloco de chamadas sem pausa maior que 30 minutos. A plataforma não sabe o
 *   nome do projeto (o Claude Code e o Codex não mandam isso), então as sessões são a medida mais
 *   próxima de "quantos projetos / quanto trabalho a pessoa fez".
 * - Só chamadas que deram certo (status < 400) contam.
 * - No Discord o nome sai curto ("Alisson M."). E-mail, chave e WhatsApp nunca saem.
 * - Contas dos administradores (SIXTYSIX_ADMIN_EMAILS) e as de DISCORD_RANK_HIDE ficam fora.
 *
 * Variáveis: DISCORD_RANK_WEBHOOK_URL (obrigatória para publicar), DISCORD_RANK_DAYS (padrão 7),
 * DISCORD_RANK_HIDE (e-mails ou nomes separados por vírgula), DISCORD_RANK_SITE (link no rodapé).
 */

type Env = Record<string, string | undefined>
type Row = Record<string, any>

export class DiscordRankError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

export const SESSION_GAP_MS = 30 * 60_000
const MAX_USAGE_ROWS = 300_000
const PAGE = 1000

export type UsageCall = { client_id: string; requested_alias: string | null; status_code: number | null; input_tokens: number | null; output_tokens: number | null; created_at: string }
/** Dono de cada gateway_client_id: conta (user_id) ou, nas chaves manuais do Roteador, só um nome. */
export type Owner = { key: string; name: string; email?: string }

export type RankEntry = { key: string; name: string; tokens: number; input: number; output: number; requests: number; sessions: number; activeDays: number; topModel: string; models: number }
export type Ranking = {
  from: string
  to: string
  days: number
  people: RankEntry[]
  byTokens: RankEntry[]
  bySessions: RankEntry[]
  models: Array<{ model: string; requests: number; tokens: number; people: number }>
  total: { requests: number; tokens: number; people: number; sessions: number }
}

/** "alisson medeiros silva" → "Alisson M.". Sem nome: "Cliente #a1b2" (estável, sem expor nada). */
export function publicName(raw: string | undefined, fallbackKey: string): string {
  const clean = String(raw || '')
    .replace(/\S+@\S+/g, '') // nunca e-mail
    .replace(/[`*_~|>\\@#<:[\]()]/g, '') // nada de markdown, menções ou links no Discord
    .replace(/\d{6,}/g, '') // nem telefone
    .replace(/\s+/g, ' ')
    .trim()
  const parts = clean.split(' ').filter(Boolean)
  if (!parts.length) {
    let hash = 0
    for (const ch of fallbackKey) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return `Cliente #${hash.toString(16).slice(-4).padStart(4, '0')}`
  }
  const cap = (w: string) => w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1).toLocaleLowerCase('pt-BR')
  const first = cap(parts[0]).slice(0, 20)
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return last ? `${first} ${last.charAt(0).toLocaleUpperCase('pt-BR')}.` : first
}

/** Monta os rankings a partir das chamadas e dos donos das chaves. Função pura (testada). */
export function buildRanking(calls: UsageCall[], owners: Map<string, Owner>, opts: { from: string; to: string; days: number; hidden?: (o: Owner) => boolean; limit?: number }): Ranking {
  type Acc = { owner: Owner; input: number; output: number; requests: number; times: number[]; models: Map<string, number> }
  const acc = new Map<string, Acc>()
  const models = new Map<string, { requests: number; tokens: number; people: Set<string> }>()
  for (const call of calls) {
    if (Number(call.status_code) >= 400) continue
    const owner = owners.get(call.client_id) || { key: `client:${call.client_id}`, name: '' }
    if (opts.hidden?.(owner)) continue
    const at = Date.parse(call.created_at)
    if (!Number.isFinite(at)) continue
    const input = Math.max(0, Number(call.input_tokens) || 0), output = Math.max(0, Number(call.output_tokens) || 0)
    const a: Acc = acc.get(owner.key) || { owner, input: 0, output: 0, requests: 0, times: [], models: new Map() }
    a.input += input
    a.output += output
    a.requests++
    a.times.push(at)
    const model = String(call.requested_alias || '').trim()
    if (model) {
      a.models.set(model, (a.models.get(model) || 0) + 1)
      const m = models.get(model) || { requests: 0, tokens: 0, people: new Set<string>() }
      m.requests++
      m.tokens += input + output
      m.people.add(owner.key)
      models.set(model, m)
    }
    acc.set(owner.key, a)
  }
  const people: RankEntry[] = [...acc.values()].map((a) => {
    const times = a.times.sort((x, y) => x - y)
    let sessions = 0
    const days = new Set<string>()
    for (let i = 0; i < times.length; i++) {
      if (i === 0 || times[i] - times[i - 1] > SESSION_GAP_MS) sessions++
      // Dia no horário de Brasília (UTC-3).
      days.add(new Date(times[i] - 3 * 3600_000).toISOString().slice(0, 10))
    }
    const top = [...a.models.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]
    return { key: a.owner.key, name: publicName(a.owner.name, a.owner.key), input: a.input, output: a.output, tokens: a.input + a.output, requests: a.requests, sessions, activeDays: days.size, topModel: top?.[0] || '—', models: a.models.size }
  })
  const limit = opts.limit ?? 10
  const byTokens = [...people].sort((a, b) => b.tokens - a.tokens || b.requests - a.requests || a.name.localeCompare(b.name)).slice(0, limit)
  const bySessions = [...people].sort((a, b) => b.sessions - a.sessions || b.activeDays - a.activeDays || b.tokens - a.tokens || a.name.localeCompare(b.name)).slice(0, limit)
  const modelList = [...models.entries()]
    .map(([model, m]) => ({ model, requests: m.requests, tokens: m.tokens, people: m.people.size }))
    .sort((a, b) => b.requests - a.requests || b.tokens - a.tokens || a.model.localeCompare(b.model))
    .slice(0, limit)
  const total = people.reduce((t, p) => ({ requests: t.requests + p.requests, tokens: t.tokens + p.tokens, people: t.people + 1, sessions: t.sessions + p.sessions }), { requests: 0, tokens: 0, people: 0, sessions: 0 })
  return { from: opts.from, to: opts.to, days: opts.days, people, byTokens, bySessions, models: modelList, total }
}

const compact = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',')} bi`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',')} mi`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',')} mil`
  return String(n)
}
const int = (n: number) => n.toLocaleString('pt-BR')
const medal = (i: number) => ['🥇', '🥈', '🥉'][i] || `\`${String(i + 1).padStart(2, ' ')}.\``
const br = (day: string) => day.split('-').reverse().join('/')
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1) + '…' : text)

/** Mensagem do webhook (embeds do Discord, dentro dos limites de tamanho). */
export function discordPayload(rank: Ranking, site?: string) {
  const period = rank.from === rank.to ? br(rank.from) : `${br(rank.from)} a ${br(rank.to)}`
  const lines = (list: string[], empty: string) => clip(list.length ? list.join('\n') : empty, 1024)
  const empty = 'Ninguém usou neste período.'
  const embed = {
    title: `🏆 Ranking SixtySix · últimos ${rank.days} dia${rank.days === 1 ? '' : 's'}`,
    description: clip(
      `Período: **${period}**\n` +
        `**${int(rank.total.people)}** devs · **${int(rank.total.sessions)}** sessões de trabalho · **${int(rank.total.requests)}** chamadas · **${compact(rank.total.tokens)}** tokens`,
      4096,
    ),
    color: 0xf5b301,
    fields: [
      {
        name: '🔥 Quem mais usou a IA (tokens)',
        value: lines(rank.byTokens.map((p, i) => `${medal(i)} **${p.name}** · ${compact(p.tokens)} tokens · ${int(p.requests)} chamadas`), empty),
      },
      {
        name: '🛠️ Quem mais trabalhou (sessões de trabalho)',
        value: lines(rank.bySessions.map((p, i) => `${medal(i)} **${p.name}** · ${int(p.sessions)} sessões · ${int(p.activeDays)} dia${p.activeDays === 1 ? '' : 's'} ativo${p.activeDays === 1 ? '' : 's'}`), empty),
      },
      {
        name: '🤖 Modelos mais usados',
        value: lines(rank.models.map((m, i) => `${medal(i)} \`${clip(m.model, 40)}\` · ${int(m.requests)} chamadas · ${int(m.people)} dev${m.people === 1 ? '' : 's'}`), empty),
      },
    ],
    footer: { text: 'Sessão de trabalho = uso sem pausa maior que 30 min. Só chamadas com sucesso contam.' },
    timestamp: new Date().toISOString(),
    ...(site ? { url: site } : {}),
  }
  return { username: 'SixtySix Ranking', embeds: [embed], allowed_mentions: { parse: [] as string[] } }
}

/** Só aceita webhook oficial do Discord (nada de mandar dados para outro endereço). */
export function validWebhook(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw.trim())
    const hostOk = ['discord.com', 'discordapp.com', 'canary.discord.com', 'ptb.discord.com'].includes(url.hostname)
    if (url.protocol !== 'https:' || !hostOk || !/^\/api(\/v\d+)?\/webhooks\/\d+\/[\w-]+\/?$/.test(url.pathname)) return null
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch { return null }
}

export function rankDays(raw: unknown, env: Env): number {
  const n = Number(raw ?? env.DISCORD_RANK_DAYS ?? 7)
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : 7
}

/** Lê o banco, monta o ranking e (se pedido) publica no Discord. */
export function createDiscordRank(env: Env, request: typeof fetch = fetch) {
  const base = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = secret ? { apikey: secret, ...(!secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${secret}` } : {}) } : {}

  async function rest<T = Row[]>(path: string, params: Record<string, string>, optional = false): Promise<T> {
    const response = await request(`${base}/rest/v1/${path}?${new URLSearchParams(params)}`, { headers, signal: AbortSignal.timeout(20000) })
    if (!response.ok) {
      if (optional) return [] as T
      throw new DiscordRankError(503, `Não foi possível ler ${path}.`)
    }
    return (await response.json()) as T
  }

  async function users(): Promise<Map<string, Row>> {
    const map = new Map<string, Row>()
    for (let page = 1; page <= 40; page++) {
      const response = await request(`${base}/auth/v1/admin/users?page=${page}&per_page=500`, { headers, signal: AbortSignal.timeout(20000) })
      if (!response.ok) throw new DiscordRankError(503, 'Não foi possível ler as contas.')
      const list = (((await response.json()) as Row).users || []) as Row[]
      for (const u of list) map.set(String(u.id), u)
      if (list.length < 500) break
    }
    return map
  }

  async function ranking(daysRaw?: unknown): Promise<Ranking> {
    if (!base?.startsWith('https://') || !secret) throw new DiscordRankError(503, 'Supabase não configurado.')
    const days = rankDays(daysRaw, env)
    const now = Date.now()
    const since = new Date(now - days * 86400_000).toISOString()
    const calls: UsageCall[] = []
    for (let offset = 0; offset < MAX_USAGE_ROWS; offset += PAGE) {
      const page = await rest<UsageCall[]>('gateway_usage', {
        select: 'client_id,requested_alias,status_code,input_tokens,output_tokens,created_at',
        created_at: `gte.${since}`,
        order: 'created_at.asc,id.asc',
        limit: String(PAGE),
        offset: String(offset),
      })
      calls.push(...page)
      if (page.length < PAGE) break
    }
    const [clients, keys, trials, routerKeys, accounts] = await Promise.all([
      rest('gateway_clients', { select: 'id,user_id,name', limit: '100000' }),
      rest('billing_key_access', { select: 'gateway_client_id,user_id', limit: '100000' }, true),
      rest('gateway_trials', { select: 'gateway_client_id,user_id', limit: '100000' }, true),
      rest('router_keys', { select: 'gateway_client_id,name', limit: '100000' }, true),
      users(),
    ])
    const ownerUser = new Map<string, string>()
    for (const c of clients) if (c.user_id) ownerUser.set(c.id, c.user_id)
    for (const k of [...keys, ...trials]) if (k.user_id) ownerUser.set(k.gateway_client_id, k.user_id)
    const keyName = new Map<string, string>(routerKeys.map((k: Row) => [k.gateway_client_id, k.name]))
    const owners = new Map<string, Owner>()
    for (const c of clients) {
      const userId = ownerUser.get(c.id)
      const u = userId ? accounts.get(userId) : undefined
      if (u) {
        const meta = (u.user_metadata || {}) as Row
        owners.set(c.id, { key: `user:${u.id}`, name: String(meta.custom_name || meta.preferred_name || meta.full_name || meta.name || ''), email: String(u.email || '').toLowerCase() })
      } else {
        // Chave manual sem conta: agrupa pelo nome dado na venda (o mesmo cliente com várias chaves soma junto).
        const name = keyName.get(c.id) || ''
        owners.set(c.id, name ? { key: `name:${name.trim().toLowerCase()}`, name } : { key: `client:${c.id}`, name: '' })
      }
    }
    const hiddenList = [env.SIXTYSIX_ADMIN_EMAILS || 'alissonmedeiroz007@gmail.com,alysontrx@gmail.com', env.DISCORD_RANK_HIDE || '']
      .join(',').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
    const hidden = (o: Owner) => Boolean((o.email && hiddenList.includes(o.email)) || (o.name && hiddenList.includes(o.name.trim().toLowerCase())))
    const day = (t: number) => new Date(t - 3 * 3600_000).toISOString().slice(0, 10)
    return buildRanking(calls, owners, { from: day(Date.parse(since)), to: day(now), days, hidden })
  }

  async function publish(daysRaw?: unknown) {
    const webhook = validWebhook(env.DISCORD_RANK_WEBHOOK_URL)
    if (!webhook) throw new DiscordRankError(503, 'Configure DISCORD_RANK_WEBHOOK_URL (webhook do canal do Discord) no .env do servidor.')
    const rank = await ranking(daysRaw)
    const response = await request(`${webhook}?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload(rank, env.DISCORD_RANK_SITE || 'https://www.sixtysix.online')),
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      console.error('Discord recusou o ranking', response.status, (await response.text().catch(() => '')).slice(0, 300))
      throw new DiscordRankError(502, response.status === 404 || response.status === 401 ? 'O Discord não achou o webhook. Crie outro no canal e atualize DISCORD_RANK_WEBHOOK_URL.' : 'O Discord recusou a mensagem. Tente de novo em instantes.')
    }
    const message = (await response.json().catch(() => ({}))) as Row
    return { published: true, messageId: message.id ? String(message.id) : null, ranking: rank }
  }

  return { ranking, publish, configured: () => Boolean(validWebhook(env.DISCORD_RANK_WEBHOOK_URL)) }
}
