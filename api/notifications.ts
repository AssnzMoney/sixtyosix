// Rodada diária de e-mails (agendada em vercel.json → crons).
// A Vercel chama com "Authorization: Bearer <CRON_SECRET>"; sem esse segredo, nada roda.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { emailConfig } from '../server/email.js'
import { createNotifier } from '../server/notifications.js'

const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function createCronHandler(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  return async (authorization: string | undefined) => {
    const secret = env.CRON_SECRET?.trim()
    if (!secret) return { status: 503, body: { error: 'CRON_SECRET não configurado.' } }
    if (!authorization || !same(authorization, `Bearer ${secret}`)) return { status: 401, body: { error: 'Não autorizado.' } }
    const url = env.SUPABASE_URL?.replace(/\/+$/, '')
    const service = env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.startsWith('https://') || !service) return { status: 503, body: { error: 'Supabase não configurado.' } }
    const email = emailConfig(env)
    if (!email) return { status: 200, body: { skipped: 'RESEND_API_KEY não configurada; nenhum e-mail enviado.' } }
    const result = await createNotifier({ url, secret: service }, email, request).daily()
    return { status: 200, body: result }
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
    const { status, body } = await createCronHandler()(req.headers.authorization)
    res.statusCode = status
    res.end(JSON.stringify(body))
  } catch (error) {
    res.statusCode = 503
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Rodada de e-mails indisponível.' }))
  }
}
