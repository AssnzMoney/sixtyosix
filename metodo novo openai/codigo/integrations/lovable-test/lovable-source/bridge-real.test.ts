// Testa o arquivo REAL da ponte (six-test-messages-bridge.server.ts) com o gateway simulado.
// Rodar com: SIX_ZOD_DIR=<pasta com node_modules/zod@3> node --experimental-strip-types \
//   --import ./integrations/lovable-test/lovable-source/test-register.mjs --test <este arquivo>
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  processarRequisicaoMessagesSixTest,
  ReservaTentativasMessagesSixTest,
  limparMensagemUpstream,
} from './six-test-messages-bridge.server.ts'

const CHAVE_PONTE = 'ponte-teste-'.padEnd(40, 'x')
const CHAVE_LOVABLE = 'lovable-falsa-'.padEnd(40, 'y')
const agora = Date.parse('2026-11-18T12:00:00Z')
const configuracao = { chaveBridge: CHAVE_PONTE, expiraEm: '2026-11-18T12:30:00Z', chaveLovable: CHAVE_LOVABLE }

// Histórico igual ao teste isolado que deu 502: user → assistant tool_use → user tool_result.
const corpoToolResult = {
  model: 'anthropic/claude-opus-5-5',
  max_tokens: 32,
  stream: false,
  tools: [{ name: 'listar_arquivos', description: 'Lista arquivos', input_schema: { type: 'object', properties: {} } }],
  messages: [
    { role: 'user', content: 'Liste os arquivos.' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_teste01', name: 'listar_arquivos', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_teste01', content: 'a.txt' }] },
  ],
}

function pedido(corpo: unknown = corpoToolResult): Request {
  return new Request('https://ponte.invalid/api/public/six-test/v1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CHAVE_PONTE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
}

async function chamar(fetchSimulado: typeof fetch) {
  const logs: unknown[] = []
  const original = console.info
  console.info = (...args: unknown[]) => void logs.push(args)
  try {
    const resposta = await processarRequisicaoMessagesSixTest(
      pedido(),
      configuracao,
      fetchSimulado,
      agora,
      new ReservaTentativasMessagesSixTest(),
    )
    return { resposta, corpo: await resposta.json(), logs: JSON.stringify(logs) }
  } finally {
    console.info = original
  }
}

test('tool_result chega ao gateway sem ser alterado', async () => {
  let enviado: any
  const { resposta } = await chamar((async (_url: unknown, init: RequestInit) => {
    enviado = JSON.parse(String(init.body))
    return Response.json({ type: 'message', content: [{ type: 'text', text: 'OK' }], stop_reason: 'end_turn' })
  }) as typeof fetch)
  assert.equal(resposta.status, 200)
  assert.deepEqual(enviado.messages, corpoToolResult.messages)
  assert.deepEqual(enviado.tools, corpoToolResult.tools)
})

test('recusa do gateway devolve status, tipo e mensagem ao chamador, sem pôr a mensagem no log', async () => {
  const { resposta, corpo, logs } = await chamar((async () =>
    Response.json(
      { type: 'error', error: { type: 'invalid_request_error', message: `tool_result sem tool_use correspondente; Bearer ${CHAVE_LOVABLE}` } },
      { status: 400 },
    )) as typeof fetch)
  assert.equal(resposta.status, 502)
  assert.equal(resposta.headers.get('X-Six-Bridge-Stage'), 'upstream_rejected')
  assert.equal(resposta.headers.get('X-Six-Bridge-Upstream-Status'), '400')
  assert.equal(resposta.headers.get('X-Six-Bridge-Upstream-Error-Type'), 'invalid_request_error')
  assert.match(corpo.error.message, /HTTP 400, invalid_request_error\): tool_result sem tool_use correspondente/)
  assert.ok(!corpo.error.message.includes(CHAVE_LOVABLE))
  assert.ok(!logs.includes('tool_result sem tool_use'))
  assert.ok(logs.includes('invalid_request_error'))
})

test('erro no formato OpenAI e erro em texto simples também são lidos', async () => {
  const openai = await chamar((async () =>
    Response.json({ error: { message: 'Not enough credits', code: 'payment_required' } }, { status: 402 })) as typeof fetch)
  assert.match(openai.corpo.error.message, /HTTP 402, payment_required\): Not enough credits/)
  const texto = await chamar((async () => Response.json({ error: 'Rate limited' }, { status: 429 })) as typeof fetch)
  assert.match(texto.corpo.error.message, /HTTP 429\): Rate limited/)
})

test('resposta HTML não é repetida para o chamador', async () => {
  const { resposta, corpo } = await chamar((async () =>
    new Response('<html>PRIVADO</html>', { status: 503, headers: { 'Content-Type': 'text/html' } })) as typeof fetch)
  assert.equal(resposta.headers.get('X-Six-Bridge-Upstream-Status'), '503')
  assert.ok(!corpo.error.message.includes('PRIVADO'))
  assert.match(corpo.error.message, /HTTP 503/)
})

test('erro em texto puro é repetido, limpo', async () => {
  const { corpo } = await chamar((async () =>
    new Response('Upstream model unavailable\n', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })) as typeof fetch)
  assert.match(corpo.error.message, /HTTP 503\): Upstream model unavailable\./)
})

test('erro de conexão informa o código sem mensagem interna', async () => {
  const { resposta, corpo } = await chamar((async () => {
    throw Object.assign(new TypeError('PRIVADO'), { cause: { code: 'ECONNRESET' } })
  }) as typeof fetch)
  assert.equal(resposta.status, 502)
  assert.equal(resposta.headers.get('X-Six-Bridge-Stage'), 'fetch_exception')
  assert.match(corpo.error.message, /TypeError ECONNRESET/)
  assert.ok(!corpo.error.message.includes('PRIVADO'))
})

test('mensagem longa é cortada e corpo acima de 8 KiB é ignorado', async () => {
  const longa = await chamar((async () =>
    Response.json({ error: { type: 'invalid_request_error', message: 'ab '.repeat(1000) } }, { status: 400 })) as typeof fetch)
  assert.ok(longa.corpo.error.message.length < 450)
  assert.match(longa.corpo.error.message, /…/)
  const enorme = await chamar((async () =>
    Response.json({ error: { type: 'invalid_request_error', message: 'ab '.repeat(20000) } }, { status: 400 })) as typeof fetch)
  assert.equal(enorme.resposta.headers.get('X-Six-Bridge-Upstream-Status'), '400')
  assert.ok(enorme.corpo.error.message.length < 200)
})

test('JSON sem objeto não quebra a ponte', async () => {
  const { resposta, corpo } = await chamar((async () =>
    new Response('null', { status: 500, headers: { 'Content-Type': 'application/json' } })) as typeof fetch)
  assert.equal(resposta.status, 502)
  assert.match(corpo.error.message, /HTTP 500\)\./)
})

test('limpeza apaga chaves e caracteres de controle', () => {
  assert.equal(limparMensagemUpstream('a\n\tb sk-' + 'z'.repeat(40)), 'a b [omitido]')
})
