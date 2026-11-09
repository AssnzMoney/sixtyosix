import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

type ObjectValue = Record<string, unknown>
type Env = Record<string, string | undefined>
class WebhookError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
const resources: Record<string, string> = {
  payment: 'v1/payments',
  subscription_preapproval: 'preapproval',
  subscription_authorized_payment: 'authorized_payments',
  subscription_preapproval_plan: 'preapproval_plan',
}
function object(value: unknown): ObjectValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {}
}
function identifier(value: unknown): string {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new WebhookError(400, 'Identificador inválido.')
  return id
}
export function validateSignature(secret: string, signature: string | undefined, requestId: string | undefined, id: string): void {
  if (!secret) throw new WebhookError(503, 'Configuração da assinatura do webhook pendente.')
  if (!signature || !requestId || requestId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new WebhookError(401, 'Assinatura inválida.')
  const fields = signature.split(',').map(part => part.trim().split('='))
  const timestamps = fields.filter(([key]) => key === 'ts')
  const versions = fields.filter(([key]) => key === 'v1')
  if (timestamps.length !== 1 || versions.length !== 1) throw new WebhookError(401, 'Assinatura inválida.')
  const ts = timestamps[0][1] || ''
  const digest = versions[0][1] || ''
  if (!/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/i.test(digest)) throw new WebhookError(401, 'Assinatura inválida.')
  const manifest = `id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest()
  if (!timingSafeEqual(expected, Buffer.from(digest, 'hex'))) throw new WebhookError(401, 'Assinatura inválida.')
  // Retries may retain the original timestamp. Durable deduplication handles replay.
}

export async function receiveNotification(input: {
  url: URL; body: ObjectValue; signature?: string; requestId?: string
}, env: Env = process.env, request: typeof fetch = fetch) {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET?.trim() || ''
  if (!secret) throw new WebhookError(503, 'Configuração da assinatura do webhook pendente.')
  const queryIds = input.url.searchParams.getAll('data.id')
  const queryTypes = input.url.searchParams.getAll('type')
  if (queryIds.length !== 1 || queryTypes.length > 1) throw new WebhookError(400, 'Notificação inválida.')
  const id = identifier(queryIds[0])
  validateSignature(secret, input.signature, input.requestId, id)
  const bodyData = object(input.body.data)
  if (bodyData.id !== undefined && identifier(bodyData.id).toLowerCase() !== id.toLowerCase()) throw new WebhookError(400, 'Notificação inconsistente.')
  const topic = String(input.body.type || queryTypes[0] || '')
  if (queryTypes[0] && input.body.type && queryTypes[0] !== input.body.type) throw new WebhookError(400, 'Notificação inconsistente.')
  if (!Object.prototype.hasOwnProperty.call(resources, topic)) return { received: true, ignored: true }
  const accessToken = env.MERCADOPAGO_ACCESS_TOKEN?.trim()
  const base = env.SUPABASE_URL?.replace(/\/+$/, '')
  const dbSecret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!accessToken || !base?.startsWith('https://') || !dbSecret) throw new WebhookError(503, 'Integração de pagamentos indisponível.')
  async function provider(path: string): Promise<ObjectValue> {
    const response = await request(`https://api.mercadopago.com/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    if (!response.ok) throw new WebhookError(503, 'Não foi possível confirmar a notificação no Mercado Pago.')
    return object(await response.json())
  }
  const merchant = await provider('users/me')
  const resource = await provider(`${resources[topic]}/${encodeURIComponent(id)}`)
  if (identifier(resource.id).toLowerCase() !== id.toLowerCase()) throw new WebhookError(400, 'Recurso inconsistente.')
  if (resource.collector_id !== undefined && String(resource.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
  // Only store facts fetched from the provider; the incoming payload cannot grant access.
  const snapshot: ObjectValue = {
    resource_id: id, topic, status: typeof resource.status === 'string' ? resource.status : null,
    merchant_id: String(merchant.id), provider_modified_at: resource.last_modified || resource.date_last_updated || null,
  }
  if (topic === 'payment') {
    snapshot.amount = resource.transaction_amount
    snapshot.currency = resource.currency_id
    snapshot.live_mode = resource.live_mode
    snapshot.approved_at = resource.date_approved
  }
  if (topic === 'subscription_preapproval') {
    snapshot.plan_id = resource.preapproval_plan_id || null
    snapshot.external_reference = typeof resource.external_reference === 'string' ? resource.external_reference.slice(0,200) : null
    snapshot.next_payment_date = resource.next_payment_date || null
    snapshot.recurring = object(resource.auto_recurring)
  }
  if (topic === 'subscription_authorized_payment') {
    snapshot.subscription_id = resource.preapproval_id
    const subscriptionId = identifier(resource.preapproval_id)
    const subscription = await provider(`preapproval/${encodeURIComponent(subscriptionId)}`)
    if (String(subscription.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
    const payment = object(resource.payment)
    snapshot.payment_id = payment.id || null
    snapshot.payment_status = payment.status || null
    snapshot.amount = resource.transaction_amount
    snapshot.currency = resource.currency_id
    snapshot.plan_id = subscription.preapproval_plan_id || null
    snapshot.external_reference = typeof subscription.external_reference === 'string' ? subscription.external_reference.slice(0,200) : null
    if (payment.id) {
      const confirmed = await provider(`v1/payments/${identifier(payment.id)}`)
      if (String(confirmed.collector_id) !== String(merchant.id)) throw new WebhookError(403, 'Notificação de outra conta.')
      snapshot.payment_status = confirmed.status
      snapshot.amount = confirmed.transaction_amount
      snapshot.currency = confirmed.currency_id
      snapshot.live_mode = confirmed.live_mode
      snapshot.approved_at = confirmed.date_approved
    }
  }
  // Identical facts have the same ID even when delivery headers differ. Different
  // provider statuses are retained, so an approved payment cannot hide a refund.
  const fingerprint = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
  const stored = await request(`${base}/rest/v1/billing_webhook_events?on_conflict=fingerprint`, {
    method: 'POST', headers: {
      apikey: dbSecret, ...(!dbSecret.startsWith('sb_secret_') ? { Authorization: `Bearer ${dbSecret}` } : {}),
      'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({ fingerprint, topic, resource_id: id, snapshot, state: 'awaiting_account_link' }),
    signal: AbortSignal.timeout(10000),
  })
  if (!stored.ok) throw new WebhookError(503, 'Não foi possível registrar a notificação. Tente novamente.')
  return { received: true }
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.statusCode = 200
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({
        service: 'SixtySix Mercado Pago webhook', endpoint: '/api/mercadopago/webhook',
        status: process.env.MERCADOPAGO_WEBHOOK_SECRET ? 'receiver_configured' : 'awaiting_webhook_secret',
        automaticKeyDelivery: false,
      }))
      return
    }
    if (req.method !== 'POST') { res.setHeader('Allow','GET, HEAD, POST'); throw new WebhookError(405, 'Método não permitido.') }
    let body = req.body
    if (body === undefined) {
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        if (Buffer.byteLength(raw) > 32768) throw new WebhookError(413, 'Notificação muito grande.')
      }
      try { body = JSON.parse(raw || '{}') } catch { throw new WebhookError(400, 'JSON inválido.') }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 32768) throw new WebhookError(400, 'Notificação inválida.')
    const single = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined
    const result = await receiveNotification({
      url: new URL(req.url || '/', 'https://www.sixtysix.online'), body: body as ObjectValue,
      signature: single(req.headers['x-signature']), requestId: single(req.headers['x-request-id']),
    })
    res.statusCode = 200
    res.end(JSON.stringify(result))
  } catch (error) {
    res.statusCode = error instanceof WebhookError ? error.status : 503
    res.end(JSON.stringify({ error: error instanceof WebhookError ? error.message : 'Webhook temporariamente indisponível.' }))
  }
}
