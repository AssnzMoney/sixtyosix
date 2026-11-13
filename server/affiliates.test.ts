import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAccountService } from '../api/account.ts'
import { createAdminActions } from '../api/management.ts'
import { createBillingService } from '../api/mercadopago.ts'
import { captureReferral } from '../src/lib/referral.ts'

const UID = '1a9ff780-4164-4952-a9af-cbf41cc02042'
const OTHER = '2b8ee780-4164-4952-a9af-cbf41cc02043'
const config = { url: 'https://example.supabase.co', secret: 'sb_secret_private', publicKey: 'public' }
type Call = { url: URL; method: string; body: any }

/** Supabase simulado para o painel do cliente: `rows` responde por tabela/rpc. */
function account(rows: Record<string, unknown>) {
  const calls: Call[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input)), body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method: init.method || 'GET', body })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: UID, email_confirmed_at: '2026-01-01T00:00:00Z' })
    const name = url.pathname.replace('/rest/v1/', '')
    if (name in rows) return Response.json(rows[name])
    return Response.json([])
  }) as typeof fetch
  return { calls, service: createAccountService(config, request) }
}

test('painel: quem não é afiliado só recebe enabled false', async () => {
  const { service } = account({ affiliates: [] })
  assert.deepEqual(await service.execute('GET', 'affiliate', 'Bearer t'), { enabled: false })
  const off = account({ affiliates: [{ code: 'joao', days_per_payment: 7, enabled: false }] })
  assert.deepEqual(await off.service.execute('GET', 'affiliate', 'Bearer t'), { enabled: false })
})

test('painel do afiliado: link, indicados, quem pagou e dias ganhos (estorno não conta)', async () => {
  const { service } = account({
    affiliates: [{ code: 'joao', days_per_payment: 7, enabled: true }],
    affiliate_referrals: [{ referred_user_id: 'a', created_at: '2026-11-01' }, { referred_user_id: 'b', created_at: '2026-11-02' }, { referred_user_id: 'c', created_at: '2026-11-03' }],
    affiliate_rewards: [
      { referred_user_id: 'a', days: 7, created_at: '2026-11-10', revoked_at: null },
      { referred_user_id: 'a', days: 7, created_at: '2026-12-10', revoked_at: null },
      { referred_user_id: 'b', days: 7, created_at: '2026-11-11', revoked_at: '2026-11-12' },
    ],
  })
  const result = await service.execute('GET', 'affiliate', 'Bearer t') as any
  assert.equal(result.link, 'https://www.sixtysix.online/convite/joao')
  assert.equal(result.referred, 3)
  assert.equal(result.paying, 1, 'b teve o pagamento estornado')
  assert.equal(result.totalDays, 14, 'renovação de a também conta')
  assert.equal(result.rewards.length, 3)
  assert.equal(result.rewards[2].revoked, true)
})

test('link: liga a conta logada ao código (em minúsculas) e recusa código inválido', async () => {
  const { calls, service } = account({ 'rpc/affiliate_claim': 'ok' })
  assert.deepEqual(await service.execute('POST', 'referral', 'Bearer t', { code: ' Joao ' }), { result: 'ok' })
  const rpc = calls.find((c) => c.url.pathname.endsWith('/rpc/affiliate_claim'))!
  assert.deepEqual(rpc.body, { p_user_id: UID, p_code: 'joao' }, 'a conta vem da sessão, nunca do navegador')
  await assert.rejects(service.execute('POST', 'referral', 'Bearer t', { code: '../x' }), /inválido/)
  await assert.rejects(service.execute('POST', 'referral', undefined, { code: 'joao' }), { status: 401 })
})

test('navegador: guarda o primeiro link válido por 30 dias e ignora código inválido', () => {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
  captureReferral('?ref=<script>')
  assert.equal(store.size, 0)
  captureReferral('?ref=Joao')
  assert.equal(JSON.parse(store.get('six-ref')!).code, 'joao')
  captureReferral('?ref=maria')
  assert.equal(JSON.parse(store.get('six-ref')!).code, 'joao', 'vale o primeiro link')
  store.set('six-ref', JSON.stringify({ code: 'joao', at: Date.now() - 31 * 86400000 }))
  captureReferral('?ref=maria')
  assert.equal(JSON.parse(store.get('six-ref')!).code, 'maria', 'depois de 30 dias, o link novo vale')
  delete (globalThis as any).localStorage
})

