import { createHmac, timingSafeEqual } from 'node:crypto'
import type { RouterConfig, RouterRoute } from './router.ts'
import { recordUsage, supplierUrl } from './supplier.ts'

/**
 * Vídeo pelo gateway (Veo), no formato da OpenAI: o cliente cria em POST /v1/videos, consulta em GET /v1/videos/{id}
 * até "completed" e baixa em GET /v1/videos/{id}/content.
 *  - Só no Pro e nas chaves pagas (o teste grátis não gera vídeo).
 *  - Limite por mês, contado do dia 1 (horário de Brasília) no registro de consumo: SIXTYSIX_VIDEO_MONTHLY_LIMIT,
 *    padrão 10. O Veo "Fast" conta 1; o normal, mais caro, conta 2. Até 8 segundos por vídeo.
 *  - O id que o cliente recebe é assinado com a conta dele: ninguém consulta nem baixa o vídeo de outra pessoa, e não
 *    precisa de tabela nova. Consultar e baixar não contam no limite.
 */
type Env = Record<string, string | undefined>
type Json = Record<string, unknown>

export const CREATE_PATH = /^\/v1\/videos(?:\/generations)?\/?$/
export const ITEM_PATH = /^\/v1\/videos\/([A-Za-z0-9_.-]+?)(\/content)?\/?$/
export const MAX_SECONDS = 8
export const isVideoRoute = (route: Pick<RouterRoute, 'upstream'>) => /veo|video|sora|kling/i.test(route.upstream)
/** Quanto um vídeo gasta do limite: o modelo "fast" conta 1, os outros contam 2. */
export const videoWeight = (route: Pick<RouterRoute, 'upstream'>) => (/fast/i.test(route.upstream) ? 1 : 2)
export const monthlyLimit = (env: Env) => {
  const value = Number(env.SIXTYSIX_VIDEO_MONTHLY_LIMIT)
  return Number.isFinite(value) && value >= 0 ? value : 10
}

/** Começo do mês no horário de Brasília (00:00 do dia 1 = 03:00 UTC). */
export function monthStart(now = new Date()) {
  const brt = new Date(now.getTime() - 3 * 3600000)
  return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1, 3)).toISOString()
}

const macKey = (secret: string) => createHmac('sha256', 'sixtysix-videos').update(secret).digest()
const mac = (secret: string, clientId: string, inner: string) => createHmac('sha256', macKey(secret)).update(`${clientId}\n${inner}`).digest('base64url').slice(0, 22)

/** Id para o cliente: guarda o apelido do modelo e o id do fornecedor, assinado com a conta dele. */
export function signVideoId(alias: string, supplierId: string, clientId: string, secret: string) {
  const inner = `${alias}|${supplierId}`
  return `video_${Buffer.from(inner).toString('base64url')}.${mac(secret, clientId, inner)}`
}
/** Abre o id do cliente; null se não for desta conta (ou se foi mexido). */
export function openVideoId(id: string, clientId: string, secret: string): { alias: string; supplierId: string } | null {
  const m = /^video_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{22})$/.exec(id)
  if (!m) return null
  const inner = Buffer.from(m[1], 'base64url').toString('utf8')
  const expected = Buffer.from(mac(secret, clientId, inner))
  const given = Buffer.from(m[2])
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const cut = inner.indexOf('|')
  if (cut <= 0) return null
  return { alias: inner.slice(0, cut), supplierId: inner.slice(cut + 1) }
}

/** Resposta do fornecedor com o nosso id, o nosso nome do modelo e o endereço de download pelo gateway. */
export function rewriteVideo(data: unknown, alias: string, clientId: string, secret: string): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const out: Json = { ...(data as Json) }
  if (typeof out.id === 'string') {
    const ours = signVideoId(alias, out.id, clientId, secret)
    out.id = ours
    if (out.url !== undefined || out.status === 'completed') out.url = `/v1/videos/${ours}/content`
  }
  out.model = alias
  return out
}

/** Confere o pedido: um vídeo por vez e até MAX_SECONDS segundos. Devolve a mensagem de erro ou null. */
export function videoRequestProblem(payload: Json): string | null {
  if (typeof payload.prompt !== 'string' || !payload.prompt.trim()) return 'Envie o prompt do vídeo.'
  const seconds = payload.seconds ?? payload.duration
  if (seconds !== undefined && !(Number(seconds) > 0 && Number(seconds) <= MAX_SECONDS)) return `Cada vídeo pode ter até ${MAX_SECONDS} segundos.`
  if (payload.n !== undefined && Number(payload.n) !== 1) return 'Gere um vídeo por vez.'
  return null
}

