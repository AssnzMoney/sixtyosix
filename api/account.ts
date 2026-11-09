import type { IncomingMessage, ServerResponse } from 'node:http'
import { AccountError, configuration, createAccountService } from '../server/account.ts'

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
    const data = await createAccountService(configuration()).execute(req.method!, path, req.headers.authorization, body, url.searchParams)
    res.statusCode = 200
    res.end(JSON.stringify(data))
  } catch (error) {
    res.statusCode = error instanceof AccountError ? error.status : 503
    res.end(JSON.stringify({ error: error instanceof AccountError ? error.message : 'Serviço temporariamente indisponível.' }))
  }
}
