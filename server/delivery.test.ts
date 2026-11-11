import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAccountService } from '../api/account.ts'
import { createAdminActions, createAdminService } from '../api/management.ts'

const uid = '1a9ff780-4164-4952-a9af-cbf41cc02042'
const deliveryId = '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const config = { url: 'https://example.supabase.co', secret: 'server-only-secret', publicKey: 'public-key' }
const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server', VITE_SUPABASE_ANON_KEY: 'public' }

type Call = { url: URL; init: RequestInit }
function accountFixture(row: Record<string, unknown> | null, options: { tableMissing?: boolean; rpc?: unknown } = {}) {
  const calls: Call[] = []
  const fake = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: uid, email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.pathname.endsWith('/credential_deliveries')) {
      if (options.tableMissing) return Response.json({ code: 'PGRST205' }, { status: 404 })
      return Response.json(row ? [row] : [])
    }
    if (url.pathname.endsWith('/rpc/account_confirm_delivery')) return Response.json(options.rpc ?? '2026-11-11T12:00:00+00:00')
    throw new Error('Destino inesperado ' + url.pathname)
  }
  return { calls, service: createAccountService(config, fake as typeof fetch) }
}
const pendingRow = {
  id: deliveryId, product: 'claude', key_hint: '9f3a', base_url: 'https://api.fornecedor.com', model_id: null,
  delivered_at: '2026-11-10T00:00:00Z', expires_at: null, replaced_at: null, revoked_at: null, confirmed_at: null,
}

test('cliente vê só as próprias credenciais, sem fornecedor nem observações', async () => {
  const { calls, service } = accountFixture(pendingRow)
  const result = await service.execute('GET', 'credentials', 'Bearer ok') as { available: boolean; credentials: Record<string, unknown>[] }
  assert.equal(result.available, true)
  assert.equal(result.credentials[0].state, 'pending')
  const query = calls.find((c) => c.url.pathname.endsWith('/credential_deliveries'))!.url.searchParams
  assert.equal(query.get('user_id'), `eq.${uid}`)
  for (const hidden of ['supplier', 'notes', 'created_by', 'confirm_ip']) assert.ok(!query.get('select')!.includes(hidden), hidden)
})

test('sem a migração, as credenciais ficam indisponíveis sem derrubar o painel', async () => {
  const { service } = accountFixture(null, { tableMissing: true })
  assert.deepEqual(await service.execute('GET', 'credentials', 'Bearer ok'), { available: false, credentials: [] })
})

test('confirmação grava IP, navegador e o texto exato aceito', async () => {
  const { calls, service } = accountFixture(pendingRow)
  const result = await service.execute('POST', 'confirm-delivery', 'Bearer ok', { id: deliveryId }, undefined, { ip: '203.0.113.9', userAgent: 'Teste/1.0' })
  assert.deepEqual(result, { confirmed_at: '2026-11-11T12:00:00+00:00' })
  const rpc = calls.find((c) => c.url.pathname.endsWith('/rpc/account_confirm_delivery'))!
  const args = JSON.parse(String(rpc.init.body))
  assert.equal(args.p_user_id, uid)
  assert.equal(args.p_ip, '203.0.113.9')
  assert.equal(args.p_user_agent, 'Teste/1.0')
  assert.equal(args.p_text, 'Confirmo que recebi pelo WhatsApp a chave terminada em …9f3a e a URL https://api.fornecedor.com.')
})

test('confirmação de credencial substituída, de outro cliente ou repetida', async () => {
  await assert.rejects(accountFixture({ ...pendingRow, replaced_at: '2026-11-11T00:00:00Z' }).service.execute('POST', 'confirm-delivery', 'Bearer ok', { id: deliveryId }), { status: 409 })
  await assert.rejects(accountFixture(null).service.execute('POST', 'confirm-delivery', 'Bearer ok', { id: deliveryId }), { status: 404 })
  await assert.rejects(accountFixture(pendingRow).service.execute('POST', 'confirm-delivery', 'Bearer ok', { id: 'x' }), { status: 400 })
  const already = accountFixture({ ...pendingRow, confirmed_at: '2026-11-10T10:00:00Z' })
  assert.deepEqual(await already.service.execute('POST', 'confirm-delivery', 'Bearer ok', { id: deliveryId }), { confirmed_at: '2026-11-10T10:00:00Z' })
  assert.ok(!already.calls.some((c) => c.url.pathname.includes('/rpc/')), 'não regrava a confirmação')
})

function adminFixture(email = 'alissonmedeiroz007@gmail.com', rpcResult: unknown = deliveryId) {
  const calls: Call[] = []
  const fake = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    if (url.pathname === '/auth/v1/user') return Response.json({ id: uid, email, email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ users: [{ id: uid, email: 'c@x.com', user_metadata: { custom_name: 'Ana', whatsapp: '(81) 99237-6036' } }] })
    if (url.pathname.includes('/rpc/')) return Response.json(rpcResult)
    throw new Error('Destino inesperado ' + url.pathname)
  }
  return { calls, actions: createAdminActions(env, fake as typeof fetch), read: createAdminService(env, fake as typeof fetch) }
}
const delivery = {
  id: deliveryId, user_id: uid, product: 'claude', supplier: 'Fornecedor A', key_hint: '9f3a', base_url: 'https://api.fornecedor.com',
}

test('admin lê o WhatsApp do cliente já normalizado', async () => {
  const { read } = adminFixture()
  const result = await read('Bearer ok', new URLSearchParams({ resource: 'users' }))
  assert.equal(result.rows[0].whatsapp, '5581992376036')
})

test('ações do admin exigem administrador e ação explícita', async () => {
  await assert.rejects(adminFixture('outsider@example.com').actions('Bearer ok', { action: 'register-delivery', delivery }), { status: 403 })
  const { calls, actions } = adminFixture()
  await assert.rejects(actions('Bearer ok', {}), { status: 400 })
  assert.ok(!calls.some((c) => c.url.pathname.includes('account_revoke_trial')), 'POST sem ação não revoga testes')
})

test('registrar entrega grava o e-mail do admin e recusa a chave inteira', async () => {
  const { calls, actions } = adminFixture()
  assert.deepEqual(await actions('Bearer ok', { action: 'register-delivery', delivery }), { id: deliveryId, email: 'skipped' })
  const args = JSON.parse(String(calls.find((c) => c.url.pathname.endsWith('/rpc/admin_register_delivery'))!.init.body))
  assert.equal(args.p_created_by, 'alissonmedeiroz007@gmail.com')
  assert.equal(args.p_key_hint, '9f3a')
  await assert.rejects(actions('Bearer ok', { action: 'register-delivery', delivery: { ...delivery, key_hint: 'sk-ant-api03-AbCdEf0123456789XyZ' } }), { status: 400 })
  await assert.rejects(adminFixture(undefined, null).actions('Bearer ok', { action: 'register-delivery', delivery: { ...delivery, replaces: '33333333-3333-4333-8333-333333333333' } }), { status: 409 })
})

test('revogar entrega valida o id e informa quando já estava revogada', async () => {
  await assert.rejects(adminFixture().actions('Bearer ok', { action: 'revoke-delivery', id: 'x' }), { status: 400 })
  assert.deepEqual(await adminFixture(undefined, true).actions('Bearer ok', { action: 'revoke-delivery', id: deliveryId }), { ok: true })
  await assert.rejects(adminFixture(undefined, false).actions('Bearer ok', { action: 'revoke-delivery', id: deliveryId }), { status: 409 })
})
