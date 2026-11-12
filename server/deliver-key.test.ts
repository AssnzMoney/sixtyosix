import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdminActions } from '../api/management.ts'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server', VITE_SUPABASE_ANON_KEY: 'public' }
const uid = '22222222-2222-4222-8222-222222222222'
const sub = '33333333-3333-4333-8333-333333333333'
const keyId = '44444444-4444-4444-8444-444444444444'
const client = '55555555-5555-4555-8555-555555555555'

function fixture(options: { linkFails?: boolean } = {}) {
  const calls: { method: string; path: string; body: any; prefer: string }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const headers = (init.headers || {}) as Record<string, string>
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method: init.method || 'GET', path: url.pathname, body, prefer: String(headers.Prefer || '') })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin', email: 'alissonmedeiroz007@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.pathname === `/auth/v1/admin/users/${uid}`) return Response.json({ id: uid, email: 'andre@exemplo.com', user_metadata: { custom_name: 'Andre', whatsapp: '5581987654321' } })
    if (url.pathname === '/rest/v1/rpc/router_create_key') return Response.json({ id: keyId, gateway_client_id: client, expires_at: '2026-12-11T12:00:00Z' })
    if (url.pathname === '/rest/v1/router_keys') return String(headers.Prefer || '').includes('return=representation') ? Response.json([{ id: keyId, gateway_client_id: client }]) : new Response(null, { status: 204 })
    if (url.pathname === '/rest/v1/gateway_clients') return options.linkFails ? Response.json({ message: 'coluna inesperada' }, { status: 400 }) : new Response(null, { status: 204 })
    if (url.pathname === '/rest/v1/rpc/admin_register_delivery') return Response.json(body.p_id)
    throw new Error('Destino inesperado ' + url.pathname)
  }) as typeof fetch
  return { calls, actions: createAdminActions(env, request) }
}

test('entregar chave: cria no Roteador, liga à conta do cliente e registra para ele confirmar', async () => {
  const { calls, actions } = fixture()
  const tomorrow = new Date(Date.now() + 40 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const result = await actions('Bearer ok', { action: 'deliver-key', user_id: uid, subscription_id: sub, expires: tomorrow, models: ['claude-fable-5-1'] }) as Record<string, any>

  assert.match(result.key, /^sk-rt-[A-Za-z0-9_-]{40,}$/)
  assert.equal(result.hint, result.key.slice(-4))

  const create = calls.find((c) => c.path === '/rest/v1/rpc/router_create_key')!
  assert.equal(create.body.p_name, 'Andre')
  assert.equal(create.body.p_contact, '+55 (81) 98765-4321')
  assert.deepEqual(create.body.p_models, ['claude-fable-5-1'])
  assert.ok(!JSON.stringify(create.body).includes(result.key), 'a chave nunca vai em texto para o banco')

  const exact = calls.find((c) => c.path === '/rest/v1/router_keys' && c.method === 'PATCH')!
  assert.equal(exact.body.expires_at, new Date(`${tomorrow}T23:59:59-03:00`).toISOString(), 'vale até o fim do dia em Brasília')
  assert.match(exact.prefer, /return=representation/)

  const link = calls.find((c) => c.path === '/rest/v1/gateway_clients' && c.body?.user_id)!
  assert.equal(link.body.user_id, uid, 'chave ligada à conta do cliente')

  const delivery = calls.find((c) => c.path === '/rest/v1/rpc/admin_register_delivery')!
  assert.equal(delivery.body.p_key_hint, result.hint)
  assert.equal(delivery.body.p_base_url, 'https://www.sixtysix.online')
  assert.equal(delivery.body.p_subscription_id, sub)
  assert.equal(delivery.body.p_user_id, uid)
  assert.equal(result.deliveryId, delivery.body.p_id)
  assert.equal(result.email, 'skipped')
})

test('entregar chave: se não der para ligar à conta, avisa (linked: false) em vez de seguir calado', async () => {
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const { calls, actions } = fixture({ linkFails: true })
    const later = new Date(Date.now() + 10 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const result = await actions('Bearer ok', { action: 'deliver-key', user_id: uid, expires: later, models: ['claude-fable-5-1'] }) as Record<string, any>
    assert.equal(result.linked, false)
    assert.match(result.key, /^sk-rt-/, 'a chave é criada mesmo quando não dá para ligar à conta')
    assert.ok(result.deliveryId, 'a entrega continua sendo registrada')
    assert.ok(calls.some((c) => c.path === '/rest/v1/gateway_clients'), 'tentou ligar à conta')
    assert.ok(errors.length > 0, 'a falha fica registrada no log, não some em silêncio')
  } finally {
    console.error = originalError
  }
})

test('entregar chave recusa validade no passado, cliente inválido e lista de modelos vazia', async () => {
  const { actions } = fixture()
  await assert.rejects(actions('Bearer ok', { action: 'deliver-key', user_id: uid, expires: '2020-01-01' }), { status: 400 })
  await assert.rejects(actions('Bearer ok', { action: 'deliver-key', user_id: 'x', expires: '2030-01-01' }), { status: 400 })
  const later = new Date(Date.now() + 10 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  await assert.rejects(actions('Bearer ok', { action: 'deliver-key', user_id: uid, expires: later, models: [] }), { status: 400 })
})