const serviceHeaders = (secret: string) => ({ apikey: secret, ...(secret.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${secret}` }) })

/** Quanto do limite do mês a conta já usou (soma os pesos dos vídeos criados com sucesso desde o dia 1). */
export async function videosUsed(env: Env, request: typeof fetch, clientId: string, router: RouterConfig) {
  const routes = [...router.routes.values()].filter(isVideoRoute)
  const base = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!routes.length || !base || !secret) return 0
  const params = new URLSearchParams({
    select: 'requested_alias', client_id: `eq.${clientId}`, requested_alias: `in.(${routes.map((r) => r.alias).join(',')})`,
    created_at: `gte.${monthStart()}`, and: '(status_code.gte.200,status_code.lt.300)', limit: '1000',
  })
  const response = await request(`${base}/rest/v1/gateway_usage?${params}`, { headers: serviceHeaders(secret), signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`consumo de vídeo indisponível (${response.status})`)
  const weights = new Map(routes.map((r) => [r.alias, videoWeight(r)]))
  return ((await response.json()) as { requested_alias: string }[]).reduce((sum, row) => sum + (weights.get(row.requested_alias) ?? 1), 0)
}

const busy = (status: number) => status === 429 || status === 502 || status === 503 || status === 529
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Chama o fornecedor com as keys do provedor; limite ou instabilidade passageira: espera e tenta de novo (até ~30 s). */
async function supplierCall(env: Env, request: typeof fetch, route: RouterRoute, path: string, init: RequestInit = {}) {
  const keys = route.provider.keys?.length ? route.provider.keys : [route.provider.key]
  const deadline = Date.now() + (env.SIXTYSIX_429_WAIT_MS !== undefined ? Number(env.SIXTYSIX_429_WAIT_MS) : 30000)
  let pause = 1500
  for (let attempt = 0; ; attempt++) {
    const key = keys[attempt % keys.length]
    const response = await request(supplierUrl(route.provider.url, path), { ...init, headers: { ...(init.headers as Json), Authorization: `Bearer ${key}`, 'x-api-key': key } as Record<string, string>, signal: AbortSignal.timeout(120000) })
    if (!busy(response.status)) return response
    const lap = (attempt + 1) % keys.length === 0
    const wait = lap ? pause : 0
    if (Date.now() + wait > deadline) return response
    await response.body?.cancel().catch(() => undefined)
    if (wait) {
      await sleep(wait)
      pause = Math.min(pause * 2, 8000)
    }
  }
}

/** Mensagem do fornecedor que pode ir ao cliente (sem o nome dele); senão, uma genérica. */
function errorMessage(text: string, status: number) {
  let message = ''
  try {
    const data = JSON.parse(text) as { error?: { message?: unknown }; message?: unknown }
    message = String(data.error?.message ?? data.message ?? '')
  } catch { /* corpo que não é JSON */ }
  if (message && message.length < 300 && !/delver|cloudflare|<html/i.test(message)) return message
  return status >= 500 || status === 429 ? 'O vídeo está temporariamente indisponível. Tente novamente em instantes.' : 'Pedido de vídeo inválido.'
}

/** Cria o vídeo, registra no consumo (é o que conta no limite) e devolve a resposta com o nosso id. */
export async function createVideo(env: Env, request: typeof fetch, input: { route: RouterRoute; payload: Json; clientId: string; secret: string }) {
  const started = Date.now()
  const response = await supplierCall(env, request, input.route, '/v1/videos', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input.payload, model: input.route.upstream }),
  })
  const text = await response.text().catch(() => '')
  await recordUsage(env, request, { client_id: input.clientId, requested_alias: input.route.alias, status_code: response.status, input_tokens: 0, output_tokens: 0, latency_ms: Date.now() - started })
  if (!response.ok) {
    console.error('Fornecedor recusou o vídeo', input.route.upstream, response.status, text.replace(/\s+/g, ' ').slice(0, 300))
    return { status: response.status >= 500 ? 503 : response.status, body: { error: { type: response.status === 429 ? 'rate_limit_error' : 'invalid_request_error', message: errorMessage(text, response.status) } } }
  }
  let data: unknown = null
  try { data = JSON.parse(text) } catch { /* tratado abaixo */ }
  if (!data) return { status: 502, body: { error: { type: 'api_error', message: 'O vídeo está temporariamente indisponível. Tente novamente em instantes.' } } }
  return { status: 200, body: rewriteVideo(data, input.route.alias, input.clientId, input.secret) }
}

/** Situação do vídeo (JSON) ou o arquivo (content), pelo id do fornecedor. Não conta no limite. */
export async function videoItem(env: Env, request: typeof fetch, input: { route: RouterRoute; supplierId: string; content: boolean; clientId: string; secret: string }) {
  const path = `/v1/videos/${encodeURIComponent(input.supplierId)}${input.content ? '/content' : ''}`
  const response = await supplierCall(env, request, input.route, path, { method: 'GET' })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { status: response.status === 404 ? 404 : response.status >= 500 ? 503 : response.status, json: { error: { type: response.status === 404 ? 'not_found_error' : 'api_error', message: response.status === 404 ? 'Vídeo não encontrado.' : errorMessage(text, response.status) } } }
  }
  if (input.content) return { status: 200, file: Buffer.from(await response.arrayBuffer()), type: response.headers.get('content-type') || 'video/mp4' }
  return { status: 200, json: rewriteVideo(await response.json().catch(() => ({})), input.route.alias, input.clientId, input.secret) }
}
