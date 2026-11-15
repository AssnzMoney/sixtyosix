// Publicação automática do ranking no Discord (server/discord-rank.ts).
// O cron da VPS chama com "Authorization: Bearer <CRON_SECRET>"; sem esse segredo, nada roda.
// Opcional: ?days=7 (1 a 90). Sem isso, usa DISCORD_RANK_DAYS (padrão 7).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { createDiscordRank, DiscordRankError } from '../server/discord-rank.js'

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createDiscordCron(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  return async (authorization: string | undefined, days?: string | null) => {
    const secret = env.CRON_SECRET?.trim()
    if (!secret) return { status: 503, body: { error: 'CRON_SECRET não configurado.' } }
    if (!authorization || !same(authorization, `Bearer ${secret}`)) return { status: 401, body: { error: 'Não autorizado.' } }
    try {
      const result = await createDiscordRank(env, request).publish(days ?? undefined)
      return { status: 200, body: { published: true, messageId: result.messageId, people: result.ranking.total.people } }
    } catch (error) {
      if (error instanceof DiscordRankError) return { status: error.status, body: { error: error.message } }
      throw error
    }
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.statusCode = 405
      res.end(JSON.stringify({ error: 'Operação não disponível.' }))
      return
    }
    const days = new URL(req.url || '/', 'http://localhost').searchParams.get('days')
    const { status, body } = await createDiscordCron()(req.headers.authorization, days)
    res.statusCode = status
    res.end(JSON.stringify(body))
  } catch (error) {
    console.error('Ranking do Discord falhou', error)
    res.statusCode = 503
    res.end(JSON.stringify({ error: 'Ranking do Discord indisponível.' }))
  }
}