/** Admin simulado: contas pelo e-mail e a tabela affiliates (código repetido dá 23505). */
function admin(taken: string[] = []) {
  const calls: Call[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input)), body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method: init.method || 'GET', body })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin-1', email: 'alissonmedeiroz007@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ users: [{ id: OTHER, email: 'Joao.Silva@Exemplo.com', user_metadata: { custom_name: 'João' } }] })
    if (url.pathname.startsWith('/auth/v1/admin/users/')) return Response.json({ id: OTHER, email: 'joao.silva@exemplo.com', user_metadata: { custom_name: 'João' } })
    if (url.pathname === '/rest/v1/affiliates' && init.method === 'POST') {
      if (taken.includes(body.code)) return Response.json({ code: '23505' }, { status: 409 })
      return Response.json([{ ...body }])
    }
    return Response.json([])
  }) as typeof fetch
  const env = { SUPABASE_URL: config.url, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server', VITE_SUPABASE_ANON_KEY: 'public' }
  return { calls, act: createAdminActions(env, request) }
}

test('admin: ativa o afiliado pelo e-mail, com código tirado do e-mail e 7 dias por padrão', async () => {
  const { calls, act } = admin()
  const result = await act('Bearer t', { action: 'affiliate-save', email: 'joao.silva@exemplo.com' }) as any
  assert.equal(result.link, 'https://www.sixtysix.online/convite/joaosilva')
  const saved = calls.find((c) => c.url.pathname === '/rest/v1/affiliates' && c.method === 'POST')!
  assert.deepEqual({ user_id: saved.body.user_id, code: saved.body.code, days: saved.body.days_per_payment, enabled: saved.body.enabled }, { user_id: OTHER, code: 'joaosilva', days: 7, enabled: true })
})

test('admin: código ocupado ganha números; código digitado ocupado é recusado; dias e e-mail validados', async () => {
  const busy = admin(['joaosilva'])
  const result = await busy.act('Bearer t', { action: 'affiliate-save', email: 'joao.silva@exemplo.com' }) as any
  assert.match(result.code, /^joaosilva\d{2,3}$/)
  await assert.rejects(admin(['joao']).act('Bearer t', { action: 'affiliate-save', email: 'joao.silva@exemplo.com', code: 'joao' }), /já é de outro afiliado/)
  await assert.rejects(admin().act('Bearer t', { action: 'affiliate-save', email: 'joao.silva@exemplo.com', days: 90 }), /1 a 60 dias/)
  await assert.rejects(admin().act('Bearer t', { action: 'affiliate-save', email: 'ninguem@exemplo.com' }), /Nenhuma conta/)
})

test('pagamento Pix registrado chama os afiliados; falha dos afiliados não derruba o pagamento', async () => {
  const order = '11111111-1111-4111-8111-111111111111'
  const item = { id: order, user_id: UID, provider_id: 'pref1', merchant_id: '99', plan_code: 'pro', amount_cents: 11999, api_enabled: true, models: [], checkout_url: null, paid_until: null, billing_anchor: null, billing_mode: 'pix' }
  for (const broken of [false, true]) {
    const calls: Call[] = []
    const request = (async (input: string, init: RequestInit = {}) => {
      const url = new URL(String(input)), body = init.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url, method: init.method || 'GET', body })
      if (url.pathname === '/users/me') return Response.json({ id: 99 })
      if (url.pathname.endsWith('/billing_subscriptions')) return Response.json([item])
      if (url.pathname.endsWith('/billing_payments')) return Response.json([])
      if (url.pathname.endsWith('/rpc/affiliate_payment')) return broken ? Response.json({ message: 'função não existe' }, { status: 404 }) : Response.json('granted')
      if (url.pathname.includes('/rpc/')) return Response.json(true)
      throw new Error(`Unexpected path ${url.pathname}`)
    }) as typeof fetch
    const env = { SUPABASE_URL: config.url, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_private', VITE_SUPABASE_ANON_KEY: 'public', MERCADOPAGO_ACCESS_TOKEN: 'mp', MERCADOPAGO_WEBHOOK_SECRET: 'hook' }
    const service = createBillingService(env, request)
    const payment = { id: 456, collector_id: 99, external_reference: order, transaction_amount: 119.99, currency_id: 'BRL', live_mode: true, status: 'approved', date_approved: '2026-11-13T12:00:00Z', date_last_updated: '2026-11-13T12:01:00Z' }
    assert.equal(await service.process('payment', payment), 'processed', broken ? 'sem a migração, o pagamento segue' : 'com afiliados')
    const apply = calls.findIndex((c) => c.url.pathname.endsWith('/rpc/billing_apply_payment'))
    const reward = calls.findIndex((c) => c.url.pathname.endsWith('/rpc/affiliate_payment'))
    assert.ok(apply >= 0 && reward > apply, 'os dias só são conferidos depois de o pagamento ser gravado')
    assert.deepEqual(calls[reward].body, { p_payment_id: '456' })
  }
})
