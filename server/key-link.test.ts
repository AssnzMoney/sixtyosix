import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdminActions } from '../api/management.ts'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server', VITE_SUPABASE_ANON_KEY: 'public' }
const keyId = '44444444-4444-4444-8444-444444444444'
const client = '55555555-5555-4555-8555-555555555555'
const celso = '66666666-6666-4666-8666-666666666666'

function fixture() {
  const patches: unknown[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin', email: 'alissonmedeiroz007@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ users: [{ id: 'outro', email: 'outro@x.com' }, { id: celso, email: 'Celso@Exemplo.com', user_metadata: { custom_name: 'Celso' } }] })
    if (url.pathname === '/rest/v1/router_keys') return Response.json([{ gateway_client_id: client }])
    if (url.pathname === '/rest/v1/gateway_clients' && init.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body)))
      return Response.json([{ id: client }])
    }
    throw new Error('Destino inesperado ' + url.pathname)
  }) as typeof fetch
  return { patches, actions: createAdminActions(env, request) }
}

test('ligar chave do Roteador a uma conta pelo e-mail (sem diferenciar maiúsculas)', async () => {
  const { patches, actions } = fixture()
  const result = await actions('Bearer token', { action: 'router-key-link', id: keyId, email: '  celso@exemplo.com ' }) as { user: { id: string; email: string; name: string } }
  assert.equal(result.user.id, celso)
  assert.equal(result.user.name, 'Celso')
  assert.deepEqual(patches, [{ user_id: celso }])
})

test('e-mail vazio desliga a chave da conta; e-mail sem conta avisa para criar a conta', async () => {
  const { patches, actions } = fixture()
  await actions('Bearer token', { action: 'router-key-link', id: keyId, email: '' })
  assert.deepEqual(patches, [{ user_id: null }])
  await assert.rejects(actions('Bearer token', { action: 'router-key-link', id: keyId, email: 'ninguem@x.com' }), /criar a conta/)
  await assert.rejects(actions('Bearer token', { action: 'router-key-link', id: keyId, email: 'nao-e-email' }), /e-mail válido/)
  assert.equal(patches.length, 1)
})
