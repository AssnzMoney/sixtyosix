/** Ponte temporária: somente teste fixo, sem integração nas rotas de produção. */
import { timingSafeEqual } from 'node:crypto'
type Env = Record<string, string | undefined>
export const MODEL = 'openai/gpt-6-luna'
export const PROMPT = 'Responda apenas OK'
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
const error = (status: number, message: string) => json({ error: { message, type: 'test_bridge_error' } }, status)
export function createTestBridge(env: Env, request: typeof fetch = fetch, now = Date.now) {
  // Reserva a única tentativa ANTES do await. Não representa quota global entre instâncias.
  let attempted = false
  return async (req: Request): Promise<Response> => {
    const key = env.SIX_TEST_BRIDGE_KEY || ''
    const expires = Date.parse(env.SIX_TEST_BRIDGE_EXPIRES_AT || '')
    if (key.length < 32 || !Number.isFinite(expires) || expires <= now() || expires - now() > 3600000)
      return error(503, 'Teste desativado ou prazo inválido (máximo 1 hora).')
    const provided = req.headers.get('authorization') || ''
    const expected = 'Bearer ' + key
    const a = Buffer.from(provided), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return error(401, 'Não autorizado.')
    const path = new URL(req.url).pathname
    if (req.method === 'GET' && path.endsWith('/models'))
      return json({ object: 'list', data: [{ id: MODEL, object: 'model', owned_by: 'lovable' }] })
    if (req.method !== 'POST' || !path.endsWith('/chat/completions')) return error(404, 'Rota não disponível neste teste.')
    // Limite também para corpos sem Content-Length.
    const reader = req.body?.getReader()
    if (!reader) return error(400, 'Corpo ausente.')
    const chunks: Uint8Array[] = []; let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 8192) { await reader.cancel(); return error(413, 'Corpo excede 8 KiB.') }
        chunks.push(part.value)
      }
    } catch { return error(400, 'Corpo inválido.') }
    let body: any
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return error(400, 'JSON inválido.') }
    if (!body || body.model !== MODEL || body.stream === true || body.tools || body.functions)
      return error(400, 'Teste aceita somente GPT-6 Luna, sem streaming ou ferramentas.')
    const users = Array.isArray(body.messages) ? body.messages.filter((m: any) => m?.role === 'user') : []
    if (users.length !== 1 || users[0].content !== PROMPT)
      return error(400, 'Use somente a mensagem fixa do teste.')
    // Outros campos, inclusive instruções de sistema do roteador, nunca são encaminhados.
    if (!env.LOVABLE_API_KEY) return error(503, 'Credencial do projeto ausente.')
    if (attempted) return error(409, 'Tentativa já utilizada nesta instância.')
    attempted = true
    try {
      const upstream = await request('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Authorization: 'Bearer ' + env.LOVABLE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: PROMPT }], max_tokens: 16, stream: false }),
      })
      if (!upstream.ok) return error([402, 429].includes(upstream.status) ? upstream.status : 502, 'Gateway não concluiu o teste.')
      const data = await upstream.json() as any
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.length > 512) return error(502, 'Resposta inesperada.')
      const tokens = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0
      return json({ id: 'chatcmpl-six-test', object: 'chat.completion', created: Math.floor(now() / 1000),
        model: typeof data.model === 'string' ? data.model : MODEL,
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: tokens(data?.usage?.prompt_tokens), completion_tokens: tokens(data?.usage?.completion_tokens), total_tokens: tokens(data?.usage?.total_tokens) },
      })
    } catch { return error(502, 'Falha ao executar o teste.') }
  }
}
