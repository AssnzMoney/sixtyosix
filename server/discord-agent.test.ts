import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAgent, ESCALATE, hasKey, parseReply, RateLimiter, splitMessage, toMessages } from './discord/agent.ts'
import { SUPPORT_PROMPT } from './discord/knowledge.ts'
import { clearRouterCache, sealSecret } from './router.ts'

test('chave colada no chat é reconhecida (e texto comum não)', () => {
  assert.ok(hasKey('minha chave é sk-rt-AbCdEf1234567890xyz e não funciona'))
  assert.ok(hasKey('sk-sp-0123456789abcdefABCD'))
  assert.ok(!hasKey('o erro foi 401 com sk-... (escondi)'))
  assert.ok(!hasKey('use o modelo claude-opus-5-5'))
})

test('marca de equipe sai do texto e liga o chamado', () => {
  assert.deepEqual(parseReply(`Isso é com a equipe, que vê o pagamento.\n\n${ESCALATE}`), { text: 'Isso é com a equipe, que vê o pagamento.', escalate: true })
  assert.deepEqual(parseReply('Troque o endereço para https://www.sixtysix.online.'), { text: 'Troque o endereço para https://www.sixtysix.online.', escalate: false })
})

test('resposta longa vira várias mensagens do Discord sem quebrar bloco de código', () => {
  const code = ['```', ...Array.from({ length: 60 }, (_, i) => `linha de código número ${i} com algum texto`), '```'].join('\n')
  const chunks = splitMessage(`Faça assim:\n${code}\nPronto.`, 800)
  assert.ok(chunks.length > 1)
  for (const c of chunks) {
    assert.ok(c.length <= 820, 'cada pedaço cabe')
    assert.equal((c.match(/```/g) || []).length % 2, 0, 'todo bloco aberto é fechado no mesmo pedaço')
  }
  assert.equal(splitMessage('curta').length, 1)
  assert.ok(splitMessage('x'.repeat(5000), 1900).every((c) => c.length <= 1900))
})

test('histórico: começa pela pessoa, guarda o nome e corta o mais antigo quando passa do orçamento', () => {
  const messages = toMessages([
    { role: 'assistant', content: 'mensagem solta do bot' },
    { role: 'user', name: 'Ana', content: 'a'.repeat(300) },
    { role: 'assistant', content: 'resposta' },
    { role: 'user', name: 'Ana', content: 'e agora?' },
  ], 300)
  assert.equal(messages[0].role, 'system')
  assert.equal(messages[0].content, SUPPORT_PROMPT)
  assert.equal(messages[1].role, 'user', 'nunca começa pelo assistente')
  assert.equal(messages.at(-1)!.content, 'Ana: e agora?')
  assert.ok(!messages.some((m) => m.content.includes('a'.repeat(300))), 'a mensagem antiga que não cabe sai')
})

test('limite por pessoa: 8 perguntas em 10 minutos, e libera depois', () => {
  const limiter = new RateLimiter(2, 1000)
  assert.ok(limiter.allow('ana', 0))
  assert.ok(limiter.allow('ana', 10))
  assert.ok(!limiter.allow('ana', 20))
  assert.ok(limiter.allow('bia', 20), 'outra pessoa não é afetada')
  assert.ok(limiter.allow('ana', 1100), 'passou a janela')
})

test('agente: chama o modelo pelo Roteador e, se ele falhar, tenta o argon-4', async () => {
  const env = { SUPABASE_URL: 'https://exemplo.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }
  clearRouterCache()
  const encrypted_key = sealSecret('gw_master', env.SUPABASE_SERVICE_ROLE_KEY, 'router:provider:p')
  const asked: string[] = []
  const request = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/rest/v1/router_models')) {
      return Response.json([
        { alias: 'claude-opus-5-5', label: 'Claude Opus 5.5', upstream_model: 'anthropic/claude-opus-5-5', in_pro: true, provider: { id: 'p', name: 'Principal', base_url: 'https://fornecedor.exemplo/v1', encrypted_key, enabled: true } },
        { alias: 'argon-4', label: 'Argon 4', upstream_model: 'google/gemini-4-argon', in_pro: true, provider: { id: 'p', name: 'Principal', base_url: 'https://fornecedor.exemplo/v1', encrypted_key, enabled: true } },
      ])
    }
    if (url.includes('/chat/completions')) {
      const body = JSON.parse(String(init?.body))
      asked.push(body.model)
      if (body.model === 'anthropic/claude-opus-5-5') return Response.json({ error: { message: 'fora' } }, { status: 503 })
      return Response.json({ choices: [{ message: { content: `Precisa da equipe.\n${ESCALATE}` } }] })
    }
    return Response.json([])
  }
  const errors = console.error
  console.error = () => {}
  try {
    const reply = await createAgent(env, request as typeof fetch).ask([{ role: 'user', name: 'Ana', content: 'meu Pix não caiu' }])
    assert.deepEqual(asked, ['anthropic/claude-opus-5-5', 'google/gemini-4-argon'])
    assert.equal(reply.text, 'Precisa da equipe.')
    assert.equal(reply.escalate, true)
    assert.equal(reply.model, 'argon-4')
  } finally {
    console.error = errors
  }
})
