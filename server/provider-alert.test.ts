import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createProviderAlert, outcomeKind, providerAlertFromEnv } from './provider-alert.ts'

function harness() {
  let clock = Date.UTC(2026, 10, 16, 20, 0)
  const sent: { subject: string; text: string; key: string }[] = []
  const alert = createProviderAlert(async (subject, text, key) => { sent.push({ subject, text, key }) }, () => clock)
  return { alert, sent, tick: (ms: number) => { clock += ms } }
}

test('tipos de resposta do fornecedor', () => {
  assert.equal(outcomeKind(200), 'ok')
  assert.equal(outcomeKind(401), 'auth')
  assert.equal(outcomeKind(402), 'auth')
  assert.equal(outcomeKind(503), 'down')
  assert.equal(outcomeKind(429), 'other', 'limite de chamadas não é queda')
  assert.equal(outcomeKind(400), 'other')
})

test('key mestra recusada: avisa na 5ª recusa em 5 minutos, uma vez só', async () => {
  const { alert, sent, tick } = harness()
  for (let i = 0; i < 4; i++) { alert.record('Principal', 401); tick(1000) }
  assert.equal(sent.length, 0)
  alert.record('Principal', 401)
  await Promise.resolve()
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /recusando a key mestra/)
  assert.match(sent[0].text, /5× 401/)
  for (let i = 0; i < 20; i++) { alert.record('Principal', 401); tick(1000) }
  await Promise.resolve()
  assert.equal(sent.length, 1, 'não repete enquanto o problema continua')
})

test('recusas espalhadas (fora da janela de 5 minutos) não avisam', async () => {
  const { alert, sent, tick } = harness()
  for (let i = 0; i < 10; i++) { alert.record('Principal', 401); tick(2 * 60_000) }
  await Promise.resolve()
  assert.equal(sent.length, 0)
})

test('instabilidade: precisa de 15 falhas e 40% das chamadas', async () => {
  const { alert, sent, tick } = harness()
  // 15 falhas no meio de 100 respostas boas: 13%, não avisa.
  for (let i = 0; i < 100; i++) { alert.record('Principal', 200); tick(500) }
  for (let i = 0; i < 15; i++) { alert.record('Principal', 503); tick(500) }
  await Promise.resolve()
  assert.equal(sent.length, 0)
  // Passa a janela e o fornecedor cai de vez.
  tick(6 * 60_000)
  for (let i = 0; i < 15; i++) { alert.record('Principal', i % 2 ? 502 : 503); tick(1000) }
  await Promise.resolve()
  assert.equal(sent.length, 1)
  assert.match(sent[0].subject, /instável/)
})

test('avisa quando volta e respeita 30 minutos entre avisos do mesmo tipo', async () => {
  const { alert, sent, tick } = harness()
  for (let i = 0; i < 5; i++) alert.record('Principal', 401)
  tick(6 * 60_000) // as recusas saem da janela
  for (let i = 0; i < 10; i++) { alert.record('Principal', 200); tick(1000) }
  await Promise.resolve()
  assert.equal(sent.length, 2)
  assert.match(sent[1].subject, /voltou/)
  // Cai de novo logo em seguida: dentro dos 30 minutos, não manda outro aviso.
  for (let i = 0; i < 5; i++) alert.record('Principal', 401)
  await Promise.resolve()
  assert.equal(sent.length, 2)
  tick(31 * 60_000)
  for (let i = 0; i < 5; i++) alert.record('Principal', 401)
  await Promise.resolve()
  assert.equal(sent.length, 3)
})

test('chamadas canceladas ou erro no envio nunca quebram o gateway', async () => {
  const alert = createProviderAlert(async () => { throw new Error('Resend fora') })
  for (let i = 0; i < 10; i++) alert.record('Principal', 401)
  await new Promise((resolve) => setTimeout(resolve, 0))
})

test('e-mail real: vai para cada admin, com idempotência', async () => {
  const calls: { to: string; key: string | null }[] = []
  const request = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    calls.push({ to: Array.isArray(body.to) ? body.to[0] : body.to, key: new Headers(init.headers).get('idempotency-key') })
    return Response.json({ id: 'x' })
  }) as typeof fetch
  const alert = providerAlertFromEnv({ RESEND_API_KEY: 're_test', SIXTYSIX_ADMIN_EMAILS: 'a@x.com, b@x.com' } as NodeJS.ProcessEnv, request)
  const original = console.error
  console.error = () => {}
  try {
    for (let i = 0; i < 5; i++) alert.record('Principal', 401)
    await new Promise((resolve) => setTimeout(resolve, 10))
  } finally { console.error = original }
  assert.deepEqual(calls.map((c) => c.to).sort(), ['a@x.com', 'b@x.com'])
  assert.ok(calls.every((c) => c.key?.startsWith('provider-alert:Principal:auth:')))
})

test('key do pool recusada: avisa na primeira recusa de cada key, sem repetir por 30 minutos', async () => {
  const { alert, sent, tick } = harness()
  alert.keyRefused('Principal', '…2959', 402)
  alert.keyRefused('Principal', '…2959', 402)
  alert.keyRefused('Principal', '…1111', 401)
  await Promise.resolve()
  assert.equal(sent.length, 2, 'uma por key')
  assert.match(sent[0].subject, /uma key do pool foi recusada/)
  assert.match(sent[0].text, /…2959 \(402, sem saldo\)/)
  assert.match(sent[0].text, /clientes não foram afetados/)
  tick(30 * 60_000)
  alert.keyRefused('Principal', '…2959', 402)
  await Promise.resolve()
  assert.equal(sent.length, 3, 'depois de 30 minutos avisa de novo')
})
