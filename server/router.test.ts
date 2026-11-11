import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import accessHandler, { seal } from '../api/access.ts'
import { clearRouterCache, createRouterAdmin, loadRouter, routerStatus, sealSecret, unsealSecret } from './router.ts'
import { suggestAlias, suggestLabel } from '../src/lib/routerModels.ts'

/** O fetch real, para o teste chamar o servidor local enquanto o do servidor é simulado. */
const client = globalThis.fetch
const encode = (text: string) => new TextEncoder().encode(text)
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const SUPABASE = 'https://example.supabase.co'
const SECRET = 'sb_secret_private'
const PROVIDER = { id: '33333333-3333-4333-8333-333333333333', name: 'Delver', base_url: 'https://fornecedor.example/v1', enabled: true }
const uid = '1a9ff780-4164-4952-a9af-cbf41cc02042'
const trialClient = '22222222-2222-4222-8222-222222222222'
const manualClient = '44444444-4444-4444-8444-444444444444'
const day = 86400000

const providerRow = (overrides: Record<string, unknown> = {}) => ({ ...PROVIDER, encrypted_key: sealSecret('gw_master', SECRET, `router:provider:${PROVIDER.id}`), ...overrides })
const models = (provider = providerRow()) => [
  { alias: 'claude-opus-5-5', label: 'Claude Opus 5.5', upstream_model: 'anthropic/claude-opus-5-5', in_pro: true, provider },
  { alias: 'argon-4', label: 'Argon 4', upstream_model: 'google/gemini-4-argon', in_pro: true, provider },
  { alias: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', upstream_model: 'openai/gpt-6.1-sol', in_pro: false, provider },
]

beforeEach(() => clearRouterCache())

test('sugestões de nome escondem o provedor e reaproveitam o Argon 4', () => {
  assert.equal(suggestAlias('anthropic/claude-opus-5-5'), 'claude-opus-5-5')
  assert.equal(suggestAlias('google/gemini-4-argon'), 'argon-4')
  assert.equal(suggestAlias('Some Model 2'), 'some-model-2')
  assert.equal(suggestLabel('claude-opus-5-5'), 'Claude Opus 5.5')
  assert.equal(suggestLabel('novo-modelo', 'Novo Modelo'), 'Novo Modelo')
})

test('a key do provedor só abre com o segredo e o provedor certos', () => {
  const sealed = sealSecret('gw_master', SECRET, 'router:provider:a')
  assert.equal(unsealSecret(sealed, SECRET, 'router:provider:a'), 'gw_master')
  assert.throws(() => unsealSecret(sealed, SECRET, 'router:provider:b'))
  assert.throws(() => unsealSecret(sealed, 'outro-segredo', 'router:provider:a'))
  assert.ok(!sealed.includes('gw_master'))
})

test('o roteador ignora provedor desligado e fica vazio sem a migração', async () => {
  const env = { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET }
  const router = await loadRouter(env, (async () => Response.json([...models(), { alias: 'x', label: 'X', upstream_model: 'x', in_pro: true, provider: providerRow({ id: 'off', enabled: false }) }])) as typeof fetch)
  assert.deepEqual([...router.routes.keys()], ['claude-opus-5-5', 'argon-4', 'gpt-6.1-sol'])
  assert.deepEqual(router.proAliases, ['claude-opus-5-5', 'argon-4'])
  assert.equal(router.routes.get('argon-4')?.provider.key, 'gw_master')
  clearRouterCache()
  const empty = await loadRouter(env, (async () => new Response('{"message":"relation router_models does not exist"}', { status: 404 })) as typeof fetch)
  assert.equal(empty.routes.size, 0)
})

type Call = { url: string; init: RequestInit }
type Manual = { models: string[] | null; expires_at: string; revoked_at: string | null }
/** Sobe o /api/access de verdade com Supabase e provedor simulados. */
async function withAccess(options: { supplier?: (url: string, init: RequestInit) => Response; manual?: Manual }, run: (base: string, usage: Record<string, unknown>[], calls: Call[]) => Promise<void>) {
  const nativeFetch = globalThis.fetch
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  Object.assign(process.env, { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET })
  const usage: Record<string, unknown>[] = [], calls: Call[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    if (url.startsWith(`${SUPABASE}/rest/v1/gateway_usage`)) { usage.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }) }
    if (url.startsWith(`${SUPABASE}/rest/v1/router_models`)) return Response.json(models())
    if (url.startsWith(`${SUPABASE}/rest/v1/gateway_trials`)) {
      return Response.json([{ user_id: uid, gateway_client_id: trialClient, expires_at: new Date(Date.now() + day).toISOString(), revoked_at: null, encrypted_upstream: seal('sk-flg-bridge', SECRET, `${uid}:upstream`) }])
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/router_keys`)) {
      assert.ok(url.includes(sha('sk-rt-manual')))
      return Response.json(options.manual ? [{ gateway_client_id: manualClient, ...options.manual }] : [])
    }
    calls.push({ url, init })
    if (url.startsWith('https://66cloud.vercel.app/')) return Response.json({ data: [{ id: 'claude-fable-5-1' }, { id: 'argon-4' }] })
    if (!options.supplier) throw new Error('não deveria chamar o provedor')
    return options.supplier(url, init)
  }) as typeof fetch
  const server = createServer(accessHandler)
  try {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/access?action=proxy&path=`, usage, calls)
  } finally {
    globalThis.fetch = nativeFetch
    for (const key of keys) if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]
    await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) })
  }
}
const post = (base: string, path: string, key: string, body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  client(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, ...headers }, body: JSON.stringify(body) })
const sse = () => new Response(new ReadableStream({
  start(controller) {
    controller.enqueue(encode('event: message_start\ndata: {"type":"message_start","message":{"model":"anthropic/claude-opus-5-5","usage":{"input_tokens":20,"output_tokens":1}}}\n\n'))
    controller.enqueue(encode('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":8}}\n\n'))
    controller.close()
  },
}), { headers: { 'Content-Type': 'text/event-stream', 'set-cookie': 'fornecedor=1' } })

