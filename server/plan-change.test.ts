import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createAdminActions } from '../api/management.ts'
import { clearRouterCache, sealSecret } from './router.ts'

const SECRET = 'sb_secret_server'
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: SECRET, VITE_SUPABASE_ANON_KEY: 'public' }
const SUB = '11111111-1111-4111-8111-111111111111'
const USER = '792fcced-0000-4000-8000-000000000001'
const PROVIDER = { id: '33333333-3333-4333-8333-333333333333', name: 'Delver', base_url: 'https://fornecedor.example/v1', enabled: true }
const provider = { ...PROVIDER, encrypted_key: sealSecret('gw_master', SECRET, `router:provider:${PROVIDER.id}`) }
const ROUTER = [
  { alias: 'claude-fable-5.2', label: 'Claude Fable 5.2', upstream_model: 'x/fable', in_pro: true, provider },
  { alias: 'argon-4', label: 'Argon 4', upstream_model: 'x/argon', in_pro: true, provider },
  { alias: 'gpt-6-astra', label: 'Astra 6', upstream_model: 'x/astra', in_pro: false, provider },
  { alias: 'claude-opus-5.5', label: 'Claude Opus 5.5', upstream_model: 'x/opus', in_pro: true, provider },
]
const future = new Date(Date.now() + 20 * 86400000).toISOString()

beforeEach(() => clearRouterCache())

/** Supabase simulado: a assinatura, as chaves do Roteador ligadas à conta e o que foi gravado. */
function fixture(subscription: Record<string, unknown>, keys: Record<string, unknown>[] = []) {
  const patches: { path: string; body: any }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin-1', email: 'alissonmedeiroz007@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (init.method === 'PATCH') {
      patches.push({ path: url.pathname + url.search, body: JSON.parse(String(init.body)) })
      return Response.json([{ id: 'ok' }])
    }
    if (url.pathname.endsWith('/billing_subscription_state')) return Response.json([{ id: SUB, user_id: USER, ...subscription }])
    if (url.pathname.endsWith('/router_models')) return Response.json(ROUTER)
    if (url.pathname.endsWith('/gateway_clients')) return Response.json(keys.length ? [{ id: 'client-1' }] : [])
    if (url.pathname.endsWith('/router_keys')) return Response.json(keys)
    return Response.json([])
  }) as typeof fetch
  return { patches, act: createAdminActions(env, request) }
}
const paid = { plan_code: 'devApi', billing_mode: 'pix', entitled: true, paid_until: future }

test('troca de plano: Dev + API vira Pro sem mexer no período pago, e a renovação passa a cobrar o Pro', async () => {
  const { patches, act } = fixture(paid)
  const result = await act('Bearer t', { action: 'subscription-plan', id: SUB, plan: 'pro' }) as any
  assert.equal(result.plan, 'Pro')
  const sub = patches.find((p) => p.path.startsWith('/rest/v1/billing_subscriptions'))!
  assert.deepEqual(sub.body, { plan_code: 'pro', api_enabled: true, models: ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5'], amount_cents: 11999 })
  assert.ok(!('paid_until' in sub.body), 'o período pago não muda')
})

test('troca de plano: chave do Roteador com lista de modelos ganha os do plano novo; com todos, fica como está', async () => {
  const { patches, act } = fixture(paid, [
    { id: 'k-list', name: 'Lucas', models: ['gpt-6-astra'] },
    { id: 'k-all', name: 'Lucas (todos)', models: null },
  ])
  const result = await act('Bearer t', { action: 'subscription-plan', id: SUB, plan: 'pro' }) as any
  const key = patches.find((p) => p.path.includes('/router_keys'))!
  assert.match(key.path, /id=eq\.k-list/)
  assert.deepEqual(key.body.models.sort(), ['argon-4', 'claude-fable-5.2', 'claude-opus-5.5', 'gpt-6-astra'])
  assert.equal(patches.filter((p) => p.path.includes('/router_keys')).length, 1, 'a chave com todos os modelos não é alterada')
  assert.deepEqual(result.keys.map((k: any) => [k.name, k.updated]), [['Lucas', true], ['Lucas (todos)', false]])
  assert.equal(result.keysChecked, true)
})

test('troca de plano recusa cartão, pedido não pago, plano igual e plano inválido, sem gravar nada', async () => {
  for (const [subscription, plan, message] of [
    [{ ...paid, billing_mode: 'recurring' }, 'pro', /cartão/],
    [{ ...paid, entitled: false }, 'pro', /paga e ativa/],
    [{ ...paid, paid_until: new Date(Date.now() - 1000).toISOString() }, 'pro', /paga e ativa/],
    [paid, 'devApi', /já é do plano Dev \+ API/],
    [paid, 'toString', /plano válido/],
  ] as const) {
    const { patches, act } = fixture(subscription)
    await assert.rejects(act('Bearer t', { action: 'subscription-plan', id: SUB, plan }), message)
    assert.equal(patches.length, 0, String(message))
  }
  const { act } = fixture(paid)
  await assert.rejects(act('Bearer t', { action: 'subscription-plan', id: 'nao-e-uuid', plan: 'pro' }), /Assinatura inválida/)
})
