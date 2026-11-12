import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import accessHandler, { seal } from '../api/access.ts'
import { canonicalModels, clearRouterCache, createRouterAdmin, findRoute, loadRouter, normalizeAlias, routerStatus, sealSecret, unsealSecret } from './router.ts'
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
type Manual = { models: string[] | null; expires_at: string; revoked_at: string | null; created_at?: string }
/** Sobe o /api/access de verdade com Supabase e provedor simulados. */
type Gate = { ok: boolean; reason?: string; retry_after?: number; leased?: boolean }
const guardCalls: { name: string; body: any }[] = []
async function withAccess(options: { supplier?: (url: string, init: RequestInit) => Response; manual?: Manual; gate?: Gate }, run: (base: string, usage: Record<string, unknown>[], calls: Call[]) => Promise<void>) {
  const nativeFetch = globalThis.fetch
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  Object.assign(process.env, { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET })
  const usage: Record<string, unknown>[] = [], calls: Call[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    if (url.startsWith(`${SUPABASE}/rest/v1/gateway_usage`)) { usage.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }) }
    if (url.startsWith(`${SUPABASE}/rest/v1/router_models`)) return Response.json(models())
    // Proteção contra sobrecarga (server/guard.ts): passa por padrão e ocupa uma vaga.
    if (url.startsWith(`${SUPABASE}/rest/v1/rpc/gateway_`)) {
      guardCalls.push({ name: url.split('/rpc/')[1], body: JSON.parse(String(init.body)) })
      return url.endsWith('gateway_gate') ? Response.json(options.gate || { ok: true, leased: true }) : new Response(null, { status: 204 })
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/gateway_trials`)) {
      return Response.json([{ user_id: uid, gateway_client_id: trialClient, expires_at: new Date(Date.now() + day).toISOString(), revoked_at: null, encrypted_upstream: seal('sk-flg-bridge', SECRET, `${uid}:upstream`) }])
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/router_keys`)) {
      assert.ok(url.includes(sha('sk-rt-manual')))
      return Response.json(options.manual ? [{ gateway_client_id: manualClient, ...options.manual }] : [])
    }
    calls.push({ url, init })
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