test('teste grátis usa o provedor do Roteador com a key mestra, esconde o provedor e grava o consumo', async () => {
  await withAccess({ supplier: sse }, async (base, usage, calls) => {
    const response = await post(base, '/v1/messages&beta=true', 'sk-sx-cliente', { model: 'claude-opus-5-5', stream: true, max_tokens: 10, messages: [{ role: 'user', content: 'oi' }] }, { 'anthropic-version': '2023-06-01' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('set-cookie'), null)
    const text = await response.text()
    assert.ok(text.includes('"model":"claude-opus-5-5"') && !text.includes('anthropic/'))
    assert.equal(calls[0].url, 'https://fornecedor.example/v1/messages?beta=true')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers['x-api-key'], 'gw_master')
    assert.equal(headers['anthropic-version'], '2023-06-01')
    assert.equal(JSON.parse(String(calls[0].init.body)).model, 'anthropic/claude-opus-5-5')
    assert.deepEqual({ ...usage[0], latency_ms: 0 }, { client_id: trialClient, requested_alias: 'claude-opus-5-5', status_code: 200, input_tokens: 20, output_tokens: 8, latency_ms: 0 })
  })
})

test('modelo do Roteador fora do Pro não entra no teste grátis', async () => {
  await withAccess({}, async (base) => {
    const response = await post(base, '/v1/chat/completions', 'sk-sx-cliente', { model: 'gpt-6.1-sol', messages: [] })
    assert.equal(response.status, 403)
  })
})

test('recusa da key mestra vira erro genérico para o cliente e fica registrada', async () => {
  await withAccess({ supplier: () => Response.json({ error: { message: 'Saldo insuficiente na conta delver' } }, { status: 402 }) }, async (base, usage) => {
    const response = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'argon-4', messages: [] })
    assert.equal(response.status, 503)
    assert.ok(!(await response.text()).toLowerCase().includes('delver'))
    assert.equal(usage[0].status_code, 402)
  })
})

test('modelos do 66cloud continuam no 66cloud e a lista mostra os do Roteador', async () => {
  await withAccess({}, async (base, usage, calls) => {
    const fable = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-fable-5-1' })
    assert.equal(fable.status, 200)
    assert.equal(calls[0].url, 'https://66cloud.vercel.app/v1/messages')
    assert.equal((calls[0].init.headers as Record<string, string>)['x-api-key'], 'sk-flg-bridge')
    assert.equal(usage.length, 0)
    const list = await (await client(base + '/v1/models', { headers: { 'x-api-key': 'sk-sx-cliente' } })).json() as { data: { id: string; display_name?: string }[] }
    const ids = list.data.map(item => item.id)
    assert.ok(ids.includes('claude-fable-5-1') && ids.includes('claude-opus-5-5') && !ids.includes('gpt-6.1-sol'))
    assert.equal(ids.filter(id => id === 'argon-4').length, 1)
    assert.equal(list.data.find(item => item.id === 'claude-opus-5-5')?.display_name, 'Claude Opus 5.5')
  })
})

