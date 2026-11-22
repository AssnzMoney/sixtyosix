import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadUsageSummary, summarizeUsage } from './usage-summary.ts'

const at = (s: number) => new Date(Date.UTC(2026, 10, 20, 12, 0, 0) + s * 1000).toISOString()

test('soma por chave: tokens, erros por código, modelos e pico por minuto', () => {
  const sum = summarizeUsage()
  for (let i = 0; i < 5; i++) sum.add({ client_id: 'a', requested_alias: 'claude-opus-5-5', status_code: 200, input_tokens: 100, output_tokens: 10, created_at: at(i * 10) })
  sum.add({ client_id: 'a', requested_alias: 'argon-4', status_code: 429, input_tokens: 0, output_tokens: 0, created_at: at(120) })
  sum.add({ client_id: 'b', requested_alias: 'argon-4', status_code: 502, input_tokens: 0, output_tokens: 0, created_at: at(130) })
  sum.add({ client_id: 'b', requested_alias: 'argon-4', status_code: 200, input_tokens: 9000, output_tokens: 900, created_at: at(200) })
  const r = sum.result(true)
  assert.deepEqual(r.total, { requests: 8, input: 9500, output: 950, errors: 2 })
  assert.equal(r.clients[0].client_id, 'b', 'quem gastou mais tokens vem primeiro')
  const a = r.clients.find((c) => c.client_id === 'a')!
  assert.deepEqual([a.requests, a.input, a.output, a.errors, a.peak], [6, 500, 50, 1, 5])
  assert.deepEqual(a.models, { 'claude-opus-5-5': 5, 'argon-4': 1 })
  assert.equal(a.last, at(120))
  assert.deepEqual(r.errors.map((e) => e.code).sort(), [429, 502])
  assert.ok(!('window' in a), 'o controle interno do pico não vai para o painel')
})

test('lê o período inteiro de 1.000 em 1.000 pelo cursor, sem o limite de 10.000 do painel', async () => {
  const all = Array.from({ length: 12_345 }, (_, i) => ({ id: i + 1, client_id: i % 2 ? 'a' : 'b', requested_alias: 'm', status_code: 200, input_tokens: 1, output_tokens: 2, created_at: at(Math.floor(i / 3)) }))
  const urls: string[] = []
  const request = (async (url: string) => {
    urls.push(url)
    const and = new URL(url).searchParams.get('and') || ''
    const cursor = and.match(/created_at\.eq\.([^,]+),id\.gt\.(\d+)/)
    const rows = cursor ? all.filter((r) => r.created_at > cursor[1] || (r.created_at === cursor[1] && r.id > Number(cursor[2]))) : all
    return Response.json(rows.slice(0, 1000))
  }) as typeof fetch
  const r = await loadUsageSummary({ url: 'https://db.example', headers: {} }, request, '2026-11-20', '2026-11-20')
  assert.equal(r.complete, true)
  assert.equal(r.total.requests, 12_345)
  assert.equal(r.total.output, 24_690)
  assert.equal(urls.length, 13)
  const first = new URL(urls[0]).searchParams
  assert.equal(first.get('and'), '(created_at.gte.2026-11-20T00:00:00Z,created_at.lt.2026-11-21T00:00:00.000Z)')
  assert.equal(first.get('order'), 'created_at.asc,id.asc')
})

test('banco fora do ar: erro, sem números pela metade', async () => {
  const request = (async () => new Response('x', { status: 500 })) as typeof fetch
  await assert.rejects(loadUsageSummary({ url: 'https://db.example', headers: {} }, request, '2026-11-20', '2026-11-20'))
})
