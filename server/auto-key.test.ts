import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAutoKeys, keyModels } from './auto-key.ts'
import { deviceOf } from './guard.ts'

const SUB = '11111111-1111-4111-8111-111111111111'
const USER = '22222222-2222-4222-8222-222222222222'
const env = { SUPABASE_URL: 'https://db.example.co', SUPABASE_SERVICE_ROLE_KEY: 'service-secret' }
const DAY = 86400000

type Row = Record<string, any>
/** Supabase de mentira: só o que o módulo usa (filtros eq/in/is.null, PATCH, POST com on_conflict). */
function fakeDb(seed: { subs?: Row[]; keys?: Row[]; clients?: Row[]; links?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    billing_subscription_state: seed.subs || [],
    router_keys: seed.keys || [],
    gateway_clients: seed.clients || [],
    billing_router_keys: seed.links || [],
  }
  let n = 0
  const match = (row: Row, params: URLSearchParams) => {
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue
      if (v.startsWith('eq.') && String(row[k]) !== v.slice(3)) return false
      if (v === 'is.null' && row[k] != null) return false
      if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(String(row[k]))) return false
    }
    return true
  }
  const fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    if (url.pathname.startsWith('/auth/v1/admin/users/')) return Response.json({ email: 'ana@example.com', user_metadata: { name: 'Ana', whatsapp: '81999990000' } })
    const name = url.pathname.replace('/rest/v1/', '')
    const body = init.body ? JSON.parse(String(init.body)) : null
    if (name === 'rpc/router_create_key') {
      const client = `c${++n}`, id = `k${n}`
      tables.gateway_clients.push({ id: client, user_id: null })
      const row = { id, gateway_client_id: client, token_hash: body.p_hash, token_prefix: body.p_prefix, encrypted_token: body.p_encrypted_token, models: body.p_models, expires_at: new Date(Date.now() + body.p_days * DAY).toISOString(), created_at: new Date().toISOString(), revoked_at: null }
      tables.router_keys.push(row)
      return Response.json(row)
    }
    if (name === 'rpc/router_set_blocked') {
      const key = tables.router_keys.find((k) => k.id === body.p_id)
      if (key) key.revoked_at = body.p_blocked ? new Date().toISOString() : null
      return Response.json(Boolean(key))
    }
    if (name === 'rpc/router_delete_key') {
      tables.router_keys = tables.router_keys.filter((k) => k.id !== body.p_id)
      return Response.json(true)
    }
    const table = tables[name]
    if (!table) throw new Error('Tabela inesperada: ' + name)
    if (!init.method || init.method === 'GET') return Response.json(table.filter((r) => match(r, url.searchParams)))
    if (init.method === 'PATCH') {
      const rows = table.filter((r) => match(r, url.searchParams))
      rows.forEach((r) => Object.assign(r, body))
      return Response.json(rows)
    }
    if (init.method === 'POST') {
      const key = url.searchParams.get('on_conflict')
      if (key && table.some((r) => r[key] === body[key])) return Response.json([])
      table.push({ ...body })
      return Response.json([body])
    }
    throw new Error('Método inesperado')
  }
  return { tables, fetch: fetch as typeof globalThis.fetch }
}
const paidUntil = (days: number) => new Date(Date.now() + days * DAY).toISOString()
const sub = (extra: Row = {}) => ({ id: SUB, user_id: USER, plan_code: 'pro', api_enabled: true, models: ['claude-fable-5-2'], paid_until: paidUntil(30), entitled: true, ...extra })

test('pagamento aprovado cria a chave do site, ligada à conta, até o fim do período', async () => {
  const db = fakeDb({ subs: [sub()] })
  const result = await createAutoKeys(env, db.fetch).sync(SUB)
  assert.equal(result, 'criada')
  const [link] = db.tables.billing_router_keys
  const key = db.tables.router_keys.find((k) => k.id === link.router_key_id)!
  assert.equal(key.models, null) // Pro: todos os modelos do Roteador
  assert.ok(Math.abs(Date.parse(key.expires_at) - Date.parse(sub().paid_until)) < 5000)
  assert.equal(db.tables.gateway_clients.find((c) => c.id === key.gateway_client_id)!.user_id, USER)
})

test('Dev + API recebe só os modelos do plano; Dev sem API não ganha chave', async () => {
  assert.deepEqual(keyModels({ plan_code: 'devApi', models: ['gpt-6-astra', 'glm-5'] }), ['gpt-6-astra', 'glm-5'])
  const db = fakeDb({ subs: [sub({ plan_code: 'dev', api_enabled: false })] })
  assert.equal(await createAutoKeys(env, db.fetch).sync(SUB), 'sem_api')
  assert.equal(db.tables.router_keys.length, 0)
})

