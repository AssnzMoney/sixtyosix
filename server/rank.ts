import { randomBytes } from 'node:crypto'

/**
 * Rank do mês (supabase/rank.sql). Todo mês um tema; assinantes enviam um projeto e votam no dos outros;
 * o admin confirma o campeão quando a votação fecha e o banco já dá os dias do prêmio.
 * As regras de quem pode, prazos e um voto por pessoa ficam nas funções do banco: aqui só valida a entrada,
 * monta as listas e guarda as capas no Storage (bucket "rank").
 */
type Env = Record<string, string | undefined>
type Row = Record<string, any>

export class RankError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const MESSAGES: Record<string, [number, string]> = {
  rank_missing: [404, 'Desafio não encontrado. Atualize a página.'],
  rank_closed: [409, 'Os envios deste mês já encerraram.'],
  rank_voting_closed: [409, 'A votação deste mês já encerrou.'],
  rank_not_eligible: [403, 'O rank é para assinantes. Assine um plano para enviar seu projeto e votar.'],
  rank_own_entry: [400, 'Você não pode votar no seu próprio projeto.'],
  rank_entry_missing: [404, 'Projeto não encontrado. Atualize a página.'],
  rank_hidden: [403, 'Seu projeto deste mês foi removido pela moderação. Fale com a gente no WhatsApp.'],
  rank_already_confirmed: [409, 'O campeão deste tema já foi confirmado.'],
  rank_still_open: [409, 'A votação ainda não encerrou. Confirme o campeão depois do fim da votação.'],
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BRT = '-03:00'
const MAX_COVER = 900 * 1024

/** Horário de Brasília (sem horário de verão desde 2019). */
export const brtStart = (day: string) => new Date(`${day}T00:00:00${BRT}`).toISOString()
export const brtEnd = (day: string) => new Date(`${day}T23:59:59${BRT}`).toISOString()

/** Prazos padrão do mês: envios até o dia 25, votação até o último dia, sempre às 23:59 de Brasília. */
export function monthDefaults(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RankError(400, 'Escolha o mês do tema.')
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { starts_at: brtStart(`${month}-01`), submit_until: brtEnd(`${month}-25`), closes_at: brtEnd(`${month}-${String(last).padStart(2, '0')}`) }
}

/** Nome mostrado no rank: o apelido escolhido no painel ou primeiro nome + inicial do sobrenome. */
export function authorName(meta: Row, email = '') {
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
  const custom = clean(meta.custom_name)
  if (custom && custom.length <= 30) return custom
  const full = clean(meta.full_name) || clean(meta.name) || clean(meta.preferred_name)
  if (full) {
    const parts = full.split(' ')
    return (parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0]).slice(0, 40)
  }
  const local = email.split('@')[0] || ''
  return local ? `${local.slice(0, 3)}***` : 'Assinante'
}

/** Confere o texto do projeto. O link precisa ser https e de um endereço de verdade. */
export function validateEntry(input: Row) {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const title = text(input.title).replace(/\s+/g, ' ')
  const description = text(input.description)
  const link = text(input.link)
  if (title.length < 3 || title.length > 80) throw new RankError(400, 'O título precisa ter de 3 a 80 caracteres.')
  if (description.length < 10 || description.length > 1000) throw new RankError(400, 'Conte sobre o projeto em 10 a 1000 caracteres.')
  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new RankError(400, 'Cole o link completo do projeto, começando com https://')
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password || link.length > 300 || /\s/.test(link))
    throw new RankError(400, 'Cole o link completo do projeto, começando com https:// (site, GitHub, vídeo...).')
  return { title, description, link: url.toString() }
}

