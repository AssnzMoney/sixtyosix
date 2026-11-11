import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIp, gateRequest, releaseRequest, validLimit, validNetwork } from './guard.ts'

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }
const input = { clientId: '11111111-1111-4111-8111-111111111111', ip: '177.10.20.30', requestId: '22222222-2222-4222-8222-222222222222' }
const rpc = (result: unknown, status = 200) => (async () => (status === 200 ? Response.json(result) : new Response('{}', { status }))) as unknown as typeof fetch

test('ritmo alto e respostas simultâneas viram 429 com tempo de espera', async () => {
  assert.deepEqual(await gateRequest(env, rpc({ ok: false, reason: 'rate', retry_after: 17 }), input), {
    ok: false, status: 429, message: 'Muitas chamadas em pouco tempo. Aguarde alguns segundos: a sua ferramenta tenta de novo sozinha.', retryAfter: 17,
  })
  const busy = await gateRequest(env, rpc({ ok: false, reason: 'busy', retry_after: 3 }), input)
  assert.equal(busy.ok, false)
  assert.equal(busy.ok === false && busy.status, 429)
  const blocked = await gateRequest(env, rpc({ ok: false, reason: 'ip_blocked' }), input)
  assert.equal(blocked.ok === false && blocked.status, 403)
})

test('passou: devolve se a chamada ocupa vaga', async () => {
  assert.deepEqual(await gateRequest(env, rpc({ ok: true, leased: true }), input), { ok: true, leased: true })
  assert.deepEqual(await gateRequest(env, rpc({ ok: true, leased: false }), input), { ok: true, leased: false })
})

test('sem a migração ou com o banco fora, a chamada segue', async () => {
  assert.deepEqual(await gateRequest(env, rpc({}, 404), input), { ok: true, leased: false })
  assert.deepEqual(await gateRequest(env, (async () => { throw new Error('rede') }) as unknown as typeof fetch, input), { ok: true, leased: false })
  assert.deepEqual(await gateRequest({}, rpc({ ok: false, reason: 'rate' }), input), { ok: true, leased: false })
})

test('gate envia chave, IP e id da chamada; release libera a vaga', async () => {
  const calls: { url: string; body: any }[] = []
  const request = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return Response.json({ ok: true, leased: true }) }) as unknown as typeof fetch
  await gateRequest(env, request, input)
  await releaseRequest(env, request, input.requestId)
  assert.equal(calls[0].url, 'https://example.supabase.co/rest/v1/rpc/gateway_gate')
  assert.deepEqual(calls[0].body, { p_client: input.clientId, p_ip: input.ip, p_request: input.requestId })
  assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/rpc/gateway_release')
  assert.deepEqual(calls[1].body, { p_request: input.requestId })
})

test('IP de quem chamou vem da Vercel', () => {
  assert.equal(clientIp({ 'x-real-ip': '177.10.20.30', 'x-forwarded-for': '1.1.1.1' }), '177.10.20.30')
  assert.equal(clientIp({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' }), '200.1.2.3')
  assert.equal(clientIp({}, '127.0.0.1'), '127.0.0.1')
})

test('IPs e faixas aceitos no bloqueio', () => {
  assert.equal(validNetwork('177.10.20.30'), '177.10.20.30')
  assert.equal(validNetwork(' 177.10.20.0/24 '), '177.10.20.0/24')
  assert.equal(validNetwork('2001:db8::1'), '2001:db8::1')
  assert.equal(validNetwork('2001:DB8::/32'), '2001:db8::/32')
  for (const bad of ['', '999.1.1.1', '1.2.3', '1.2.3.4/33', '1.2.3.4/4', 'abc', '1.2.3.4/24/1', '::1::2', "1.2.3.4'; drop table x"]) assert.equal(validNetwork(bad), null, bad)
})

test('limite vazio é sem limite; valor inválido é recusado', () => {
  assert.equal(validLimit('', 100), null)
  assert.equal(validLimit(null, 100), null)
  assert.equal(validLimit('60', 100), 60)
  assert.equal(validLimit(0, 100), undefined)
  assert.equal(validLimit(1.5, 100), undefined)
  assert.equal(validLimit(101, 100), undefined)
})