test('renovação estende a mesma chave; estorno puxa a validade de volta', async () => {
  const db = fakeDb({ subs: [sub()] })
  const keys = createAutoKeys(env, db.fetch)
  await keys.sync(SUB)
  db.tables.billing_subscription_state[0].paid_until = paidUntil(60)
  assert.equal(await keys.sync(SUB), 'renovada')
  assert.equal(db.tables.router_keys.length, 1)
  assert.ok(Date.parse(db.tables.router_keys[0].expires_at) > Date.now() + 59 * DAY)
  db.tables.billing_subscription_state[0].paid_until = paidUntil(30)
  await keys.sync(SUB) // sem estorno, não diminui
  assert.ok(Date.parse(db.tables.router_keys[0].expires_at) > Date.now() + 59 * DAY)
  await keys.sync(SUB, { shrink: true })
  assert.ok(Date.parse(db.tables.router_keys[0].expires_at) < Date.now() + 31 * DAY)
})

test('cliente que já tinha chave do WhatsApp: a chave é adotada, não duplicada', async () => {
  const old = { id: 'old', gateway_client_id: 'c-old', created_at: new Date(Date.now() - 20 * DAY).toISOString(), expires_at: paidUntil(5), revoked_at: null, models: null }
  const trial = { id: 'trial', gateway_client_id: 'c-trial', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 3 * 3600000).toISOString(), revoked_at: null }
  const db = fakeDb({ subs: [sub()], keys: [trial, old], clients: [{ id: 'c-old', user_id: USER }, { id: 'c-trial', user_id: USER }] })
  assert.equal(await createAutoKeys(env, db.fetch).sync(SUB), 'adotada')
  assert.equal(db.tables.billing_router_keys[0].router_key_id, 'old') // nunca a do teste grátis
  assert.equal(db.tables.router_keys.length, 2)
  assert.ok(Date.parse(old.expires_at) > Date.now() + 29 * DAY)
})

test('ver a chave registra a entrega uma vez só; plano vencido não mostra', async () => {
  const db = fakeDb({ subs: [sub()] })
  const keys = createAutoKeys(env, db.fetch)
  const first = await keys.reveal(USER, { ip: '200.1.2.3', userAgent: 'Chrome' })
  assert.match(first.key, /^sk-rt-/)
  const link = db.tables.billing_router_keys[0]
  assert.equal(link.revealed_ip, '200.1.2.3')
  const when = link.revealed_at
  await keys.reveal(USER, { ip: '9.9.9.9' })
  assert.equal(db.tables.billing_router_keys[0].revealed_at, when)
  assert.equal(db.tables.billing_router_keys[0].revealed_ip, '200.1.2.3')
  db.tables.billing_subscription_state[0].paid_until = new Date(Date.now() - DAY).toISOString()
  await assert.rejects(keys.reveal(USER), { status: 409 })
})

test('trocar a chave bloqueia a antiga na hora e respeita o intervalo', async () => {
  const db = fakeDb({ subs: [sub()] })
  const keys = createAutoKeys(env, db.fetch)
  const before = await keys.reveal(USER)
  const after = await keys.rotate(USER)
  assert.notEqual(after.key, before.key)
  const blocked = db.tables.router_keys.filter((k) => k.revoked_at)
  assert.equal(blocked.length, 1)
  assert.equal(db.tables.billing_router_keys[0].router_key_id, db.tables.router_keys.find((k) => !k.revoked_at)!.id)
  assert.equal((await keys.reveal(USER)).key, after.key)
  await assert.rejects(keys.rotate(USER), { status: 429 })
})

test('dispositivo: instalação do Claude Code é sinal forte; o resto só identifica a ferramenta', () => {
  const cc = deviceOf({ 'user-agent': 'claude-cli/2.1.323 (external, cli)', 'x-stainless-os': 'Windows', 'x-stainless-arch': 'x64' }, { metadata: { user_id: 'user_' + 'ab'.repeat(32) + '_account__session_123' } })
  assert.match(cc.id!, /^cc:[0-9a-f]{32}$/)
  assert.equal(cc.label, 'Claude Code · Windows x64')
  const same = deviceOf({ 'user-agent': 'claude-cli/2.1.400 (external, cli)' }, { metadata: { user_id: 'user_' + 'ab'.repeat(32) + '_account__session_999' } })
  assert.equal(same.id, cc.id) // outra sessão e outra versão, mesma instalação
  const codex = deviceOf({ 'user-agent': 'codex_cli_rs/0.40.0 (Windows 10.0.19045; x86_64) WindowsTerminal' })
  assert.match(codex.id!, /^ua:/)
  assert.equal(codex.label, 'Codex · Windows')
  assert.deepEqual(deviceOf({}), { id: null, label: null })
})