test('modelos internos do Claude Code (avaliador do modo Automático, haiku de fundo) vão para um Claude da chave', async () => {
  const manual = { models: null, expires_at: new Date(Date.now() + 30 * day).toISOString(), revoked_at: null }
  await withAccess({ manual, supplier: () => Response.json({ model: 'anthropic/claude-opus-5-5', content: [], usage: { input_tokens: 3, output_tokens: 1 } }) }, async (base, usage, calls) => {
    for (const model of ['claude-opus-5', 'claude-haiku-4-5']) {
      const response = await post(base, '/v1/messages', 'sk-rt-manual', { model, max_tokens: 1, messages: [{ role: 'user', content: '.' }] })
      assert.equal(response.status, 200, model)
      assert.equal(JSON.parse(String(calls.at(-1)!.init.body)).model, 'anthropic/claude-opus-5-5', model)
    }
    assert.equal(usage.at(-1)!.requested_alias, 'claude-opus-5-5', 'o consumo mostra o modelo que respondeu de verdade')
    // Nome que não é Claude continua sem modelo.
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'llama-9', messages: [] })).status, 404)
  })
  // Chave sem nenhum modelo Claude: continua 404, não ganha um Claude de brinde.
  const onlyGpt = { models: ['gpt-6.1-sol'], expires_at: new Date(Date.now() + 30 * day).toISOString(), revoked_at: null }
  await withAccess({ manual: onlyGpt }, async (base) => {
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-opus-5', messages: [] })).status, 404)
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

test('modelo fora do Roteador é recusado e a lista mostra só o Roteador', async () => {
  await withAccess({}, async (base, usage, calls) => {
    const fable = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-fable-5-1' })
    assert.equal(fable.status, 404)
    assert.match(await fable.text(), /não está disponível/)
    assert.equal(calls.length, 0, 'não chama nenhum gateway externo')
    assert.equal(usage.length, 0)
    const list = await (await client(base + '/v1/models', { headers: { 'x-api-key': 'sk-sx-cliente' } })).json() as { data: { id: string; display_name?: string }[] }
    const ids = list.data.map(item => item.id)
    assert.ok(ids.includes('claude-opus-5-5') && ids.includes('argon-4'))
    assert.ok(!ids.includes('claude-fable-5-1') && !ids.includes('gpt-6.1-sol'))
    assert.equal(ids.filter(id => id === 'argon-4').length, 1)
    assert.equal(list.data.find(item => item.id === 'claude-opus-5-5')?.display_name, 'Claude Opus 5.5')
  })
})

test('endereços antigos /glm/v1 e /api/codex chegam ao provedor como /v1', async () => {
  await withAccess({ supplier: () => Response.json({ model: 'anthropic/claude-opus-5-5', content: [], usage: { input_tokens: 1, output_tokens: 1 } }) }, async (base, usage, calls) => {
    assert.equal((await post(base, '/glm/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] })).status, 200)
    assert.equal(calls[0].url, 'https://fornecedor.example/v1/messages')
    // Contagem de tokens é respondida aqui: não chega ao fornecedor nem vira consumo.
    const before = usage.length, supplierCalls = calls.length
    assert.equal((await post(base, '/v1/messages/count_tokens', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] })).status, 404)
    assert.equal(usage.length, before)
    assert.equal(calls.length, supplierCalls, 'o fornecedor não recebe a contagem de tokens')
    const catalog = await (await client(base + '/api/codex/models', { headers: { 'x-api-key': 'sk-sx-cliente' } })).json() as { data: { id: string }[] }
    assert.ok(catalog.data.some(item => item.id === 'claude-opus-5-5'))
    // URL configurada já com /v1 (app Claude desktop): /v1/v1/... vira /v1/...
    assert.equal((await post(base, '/v1/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] })).status, 200)
    assert.equal(calls.at(-1)!.url, 'https://fornecedor.example/v1/messages')
    const doubled = await (await client(base + '/v1/v1/models', { headers: { 'x-api-key': 'sk-sx-cliente' } })).json() as { data: { id: string }[] }
    assert.ok(doubled.data.some(item => item.id === 'claude-opus-5-5'))
  })
})

test('chave manual sk-rt- usa só os modelos dela', async () => {
  const manual = { models: ['gpt-6.1-sol'], expires_at: new Date(Date.now() + 30 * day).toISOString(), revoked_at: null }
  await withAccess({ manual, supplier: () => Response.json({ model: 'openai/gpt-6.1-sol', choices: [{ message: { content: 'oi' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }) }, async (base, usage, calls) => {
    const ok = await post(base, '/v1/chat/completions', 'sk-rt-manual', { model: 'gpt-6.1-sol', messages: [{ role: 'user', content: 'oi' }] })
    assert.equal(ok.status, 200)
    assert.equal((await ok.json() as { model: string }).model, 'gpt-6.1-sol')
    assert.deepEqual({ ...usage[0], latency_ms: 0 }, { client_id: manualClient, requested_alias: 'gpt-6.1-sol', status_code: 200, input_tokens: 5, output_tokens: 2, latency_ms: 0 })
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-opus-5-5' })).status, 403)
    assert.equal((await post(base, '/v1/messages', 'sk-rt-manual', { model: 'claude-fable-5-1' })).status, 404)
    const list = await (await client(base + '/v1/models', { headers: { Authorization: 'Bearer sk-rt-manual' } })).json() as { data: { id: string }[] }
    assert.deepEqual(list.data.map(item => item.id), ['gpt-6.1-sol'])
    assert.ok(calls.every(call => call.url.startsWith('https://fornecedor.example/')))
  })
})

test('chave manual vencida ou bloqueada é cortada na hora', async () => {
  for (const [manual, message] of [
    [{ models: null, expires_at: new Date(Date.now() - 1000).toISOString(), revoked_at: null, created_at: new Date(Date.now() - 31 * day).toISOString() }, 'venceu'],
    [{ models: null, expires_at: new Date(Date.now() - 1000).toISOString(), revoked_at: null, created_at: new Date(Date.now() - 3 * 3600000 - 1000).toISOString() }, 'teste grátis acabou'],
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

test('passou do ritmo: 429 com tempo de espera, sem chamar o fornecedor nem gravar consumo', async () => {
  guardCalls.length = 0
  await withAccess({ gate: { ok: false, reason: 'rate', retry_after: 12 } }, async (base, usage, calls) => {
    const response = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] }, { 'x-forwarded-for': '177.10.20.30' })
    assert.equal(response.status, 429)
    assert.equal(response.headers.get('retry-after'), '12')
    const body = await response.json() as { error: { type: string; message: string } }
    assert.equal(body.error.type, 'rate_limit_error')
    assert.match(body.error.message, /Aguarde/)
    assert.equal(calls.length, 0)
    assert.equal(usage.length, 0)
    assert.equal(guardCalls[0].body.p_client, trialClient)
    assert.ok(!guardCalls.some((c) => c.name === 'gateway_release'), 'nada para liberar')
  })
})

test('IP bloqueado é recusado antes do fornecedor', async () => {
  await withAccess({ gate: { ok: false, reason: 'ip_blocked' } }, async (base, _usage, calls) => {
    const response = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] })
    assert.equal(response.status, 403)
    assert.match(await response.text(), /bloqueado/)
    assert.equal(calls.length, 0)
  })
})

test('a vaga de resposta simultânea é liberada quando a resposta termina', async () => {
  guardCalls.length = 0
  await withAccess({ supplier: sse }, async (base) => {
    const response = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', stream: true, messages: [] })
    assert.equal(response.status, 200)
    await response.text()
    const gate = guardCalls.find((c) => c.name === 'gateway_gate')!
    const release = guardCalls.find((c) => c.name === 'gateway_release')
    assert.ok(release, 'liberou a vaga')
    assert.equal(release!.body.p_request, gate.body.p_request)
  })
})

test('ponto e hífen valem o mesmo no nome do modelo', async () => {
  const env = { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET }
  const router = await loadRouter(env, (async () => Response.json(models())) as typeof fetch)
  assert.equal(normalizeAlias('Claude-Fable-5.1'), 'claude-fable-5-1')
  assert.equal(findRoute(router, 'gpt-6-1-sol')?.alias, 'gpt-6.1-sol')
  assert.equal(findRoute(router, 'gpt-6.1-sol')?.alias, 'gpt-6.1-sol')
  assert.equal(findRoute(router, 'nao-existe'), undefined)
  assert.deepEqual(canonicalModels(router, ['gpt-6-1-sol', 'gpt-6.1-sol', 'argon-4', 'glm-5']), ['gpt-6.1-sol', 'argon-4'])
})

test('chave pede o nome com hífen e o Roteador tem com ponto: funciona', async () => {
  const manual = { models: ['gpt-6-1-sol'], expires_at: new Date(Date.now() + 30 * day).toISOString(), revoked_at: null }
  await withAccess({ manual, supplier: () => Response.json({ model: 'openai/gpt-6.1-sol', choices: [{ message: { content: 'oi' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }) }, async (base, usage, calls) => {
    const ok = await post(base, '/v1/chat/completions', 'sk-rt-manual', { model: 'gpt-6-1-sol', messages: [{ role: 'user', content: 'oi' }] })
    assert.equal(ok.status, 200)
    assert.equal(JSON.parse(String(calls[0].init.body)).model, 'openai/gpt-6.1-sol')
    assert.equal(usage[0].requested_alias, 'gpt-6.1-sol')
    const list = await (await client(base + '/v1/models', { headers: { Authorization: 'Bearer sk-rt-manual' } })).json() as { data: { id: string }[] }
    assert.deepEqual(list.data.map((item) => item.id), ['gpt-6.1-sol'])
  })
})

test('admin: editar chave grava nome, modelos e validade até o fim do dia em Brasília', async () => {
  const calls: { method: string; url: string; body: any }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    calls.push({ method: init.method || 'GET', url: String(input), body: init.body ? JSON.parse(String(init.body)) : undefined })
    const wantsRows = String((init.headers as Record<string, string> | undefined)?.Prefer || '').includes('return=representation')
    if (String(input).includes('/router_keys') && wantsRows) return Response.json([{ id: '11111111-1111-4111-8111-111111111111', gateway_client_id: '22222222-2222-4222-8222-222222222222' }])
    return new Response(null, { status: 204 })
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  await admin.updateKey({ id: '11111111-1111-4111-8111-111111111111', name: ' João ', contact: '', expires_at: '2026-12-20', models: ['argon-4'] })
  const patch = calls.find((c) => c.url.includes('/router_keys'))!
  assert.equal(patch.method, 'PATCH')
  assert.deepEqual(patch.body, { name: 'João', contact: null, models: ['argon-4'], expires_at: '2026-12-21T02:59:59.000Z' })
  assert.ok(calls.some((c) => c.url.includes('/gateway_clients') && c.body.name === 'Roteador · João'))
  await assert.rejects(admin.updateKey({ id: '11111111-1111-4111-8111-111111111111', name: '', expires_at: '2026-12-20' }), /nome/)
  await assert.rejects(admin.updateKey({ id: '11111111-1111-4111-8111-111111111111', name: 'x', expires_at: 'amanhã' }), /validade/)
  await assert.rejects(admin.updateKey({ id: '11111111-1111-4111-8111-111111111111', name: 'x', expires_at: '2026-12-20', models: [] }), /modelo/)
})

test('admin: aceitar e remover IP da chave', async () => {
  const calls: { method: string; url: string; body: any }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    calls.push({ method: init.method || 'GET', url: String(input), body: init.body ? JSON.parse(String(init.body)) : undefined })
    const wantsRows = String((init.headers as Record<string, string> | undefined)?.Prefer || '').includes('return=representation')
    return init.method === 'PATCH' && wantsRows ? Response.json([{ ip: '177.10.20.30' }]) : new Response(null, { status: 204 })
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  const client = '22222222-2222-4222-8222-222222222222'
  await admin.acceptKeyIp({ client_id: client, ip: '177.10.20.30' })
  assert.equal(calls[0].method, 'PATCH')
  assert.equal(calls[0].body.accepted, true)
  assert.equal(calls[0].body.blocked_at, null)
  assert.ok(calls[0].url.includes('ip=eq.177.10.20.30'))
  await admin.removeKeyIp({ client_id: client, ip: '177.10.20.30' })
  assert.equal(calls[1].method, 'DELETE')
  await assert.rejects(admin.acceptKeyIp({ client_id: client, ip: '10.0.0.0/8' }), /IP inválido/)
})

test('IP além do limite da chave recebe aviso de liberação pelo WhatsApp', async () => {
  await withAccess({ gate: { ok: false, reason: 'ip_pending' } }, async (base, _usage, calls) => {
    const response = await post(base, '/v1/messages', 'sk-sx-cliente', { model: 'claude-opus-5-5', messages: [] })
    assert.equal(response.status, 403)
    assert.match(await response.text(), /ainda não foi liberado/)
    assert.equal(calls.length, 0)
  })
})

test('admin: ritmo do teste grátis vale também para os testes rodando agora', async () => {
  const calls: { method: string; url: string; body: any }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    calls.push({ method: init.method || 'GET', url: String(input), body: init.body ? JSON.parse(String(init.body)) : undefined })
    if (String(input).includes('/gateway_trials')) return Response.json([{ gateway_client_id: '66666666-6666-4666-8666-666666666666' }])
    return new Response(null, { status: 201 })
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  await admin.saveGuardSettings({ rpm: 60, concurrency: 4, trial_rpm: 6, trial_concurrency: 1 })
  const settings = calls.find((c) => c.url.includes('/gateway_settings'))!
  assert.equal(settings.body.trial_rpm, 6)
  assert.equal(settings.body.trial_concurrency, 1)
  const controls = calls.find((c) => c.url.includes('/gateway_controls'))!
  assert.deepEqual(controls.body.map((c: any) => [c.client_id, c.rpm, c.concurrency]), [['66666666-6666-4666-8666-666666666666', 6, 1]])
  await assert.rejects(admin.saveGuardSettings({ rpm: 60, concurrency: 4, trial_rpm: 0, trial_concurrency: 1 }), /Teste grátis/)
})

test('admin: chave de teste em horas vale até a hora certa e usa o ritmo do teste', async () => {
  const calls: { method: string; url: string; body: any }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ method: init.method || 'GET', url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    if (url.includes('/rpc/router_create_key')) return Response.json({ id: '44444444-4444-4444-8444-444444444444', gateway_client_id: '55555555-5555-4555-8555-555555555555', expires_at: new Date(Date.now() + 86400000).toISOString() })
    if (url.includes('/router_keys') && init.method === 'PATCH') return Response.json([{ id: '44444444-4444-4444-8444-444444444444', gateway_client_id: '55555555-5555-4555-8555-555555555555', expires_at: JSON.parse(String(init.body)).expires_at }])
    if (url.includes('/gateway_settings')) return Response.json([{ trial_rpm: 6, trial_concurrency: 1 }])
    return new Response(null, { status: 201 })
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  const before = Date.now()
  const result = await admin.createKey({ name: 'Teste João', hours: 3, slow: true, models: null })
  const left = Date.parse(String(result.row.expires_at)) - before
  assert.ok(left > 2.9 * 3600000 && left < 3.1 * 3600000, 'vale 3 horas')
  const controls = calls.find((c) => c.url.includes('/gateway_controls'))!
  assert.deepEqual([controls.body.client_id, controls.body.rpm, controls.body.concurrency], ['55555555-5555-4555-8555-555555555555', 6, 1])
  await assert.rejects(admin.createKey({ name: 'x', hours: 0 }), /horas/)
  await assert.rejects(admin.createKey({ name: 'x', hours: 721 }), /horas/)
})

test('admin: apagar chave chama router_delete_key e avisa quando não existe ou falta a migração', async () => {
  const calls: { url: string; body: any }[] = []
  let answer: Response = Response.json(true)
  const request = (async (input: string, init: RequestInit = {}) => {
    calls.push({ url: String(input), body: init.body ? JSON.parse(String(init.body)) : undefined })
    return answer.clone()
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  const id = '66666666-6666-4666-8666-666666666666'
  assert.deepEqual(await admin.deleteKey({ id }), { ok: true })
  assert.ok(calls[0].url.endsWith('/rest/v1/rpc/router_delete_key'))
  assert.deepEqual(calls[0].body, { p_id: id })
  answer = Response.json(false)
  await assert.rejects(admin.deleteKey({ id }), /não encontrada/)
  answer = Response.json({ message: 'Could not find the function public.router_delete_key(p_id)' }, { status: 404 })
  await assert.rejects(admin.deleteKey({ id }), /router-delete-key.sql/)
  await assert.rejects(admin.deleteKey({ id: 'x' }), /inválida/)
})

test('admin: ligar chave à conta do cliente grava user_id no cliente do gateway, e vazio desliga', async () => {
  const calls: { method: string; url: string; body: any; prefer: string }[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = decodeURIComponent(String(input))
    calls.push({ method: init.method || 'GET', url, body: init.body ? JSON.parse(String(init.body)) : undefined, prefer: String((init.headers as Record<string, string>)?.Prefer || '') })
    if (url.includes('/router_keys?')) return Response.json([{ gateway_client_id: '77777777-7777-4777-8777-777777777777' }])
    if (url.includes('/gateway_clients?') && init.method === 'PATCH') return Response.json([{ id: '77777777-7777-4777-8777-777777777777' }])
    return Response.json([])
  }) as typeof fetch
  const admin = createRouterAdmin({ url: SUPABASE, secret: SECRET }, request, 'admin@x.com')
  const id = '88888888-8888-4888-8888-888888888888', user = '99999999-9999-4999-8999-999999999999'
  assert.deepEqual(await admin.linkKey({ id, user_id: user }), { ok: true, user_id: user })
  const patch = calls.find((c) => c.method === 'PATCH')!
  assert.ok(patch.url.includes('/gateway_clients?id=eq.77777777-7777-4777-8777-777777777777'))
  assert.deepEqual(patch.body, { user_id: user })
  assert.equal(patch.prefer, 'return=representation')
  assert.deepEqual(await admin.linkKey({ id, user_id: '' }), { ok: true, user_id: null })
  assert.deepEqual(calls.filter((c) => c.method === 'PATCH')[1].body, { user_id: null })
  await assert.rejects(admin.linkKey({ id: 'x', user_id: user }), /inválida/)
})