test('chave manual sk-rt- usa só os modelos dela e nunca vai ao 66cloud', async () => {
  const manual = { models: ['gpt-6.1-sol'], expires_at: new Date(Date.now() + 30 * day).toISOString(), revoked_at: null }
  await withAccess({ manual, supplier: () => Response.json({ model: 'openai/gpt-6.1-sol', choices: [{ message: { content: 'oi' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }) }, async (base, usage, calls) => {
    const ok = await post(base, '/v1/chat/completions', 'sk-rt-manual', { model: 'gpt-6.1-sol', messages: [{ role: 'user', content: 'oi' }] })
    assert.equal(ok.status, 200)
    assert.equal((await ok.json() as { model: string }).model, 'gpt-6.1-sol')
    assert.deepEqual({ ...usage[0], latency_ms: 0 }, { client_id: manualClient, requested_alias: 'gpt-6.1-sol', status_code: 200, input_tokens: 5, output_tokens: 2, latency_ms: 0 })
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-opus-5-5' })).status, 403)
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-fable-5-1' })).status, 403)
    const list = await (await client(base + '/v1/models', { headers: { Authorization: 'Bearer sk-rt-manual' } })).json() as { data: { id: string }[] }
    assert.deepEqual(list.data.map(item => item.id), ['gpt-6.1-sol'])
    assert.ok(calls.every(call => !call.url.includes('66cloud')))
  })
})

test('chave manual vencida ou bloqueada é cortada na hora', async () => {
  for (const [manual, message] of [
    [{ models: null, expires_at: new Date(Date.now() - 1000).toISOString(), revoked_at: null }, 'venceu'],
    [{ models: null, expires_at: new Date(Date.now() + day).toISOString(), revoked_at: new Date().toISOString() }, 'bloqueada'],
  ] as [Manual, string][]) {
    await withAccess({ manual }, async (base, usage) => {
      const response = await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-opus-5-5' })
      assert.equal(response.status, 403)
      assert.ok((await response.text()).includes(message))
      assert.equal(usage.length, 0)
    })
  }
  await withAccess({}, async (base) => assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-opus-5-5' })).status, 401))
})

test('admin: a key do provedor e a chave manual só são gravadas criptografadas', async () => {
  const sent: { url: string; body: Record<string, any> }[] = []
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, (async (url: string, init: RequestInit = {}) => {
    const body = init.body ? JSON.parse(String(init.body)) : {}
    sent.push({ url: String(url), body })
    if (String(url).includes('rpc/router_create_key')) return Response.json({ id: 'k1', expires_at: new Date(Date.now() + 30 * day).toISOString() })
    return new Response(null, { status: 201 })
  }) as typeof fetch, 'admin@example.com')

  const { id } = await admin.saveProvider({ name: 'Delver', base_url: 'https://fornecedor.example/v1/', key: 'gw_master_secret' })
  const provider = sent[0].body
  assert.equal(provider.id, id)
  assert.equal(provider.base_url, 'https://fornecedor.example/v1')
  assert.equal(provider.key_hint, '…cret')
  assert.ok(!JSON.stringify(provider).includes('gw_master_secret'))
  assert.equal(unsealSecret(provider.encrypted_key, SECRET, `router:provider:${id}`), 'gw_master_secret')

  const created = await admin.createKey({ name: 'João', contact: '81999999999', days: 30, models: ['claude-opus-5-5'] })
  assert.match(created.key, /^sk-rt-[A-Za-z0-9_-]{43}$/)
  const args = sent[1].body
  assert.equal(args.p_hash, sha(created.key))
  assert.equal(args.p_days, 30)
  assert.deepEqual(args.p_models, ['claude-opus-5-5'])
  assert.ok(!JSON.stringify(args).includes(created.key))
  assert.equal(unsealSecret(args.p_encrypted_token, SECRET, `router:key:${args.p_hash}`), created.key)
  assert.notEqual(args.p_bridge_hash, args.p_hash)

  await assert.rejects(admin.saveProvider({ name: 'X', base_url: 'http://inseguro.example', key: 'k' }), { status: 400 })
  await assert.rejects(admin.createKey({ name: 'João', days: 0 }), { status: 400 })
  await assert.rejects(admin.saveModels({ provider_id: PROVIDER.id, models: [{ alias: 'Nome Inválido', upstream_model: 'x' }] }), { status: 400 })
})

test('diagnóstico do Roteador conta modelos ativos e aponta o problema, sem devolver keys', async () => {
  const env = { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET }
  const rows = models().map((m) => ({ alias: m.alias, enabled: true, provider: m.provider }))
  const ok = await routerStatus(env, (async () => Response.json(rows)) as typeof fetch)
  assert.equal(ok.ok, true)
  assert.equal(ok.activeModels, 3)
  assert.ok(!JSON.stringify(ok).includes('gw_master') && !JSON.stringify(ok).includes('encrypted'))
  const empty = await routerStatus(env, (async () => Response.json([])) as typeof fetch)
  assert.equal(empty.ok, false)
  assert.match(String(empty.problem), /Salvar modelos/)
  const badKey = await routerStatus(env, (async () => Response.json(rows.map((r) => ({ ...r, provider: { ...r.provider, encrypted_key: 'x'.repeat(40) } })))) as typeof fetch)
  assert.equal(badKey.activeModels, 0)
  assert.match(String(badKey.problem), /key de um provedor não abre/)
  const off = await routerStatus(env, (async () => Response.json(rows.map((r) => ({ ...r, provider: { ...r.provider, enabled: false } })))) as typeof fetch)
  assert.match(String(off.problem), /desligado/)
  const missing = await routerStatus(env, (async () => new Response('{"message":"relation does not exist"}', { status: 404 })) as typeof fetch)
  assert.match(String(missing.problem), /router.sql/)
  assert.match(String((await routerStatus({}, fetch)).problem), /SUPABASE_URL/)
})
