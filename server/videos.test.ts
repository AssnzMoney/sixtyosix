import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import accessHandler from '../api/access.ts'
import { clearRouterCache, sealSecret } from './router.ts'
import { monthStart, openVideoId, rewriteVideo, signVideoId, videoRequestProblem, videoWeight } from './videos.ts'

const SUPABASE = 'https://example.supabase.co'
const SECRET = 'sb_secret_private'
const PROVIDER = { id: '33333333-3333-4333-8333-333333333333', name: 'Delver', base_url: 'https://fornecedor.example/v1', enabled: true, encrypted_key: sealSecret('gw_master', SECRET, 'router:provider:33333333-3333-4333-8333-333333333333') }
const PRO = '44444444-4444-4444-8444-444444444444'
const OTHER = '55555555-5555-4555-8555-555555555555'
const day = 86400000
const sha = (v: string) => createHash('sha256').update(v).digest('hex')
const client = globalThis.fetch

test('id do vídeo: só abre com a conta dona e não aceita id mexido', () => {
  const id = signVideoId('veo-3.1-fast', 'video_abc', PRO, SECRET)
  assert.match(id, /^video_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
  assert.deepEqual(openVideoId(id, PRO, SECRET), { alias: 'veo-3.1-fast', supplierId: 'video_abc' })
  assert.equal(openVideoId(id, OTHER, SECRET), null, 'outra conta não abre')
  assert.equal(openVideoId(id.slice(0, -1) + (id.endsWith('A') ? 'B' : 'A'), PRO, SECRET), null, 'assinatura mexida')
  assert.equal(openVideoId('video_abc', PRO, SECRET), null, 'id do fornecedor direto não vale')
})

test('regras do vídeo: peso por modelo, até 8 s, um por vez, começo do mês em Brasília e resposta com o nosso id', () => {
  assert.equal(videoWeight({ upstream: 'google/veo-3.1-fast' }), 1)
  assert.equal(videoWeight({ upstream: 'google/veo-3.1' }), 2)
  assert.equal(videoRequestProblem({ prompt: 'um robô', seconds: '8' }), null)
  assert.match(videoRequestProblem({ prompt: 'um robô', seconds: '12' })!, /até 8 segundos/)
  assert.match(videoRequestProblem({ prompt: '' })!, /prompt/)
  assert.match(videoRequestProblem({ prompt: 'x', n: 2 })!, /um vídeo por vez/)
  assert.equal(monthStart(new Date('2026-12-01T02:00:00Z')), '2026-11-01T03:00:00.000Z', '23h do dia 30/11 em Brasília ainda é novembro')
  assert.equal(monthStart(new Date('2026-12-01T04:00:00Z')), '2026-12-01T03:00:00.000Z')
  const out = rewriteVideo({ id: 'video_abc', status: 'completed', model: 'google/veo-3.1-fast', url: '/v1/videos/video_abc/content' }, 'veo-3.1-fast', PRO, SECRET) as Record<string, string>
  assert.equal(out.model, 'veo-3.1-fast')
  assert.equal(out.url, `/v1/videos/${out.id}/content`)
  assert.ok(!JSON.stringify(out).includes('google/'), 'não mostra o fornecedor')
})

type Call = { url: string; init: RequestInit }
async function withVideo(options: { used?: number; usedFull?: number; supplier?: (url: string, init: RequestInit) => Response }, run: (base: string, usage: Record<string, unknown>[], calls: Call[]) => Promise<void>) {
  clearRouterCache()
  const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, wait: process.env.SIXTYSIX_429_WAIT_MS }
  Object.assign(process.env, { SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: SECRET, SIXTYSIX_429_WAIT_MS: '0' })
  const usage: Record<string, unknown>[] = [], calls: Call[] = []
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    if (url.startsWith(`${SUPABASE}/rest/v1/gateway_usage`)) {
      if (init.method === 'POST') { usage.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }) }
      return Response.json([...Array(options.used ?? 0).fill({ requested_alias: 'veo-3.1-fast' }), ...Array(options.usedFull ?? 0).fill({ requested_alias: 'veo-3.1' })])
    }
    if (url.startsWith(`${SUPABASE}/rest/v1/router_models`)) return Response.json([
      { alias: 'argon-4', label: 'Argon 4', upstream_model: 'google/gemini-4-argon', in_pro: true, provider: PROVIDER },
      { alias: 'veo-3.1-fast', label: 'Veo 3.1 Fast', upstream_model: 'google/veo-3.1-fast', in_pro: true, provider: PROVIDER },
      { alias: 'veo-3.1', label: 'Veo 3.1', upstream_model: 'google/veo-3.1', in_pro: true, provider: PROVIDER },
    ])
    if (url.startsWith(`${SUPABASE}/rest/v1/rpc/gateway_`)) return url.endsWith('gateway_gate') ? Response.json({ ok: true, leased: true }) : new Response(null, { status: 204 })
    if (url.startsWith(`${SUPABASE}/rest/v1/router_keys`)) {
      if (url.includes(sha('sk-rt-pro'))) return Response.json([{ gateway_client_id: PRO, models: null, expires_at: new Date(Date.now() + 20 * day).toISOString(), revoked_at: null, created_at: new Date(Date.now() - 10 * day).toISOString() }])
      if (url.includes(sha('sk-rt-teste'))) return Response.json([{ gateway_client_id: OTHER, models: null, expires_at: new Date(Date.now() + 2 * 3600000).toISOString(), revoked_at: null, created_at: new Date(Date.now() - 3600000).toISOString() }])
      return Response.json([])
    }
    calls.push({ url, init })
    if (!options.supplier) throw new Error('não deveria chamar o fornecedor')
    return options.supplier(url, init)
  }) as typeof fetch
  const server = createServer(accessHandler)
  try {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/access?action=proxy&path=`, usage, calls)
  } finally {
    globalThis.fetch = client
    for (const [k, v] of [['SUPABASE_URL', saved.url], ['SUPABASE_SERVICE_ROLE_KEY', saved.key], ['SIXTYSIX_429_WAIT_MS', saved.wait]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) })
  }
}
const post = (base: string, path: string, key: string, body: unknown) => client(base + path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
const get = (base: string, path: string, key: string) => client(base + path, { headers: { authorization: `Bearer ${key}` } })

test('vídeo no Pro: cria (conta no limite), consulta e baixa com o id assinado; outra conta não vê', async () => {
  const mp4 = Buffer.from('00000020667479706d703432fake-mp4', 'utf8')
  const supplier = (url: string, init: RequestInit) => {
    if (url === 'https://fornecedor.example/v1/videos' && init.method === 'POST') return Response.json({ id: 'video_abc', object: 'video', model: 'google/veo-3.1-fast', status: 'in_progress', progress: 50 })
    if (url === 'https://fornecedor.example/v1/videos/video_abc') return Response.json({ id: 'video_abc', object: 'video', model: 'google/veo-3.1-fast', status: 'completed', progress: 100, url: '/v1/videos/video_abc/content' })
    if (url === 'https://fornecedor.example/v1/videos/video_abc/content') return new Response(mp4, { headers: { 'content-type': 'video/mp4' } })
    return Response.json({ error: { message: 'rota inesperada ' + url } }, { status: 404 })
  }
  await withVideo({ used: 3, supplier }, async (base, usage, calls) => {
    const created = await post(base, '/v1/videos', 'sk-rt-pro', { model: 'veo-3.1-fast', prompt: 'um robô verde acenando', seconds: '4', size: '1280x720' })
    assert.equal(created.status, 200)
    const job = (await created.json()) as Record<string, string>
    assert.equal(job.model, 'veo-3.1-fast')
    assert.notEqual(job.id, 'video_abc', 'o cliente recebe o nosso id')
    assert.equal(JSON.parse(String(calls[0].init.body)).model, 'google/veo-3.1-fast')
    assert.deepEqual(usage.map((u) => [u.requested_alias, u.status_code]), [['veo-3.1-fast', 200]], 'a criação conta no limite')

    const status = (await (await get(base, `/v1/videos/${job.id}`, 'sk-rt-pro')).json()) as Record<string, string>
    assert.equal(status.status, 'completed')
    assert.equal(status.url, `/v1/videos/${job.id}/content`)
    const file = await get(base, `/v1/videos/${job.id}/content`, 'sk-rt-pro')
    assert.equal(file.status, 200)
    assert.equal(file.headers.get('content-type'), 'video/mp4')
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), mp4)
    assert.equal(usage.length, 1, 'consultar e baixar não contam')

    const foreign = signVideoId('veo-3.1-fast', 'video_abc', OTHER, SECRET)
    assert.equal((await get(base, `/v1/videos/${foreign}`, 'sk-rt-pro')).status, 404, 'id de outra conta')
    assert.equal((await get(base, '/v1/videos/video_abc', 'sk-rt-pro')).status, 404, 'id do fornecedor direto')
  })
})

test('vídeo: limite do mês, teste grátis, até 8 s e modelo certo no endereço certo', async () => {
  const supplier = () => Response.json({ id: 'video_x', status: 'in_progress' })
  await withVideo({ used: 8, usedFull: 1, supplier }, async (base, _usage, calls) => {
    const full = await post(base, '/v1/videos', 'sk-rt-pro', { model: 'veo-3.1-fast', prompt: 'x' })
    assert.equal(full.status, 429, '8 do Fast + 1 do normal (conta 2) = 10 de 10')
    assert.match(((await full.json()) as { error: { message: string } }).error.message, /10 de 10 vídeos deste mês/)
    assert.equal((await post(base, '/v1/videos', 'sk-rt-teste', { model: 'veo-3.1-fast', prompt: 'x' })).status, 403, 'teste grátis não gera vídeo')
    assert.equal((await post(base, '/v1/videos', 'sk-rt-pro', { model: 'argon-4', prompt: 'x' })).status, 400, 'modelo de texto em /v1/videos')
    assert.equal((await post(base, '/v1/chat/completions', 'sk-rt-pro', { model: 'veo-3.1-fast', messages: [] })).status, 400, 'vídeo no chat')
    assert.equal(calls.length, 0, 'nada chegou ao fornecedor')
  })
  await withVideo({ used: 0, supplier }, async (base) => {
    const long = await post(base, '/v1/videos', 'sk-rt-pro', { model: 'veo-3.1-fast', prompt: 'x', seconds: '12' })
    assert.equal(long.status, 400)
  })
})