/** Tipo da imagem pelos primeiros bytes (não confia no que o navegador diz). */
export function imageKind(bytes: Buffer): 'webp' | 'png' | 'jpg' | null {
  if (bytes.length > 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp'
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  return null
}

export function phase(ch: Row, now = Date.now()): 'upcoming' | 'submissions' | 'voting' | 'counting' | 'finished' {
  if (now < Date.parse(ch.starts_at)) return 'upcoming'
  if (now < Date.parse(ch.submit_until)) return 'submissions'
  if (now < Date.parse(ch.closes_at)) return 'voting'
  return ch.winner_entry_id ? 'finished' : 'counting'
}

export function createRank(env: Env, request: typeof fetch = fetch) {
  const base = env.SUPABASE_URL?.replace(/\/+$/, '')
  const secret = env.SUPABASE_SERVICE_ROLE_KEY
  const headers = () => {
    if (!base?.startsWith('https://') || !secret) throw new RankError(503, 'O rank está indisponível agora. Tente de novo em instantes.')
    return { apikey: secret, ...(secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secret}` }) }
  }
  async function db<T = Row[]>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await request(`${base}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers(), 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers as Row) },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as { code?: string; message?: string }
      const known = MESSAGES[String(error.message || '')]
      if (known) throw new RankError(known[0], known[1])
      if (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202') throw new RankError(503, 'O rank ainda está sendo preparado.')
      throw new RankError(503, 'Não foi possível carregar o rank. Tente de novo.')
    }
    const text = await response.text()
    return (text ? JSON.parse(text) : null) as T
  }
  const q = (params: Record<string, string>) => new URLSearchParams(params).toString()
  const rpc = <T>(name: string, args: Row) => db<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(args) })
  const coverUrl = (path: string | null) => (path ? `${base}/storage/v1/object/public/rank/${path}` : null)
  const scores = (rows: Row[]) => new Map<string, number>(rows.map((r) => [r.entry_id, Number(r.votes) || 0]))
  const publicEntry = (e: Row, votes: Map<string, number>, userId?: string, myVote?: string | null) => ({
    id: e.id, title: e.title, description: e.description, link: e.link, cover: coverUrl(e.cover_path), author: e.author,
    votes: votes.get(e.id) || 0, mine: Boolean(userId && e.user_id === userId), voted: Boolean(myVote && myVote === e.id), created: e.created_at,
  })
  const ranked = <T extends { votes: number; created: string }>(list: T[]) =>
    list.sort((a, b) => b.votes - a.votes || Date.parse(a.created) - Date.parse(b.created))
  const challengeOut = (ch: Row) => ({
    id: ch.id, title: ch.title, description: ch.description, prizeDays: ch.prize_days, prizeText: ch.prize_text,
    startsAt: ch.starts_at, submitUntil: ch.submit_until, closesAt: ch.closes_at, phase: phase(ch),
  })

  async function champions() {
    const done = await db(`rank_challenges?${q({ winner_entry_id: 'not.is.null', select: '*', order: 'starts_at.desc', limit: '36' })}`)
    if (!done.length) return []
    const ids = done.map((c) => c.winner_entry_id)
    const [entries, votes] = await Promise.all([
      db(`rank_entries?${q({ id: `in.(${ids.join(',')})`, select: '*' })}`),
      db(`rank_scores?${q({ entry_id: `in.(${ids.join(',')})`, select: 'entry_id,votes' })}`),
    ])
    const totals = scores(votes)
    return done.flatMap((c) => {
      const e = entries.find((x) => x.id === c.winner_entry_id)
      if (!e) return []
      return [{ month: c.starts_at, theme: c.title, prizeDays: c.prize_days, title: e.title, author: e.author, link: e.link, cover: coverUrl(e.cover_path), votes: totals.get(e.id) || 0, description: e.description }]
    })
  }

  async function current() {
    const [ch] = await db(`rank_challenges?${q({ starts_at: `lte.${new Date().toISOString()}`, select: '*', order: 'starts_at.desc', limit: '1' })}`)
    return ch || null
  }

  const api = {
    /** Tudo o que a aba do cliente mostra: o tema do mês, os projetos com os votos, o projeto e o voto dele e os campeões. */
    async overview(userId: string) {
      const [ch, eligible, hall] = await Promise.all([current(), rpc<boolean>('rank_eligible', { p_user: userId }), champions()])
      if (!ch) return { challenge: null, entries: [], mine: null, myVote: null, eligible: Boolean(eligible), champions: hall }
      const [entries, votes, [mineVote]] = await Promise.all([
        db(`rank_entries?${q({ challenge_id: `eq.${ch.id}`, select: '*', order: 'created_at.asc', limit: '500' })}`),
        db(`rank_scores?${q({ challenge_id: `eq.${ch.id}`, select: 'entry_id,votes' })}`),
        db(`rank_votes?${q({ challenge_id: `eq.${ch.id}`, voter_id: `eq.${userId}`, select: 'entry_id', limit: '1' })}`),
      ])
      const visible = entries.filter((e) => !e.hidden_at)
      const totals = scores(votes)
      // Voto num projeto que a moderação tirou não vale: a pessoa pode votar em outro.
      const myVote = mineVote && visible.some((e) => e.id === mineVote.entry_id) ? (mineVote.entry_id as string) : null
      const own = entries.find((e) => e.user_id === userId)
      const list = ranked(visible.map((e) => publicEntry(e, totals, userId, myVote)))
      return {
        challenge: { ...challengeOut(ch), winner: ch.winner_entry_id || null, totalVotes: visible.reduce((sum, e) => sum + (totals.get(e.id) || 0), 0) },
        entries: list,
        mine: own ? { ...publicEntry(own, totals, userId, myVote), hidden: Boolean(own.hidden_at), coverPath: own.cover_path } : null,
        myVote,
        eligible: Boolean(eligible),
        champions: hall,
      }
    },

    /** Envia ou edita o projeto do mês. `cover` é o caminho devolvido por uploadCover (ou o atual, ou nada). */
    async submit(userId: string, author: string, input: Row) {
      const ch = await current()
      if (!ch) throw new RankError(409, 'Ainda não tem tema neste mês. Volte em breve.')
      const entry = validateEntry(input)
      const cover = typeof input.cover === 'string' && input.cover ? input.cover : null
      if (cover && (!cover.startsWith(`${userId}/`) || !/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{6,40}\.(webp|png|jpg)$/.test(cover))) throw new RankError(400, 'Envie a capa de novo.')
      const [before] = await db(`rank_entries?${q({ challenge_id: `eq.${ch.id}`, user_id: `eq.${userId}`, select: 'cover_path', limit: '1' })}`)
      await rpc('rank_submit', { p_user: userId, p_challenge: ch.id, p_author: author, p_title: entry.title, p_description: entry.description, p_link: entry.link, p_cover: cover })
      // A capa antiga sai do Storage quando o projeto troca de capa (falha aqui não desfaz o envio).
      if (before?.cover_path && before.cover_path !== cover) await api.removeCover(before.cover_path).catch(() => undefined)
      return api.overview(userId)
    },

    /** Vota, troca o voto ou (votando de novo no mesmo) tira o voto. */
    async vote(userId: string, entryId: unknown) {
      if (typeof entryId !== 'string' || !uuid.test(entryId)) throw new RankError(400, 'Projeto inválido.')
      await rpc('rank_vote', { p_user: userId, p_entry: entryId })
      return api.overview(userId)
    },

    /** Guarda a capa (já reduzida no navegador) e devolve o caminho para o envio do projeto. */
    async uploadCover(userId: string, image: unknown) {
      if (typeof image !== 'string') throw new RankError(400, 'Escolha uma imagem.')
      const match = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(image)
      if (!match) throw new RankError(400, 'Use uma imagem PNG, JPG ou WebP.')
      const bytes = Buffer.from(match[2], 'base64')
      if (bytes.length > MAX_COVER) throw new RankError(413, 'Imagem muito grande. Use uma de até 900 KB.')
      const kind = imageKind(bytes)
      if (!kind) throw new RankError(400, 'Use uma imagem PNG, JPG ou WebP.')
      const ch = await current()
      if (!ch || phase(ch) !== 'submissions') throw new RankError(409, 'Os envios deste mês já encerraram.')
      if (!(await rpc<boolean>('rank_eligible', { p_user: userId }))) throw new RankError(MESSAGES.rank_not_eligible[0], MESSAGES.rank_not_eligible[1])
      const path = `${userId}/${randomBytes(12).toString('base64url')}.${kind}`
      const response = await request(`${base}/storage/v1/object/rank/${path}`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': kind === 'jpg' ? 'image/jpeg' : `image/${kind}`, 'x-upsert': 'false', 'Cache-Control': 'max-age=31536000' },
        body: bytes,
        signal: AbortSignal.timeout(20000),
      })
      if (!response.ok) {
        console.error('rank: o Storage recusou a capa', response.status, (await response.text().catch(() => '')).slice(0, 200))
        throw new RankError(503, 'Não foi possível guardar a imagem. Tente de novo.')
      }
      return { path, url: coverUrl(path) }
    },

    async removeCover(path: string) {
      const response = await request(`${base}/storage/v1/object/rank`, {
        method: 'DELETE', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }), signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error(`storage ${response.status}`)
    },

    // ----- admin -----

    /** Temas (do mais novo ao mais antigo) com todos os projetos, inclusive os removidos, e os votos. */
    async adminOverview() {
      const list = await db(`rank_challenges?${q({ select: '*', order: 'starts_at.desc', limit: '24' })}`)
      if (!list.length) return { challenges: [] }
      const ids = list.map((c) => c.id)
      const [entries, votes] = await Promise.all([
        db(`rank_entries?${q({ challenge_id: `in.(${ids.join(',')})`, select: '*', order: 'created_at.asc', limit: '5000' })}`),
        db(`rank_scores?${q({ challenge_id: `in.(${ids.join(',')})`, select: 'entry_id,votes' })}`),
      ])
      const totals = scores(votes)
      return {
        challenges: list.map((c) => ({
          ...challengeOut(c),
          winner: c.winner_entry_id, winnerAt: c.winner_at, winnerBy: c.winner_by, winnerKeys: c.winner_keys, winnerSubscription: c.winner_subscription_id,
          entries: entries
            .filter((e) => e.challenge_id === c.id)
            .map((e) => ({ ...publicEntry(e, totals), userId: e.user_id, hidden: Boolean(e.hidden_at) }))
            .sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.votes - a.votes || Date.parse(a.created) - Date.parse(b.created)),
        })),
      }
    },

    /** Cria ou edita o tema de um mês. Prazos em dias (AAAA-MM-DD), sempre até 23:59 de Brasília. */
    async saveChallenge(input: Row) {
      const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
      const title = text(input.title).replace(/\s+/g, ' ')
      const description = text(input.description)
      const prizeText = text(input.prizeText)
      const prizeDays = Number(input.prizeDays)
      if (title.length < 3 || title.length > 80) throw new RankError(400, 'O tema precisa ter de 3 a 80 caracteres.')
      if (description.length > 2000) throw new RankError(400, 'A descrição pode ter até 2000 caracteres.')
      if (prizeText.length > 200) throw new RankError(400, 'O prêmio extra pode ter até 200 caracteres.')
      if (!Number.isInteger(prizeDays) || prizeDays < 0 || prizeDays > 365) throw new RankError(400, 'Os dias do prêmio vão de 0 a 365.')
      const dates = monthDefaults(text(input.month))
      const day = (v: unknown, fallback: string) => {
        const value = text(v)
        if (!value) return fallback
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value))) throw new RankError(400, 'Data inválida.')
        return brtEnd(value)
      }
      const row = { title, description, prize_days: prizeDays, prize_text: prizeText, starts_at: dates.starts_at, submit_until: day(input.submitUntil, dates.submit_until), closes_at: day(input.closesAt, dates.closes_at) }
      if (!(Date.parse(row.starts_at) < Date.parse(row.submit_until) && Date.parse(row.submit_until) <= Date.parse(row.closes_at)))
        throw new RankError(400, 'O fim dos envios precisa ser depois do começo do mês e antes (ou no dia) do fim da votação.')
      if (input.id) {
        if (typeof input.id !== 'string' || !uuid.test(input.id)) throw new RankError(400, 'Tema inválido.')
        const [old] = await db(`rank_challenges?${q({ id: `eq.${input.id}`, select: '*', limit: '1' })}`)
        if (!old) throw new RankError(404, 'Tema não encontrado.')
        if (old.winner_entry_id && (old.prize_days !== prizeDays || Date.parse(old.starts_at) !== Date.parse(row.starts_at)))
          throw new RankError(409, 'O campeão já foi confirmado: dá para mudar o texto, mas não o mês nem os dias do prêmio.')
        const [saved] = await db(`rank_challenges?${q({ id: `eq.${input.id}` })}`, { method: 'PATCH', body: JSON.stringify(row) })
        return saved
      }
      const [exists] = await db(`rank_challenges?${q({ starts_at: `eq.${row.starts_at}`, select: 'id', limit: '1' })}`)
      if (exists) throw new RankError(409, 'Esse mês já tem tema. Edite o tema existente.')
      const [saved] = await db('rank_challenges', { method: 'POST', body: JSON.stringify(row) })
      return saved
    },

    /** Moderação: tira (ou devolve) um projeto do rank. Os votos dele deixam de contar enquanto estiver fora. */
    async hideEntry(id: unknown, hidden: unknown) {
      if (typeof id !== 'string' || !uuid.test(id)) throw new RankError(400, 'Projeto inválido.')
      const [saved] = await db(`rank_entries?${q({ id: `eq.${id}` })}`, { method: 'PATCH', body: JSON.stringify({ hidden_at: hidden ? new Date().toISOString() : null }) })
      if (!saved) throw new RankError(404, 'Projeto não encontrado.')
      return { id, hidden: Boolean(saved.hidden_at) }
    },

    /** Confirma o campeão e dá os dias do prêmio (uma vez por tema, depois da votação). */
    async confirmWinner(challengeId: unknown, entryId: unknown, by: string) {
      if (typeof challengeId !== 'string' || !uuid.test(challengeId) || typeof entryId !== 'string' || !uuid.test(entryId)) throw new RankError(400, 'Projeto inválido.')
      const saved = await rpc<Row>('rank_confirm_winner', { p_challenge: challengeId, p_entry: entryId, p_by: by.slice(0, 200) })
      return { id: challengeId, winner: entryId, keys: saved?.winner_keys ?? 0, subscription: saved?.winner_subscription_id ?? null }
    },
  }
  return api
}
