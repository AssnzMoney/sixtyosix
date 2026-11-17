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
  const env = { SUPABASE_URL: 'https://exemplo.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x', DISCORD_AGENT_WAIT_MS: '0' }
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

test('agente: limite do fornecedor (429) espera e tenta de novo no mesmo modelo', async () => {
  const env = { SUPABASE_URL: 'https://exemplo2.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_y', DISCORD_AGENT_WAIT_MS: '5000' }
  clearRouterCache()
  const encrypted_key = sealSecret('gw_master', env.SUPABASE_SERVICE_ROLE_KEY, 'router:provider:p')
  let calls = 0
  const request = async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes('/rest/v1/router_models')) return Response.json([{ alias: 'claude-opus-5-5', label: 'Claude Opus 5.5', upstream_model: 'anthropic/claude-opus-5-5', in_pro: true, provider: { id: 'p', name: 'Principal', base_url: 'https://fornecedor.exemplo/v1', encrypted_key, enabled: true } }])
    if (url.includes('/chat/completions')) return ++calls === 1 ? Response.json({ error: { message: 'Limite de requisições atingido.' } }, { status: 429, headers: { 'retry-after': '1' } }) : Response.json({ choices: [{ message: { content: 'Confira o endereço.' } }] })
    return Response.json([])
  }
  const errors = console.error
  console.error = () => {}
  try {
    const started = Date.now()
    const reply = await createAgent(env, request as typeof fetch).ask([{ role: 'user', name: 'Ana', content: 'deu 401' }])
    assert.equal(reply.text, 'Confira o endereço.')
    assert.equal(reply.model, 'claude-opus-5-5')
    assert.equal(calls, 2)
    assert.ok(Date.now() - started >= 900, 'esperou o retry-after')
  } finally {
    console.error = errors
  }
})

test('embeds: respostas longas viram várias mensagens e o chamado da equipe leva cartão âmbar e botão do WhatsApp', async () => {
  const { replyPayloads, COLORS } = await import('./discord/embeds.ts')
  const short = replyPayloads('Confira o endereço.', false)
  assert.equal(short.length, 1)
  assert.equal(short[0].embeds[0].description, 'Confira o endereço.')
  assert.deepEqual(short[0].components, [])
  const long = replyPayloads(Array.from({ length: 300 }, (_, i) => `linha ${i} com bastante texto para passar do limite`).join('\n'), true)
  assert.ok(long.length > 1)
  for (const p of long) assert.ok((p.embeds[0].description || '').length <= 4096)
  const last = long.at(-1)!
  assert.equal(last.embeds[1].color, COLORS.warn)
  assert.equal(last.components?.[0].components[0].url, 'https://wa.me/5581992376036')
  assert.ok(long.slice(0, -1).every((p) => p.embeds.length === 1 && !p.components?.length), 'só a última leva o chamado')
})

test('embeds: aviso para a equipe marca os cargos no texto (é o que notifica) e leva o link da conversa', async () => {
  const { staffAlert } = await import('./discord/embeds.ts')
  const alert = staffAlert(['111', '222'], 'Uma dúvida no suporte precisa de vocês', 'Ana', 'https://discord.com/channels/1/2', 'meu pix não caiu')
  assert.equal(alert.content, '<@&111> <@&222>')
  assert.equal(alert.components?.[0].components[0].url, 'https://discord.com/channels/1/2')
  assert.equal(alert.embeds[0].fields?.find((f) => f.name === 'Última mensagem')?.value, 'meu pix não caiu')
})

test('embeds dos canais respeitam os limites do Discord (título, campos, total e botões)', async () => {
  const { CHANNEL_MESSAGES } = await import('./discord/channel-messages.ts')
  const ids = { atendimento: '1', planos: '2', comoconectar: '3', anuncios: '4', projetos: '5' }
  for (const [name, build] of Object.entries(CHANNEL_MESSAGES)) {
    const payload = build(ids)
    let total = 0
    for (const e of payload.embeds) {
      assert.ok(!e.title || e.title.length <= 256, `${name}: título`)
      assert.ok(!e.description || e.description.length <= 4096, `${name}: descrição`)
      assert.ok((e.fields || []).length <= 25, `${name}: campos`)
      for (const f of e.fields || []) {
        assert.ok(f.name.length <= 256 && f.value.length <= 1024 && f.value.length > 0, `${name}: campo ${f.name}`)
        total += f.name.length + f.value.length
      }
      total += (e.title || '').length + (e.description || '').length + (e.footer?.text || '').length
    }
    assert.ok(total <= 6000, `${name}: total ${total}`)
    for (const row of payload.components || []) {
      assert.ok(row.components.length <= 5, `${name}: botões`)
      for (const b of row.components) assert.ok(b.label.length <= 80 && /^https:\/\//.test(b.url), `${name}: botão ${b.label}`)
    }
    assert.ok(!JSON.stringify(payload).includes('#atendimento'), `${name}: menciona o canal pelo id, não pelo nome`)
  }
})
