import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRanking, createDiscordRank, discordPayload, publicName, validWebhook, type Owner, type UsageCall } from './discord-rank.ts'
import { createDiscordCron } from '../api/discord-rank.ts'

const T0 = Date.parse('2026-11-10T12:00:00Z')
const at = (min: number) => new Date(T0 + min * 60_000).toISOString()
const call = (client: string, min: number, model = 'claude-opus-5-5', tokens = 100, status = 200): UsageCall =>
  ({ client_id: client, requested_alias: model, status_code: status, input_tokens: tokens, output_tokens: tokens, created_at: at(min) })

test('nome público: curto, sem e-mail, telefone ou markdown', () => {
  assert.equal(publicName('alisson medeiros silva', 'x'), 'Alisson S.')
  assert.equal(publicName('Maria', 'x'), 'Maria')
  assert.equal(publicName('joao@gmail.com', 'abc'), publicName('', 'abc'))
  assert.match(publicName('', 'abc'), /^Cliente #[0-9a-f]{4}$/)
  assert.equal(publicName('@everyone 11999998888', 'x'), 'Everyone')
})

test('ranking: soma por dono, conta sessões (pausa > 30 min) e ignora erros', () => {
  const owners = new Map<string, Owner>([
    ['k1', { key: 'user:a', name: 'Ana Souza', email: 'ana@x.com' }],
    ['k2', { key: 'user:a', name: 'Ana Souza', email: 'ana@x.com' }], // segunda chave da mesma pessoa
    ['k3', { key: 'user:b', name: 'Bruno Lima', email: 'bruno@x.com' }],
    ['k4', { key: 'user:adm', name: 'Admin', email: 'admin@x.com' }],
  ])
  const calls = [
    call('k1', 0), call('k1', 10), call('k2', 35), // uma sessão (pausas ≤ 30 min)
    call('k1', 200, 'gpt-6-astra'), // segunda sessão
    call('k3', 0, 'claude-opus-5-5', 5000), // muito token, uma sessão
    call('k3', 5, 'claude-opus-5-5', 9999, 500), // erro: não conta
    call('k4', 0, 'claude-opus-5-5', 99999),
  ]
  const r = buildRanking(calls, owners, { from: '2026-11-04', to: '2026-11-10', days: 7, hidden: (o) => o.email === 'admin@x.com' })
  assert.deepEqual(r.byTokens.map((p) => p.name), ['Bruno L.', 'Ana S.'])
  assert.deepEqual(r.bySessions.map((p) => [p.name, p.sessions]), [['Ana S.', 2], ['Bruno L.', 1]])
  assert.equal(r.byTokens[1].requests, 4)
  assert.deepEqual(r.models.map((m) => [m.model, m.requests, m.people]), [['claude-opus-5-5', 4, 2], ['gpt-6-astra', 1, 1]])
  assert.deepEqual(r.total, { requests: 5, tokens: 10800, people: 2, sessions: 3 })
})

test('mensagem do Discord: sem e-mail, sem menções e dentro dos limites', () => {
  const owners = new Map<string, Owner>(Array.from({ length: 40 }, (_, i) => [`k${i}`, { key: `u${i}`, name: `Pessoa${i} Teste`, email: `p${i}@x.com` }]))
  const calls = Array.from({ length: 40 }, (_, i) => call(`k${i}`, i, `modelo-${i}`))
  const payload = discordPayload(buildRanking(calls, owners, { from: '2026-11-04', to: '2026-11-10', days: 7 }), 'https://www.sixtysix.online')
  const text = JSON.stringify(payload)
  assert.ok(!text.includes('@x.com'))
  assert.deepEqual(payload.allowed_mentions, { parse: [] })
  for (const f of payload.embeds[0].fields) assert.ok(f.value.length <= 1024 && f.value.split('\n').length === 10)
})

test('webhook: só endereço oficial do Discord', () => {
  assert.equal(validWebhook('https://discord.com/api/webhooks/123/abc-DEF_1'), 'https://discord.com/api/webhooks/123/abc-DEF_1')
  assert.equal(validWebhook('https://evil.com/api/webhooks/123/abc'), null)
  assert.equal(validWebhook('http://discord.com/api/webhooks/123/abc'), null)
  assert.equal(validWebhook('https://discord.com/api/users/123'), null)
  assert.equal(validWebhook(undefined), null)
})

test('publicar: lê o banco, junta chaves às contas e manda para o webhook', async () => {
  const sent: any[] = []
  const fake = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    if (url.includes('/rest/v1/gateway_usage')) return json([call('c1', 0), call('c1', 5), call('c2', 0, 'glm-5', 50), call('c3', 0, 'glm-5', 1)])
    if (url.includes('/rest/v1/gateway_clients')) return json([{ id: 'c1', user_id: null, name: 'Assinatura' }, { id: 'c2', user_id: null, name: 'Roteador · Zé' }, { id: 'c3', user_id: 'adm', name: 'x' }])
    if (url.includes('/rest/v1/billing_key_access')) return json([{ gateway_client_id: 'c1', user_id: 'u1' }])
    if (url.includes('/rest/v1/gateway_trials')) return json([])
    if (url.includes('/rest/v1/router_keys')) return json([{ gateway_client_id: 'c2', name: 'Zé Carlos' }])
    if (url.includes('/auth/v1/admin/users')) return json({ users: [{ id: 'u1', email: 'carla@x.com', user_metadata: { full_name: 'Carla Dias' } }, { id: 'adm', email: 'chefe@x.com', user_metadata: { name: 'Chefe' } }] })
    if (url.startsWith('https://discord.com/api/webhooks/')) { sent.push(JSON.parse(String(init?.body))); return json({ id: '999' }) }
    return new Response('?', { status: 404 })
  }) as typeof fetch
  const env = { SUPABASE_URL: 'https://db.example.co', SUPABASE_SERVICE_ROLE_KEY: 'service', SIXTYSIX_ADMIN_EMAILS: 'chefe@x.com', DISCORD_RANK_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/tok' }
  const result = await createDiscordRank(env, fake).publish(7)
  assert.equal(result.messageId, '999')
  assert.deepEqual(result.ranking.byTokens.map((p) => p.name), ['Carla D.', 'Zé C.'])
  const text = JSON.stringify(sent[0])
  assert.ok(text.includes('Carla D.') && !text.includes('carla@x.com') && !text.includes('Chefe'))
})

test('publicar sem webhook configurado avisa o que falta', async () => {
  await assert.rejects(createDiscordRank({ SUPABASE_URL: 'https://db.example.co', SUPABASE_SERVICE_ROLE_KEY: 's' }).publish(), /DISCORD_RANK_WEBHOOK_URL/)
})

test('cron do ranking exige CRON_SECRET', async () => {
  const cron = createDiscordCron({ CRON_SECRET: 'segredo' } as NodeJS.ProcessEnv, (async () => new Response('{}')) as typeof fetch)
  assert.equal((await cron(undefined)).status, 401)
  assert.equal((await cron('Bearer errado')).status, 401)
  assert.equal((await createDiscordCron({} as NodeJS.ProcessEnv)('Bearer x')).status, 503)
})
