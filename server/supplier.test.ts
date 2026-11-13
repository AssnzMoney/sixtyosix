import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UsageTap, endpointKind, recordUsage, supplierErrorBody, supplierRequestBody, supplierUrl } from './supplier.ts'

const encode = (text: string) => new TextEncoder().encode(text)

test('a URL do provedor não duplica o /v1', () => {
  assert.equal(supplierUrl('https://fornecedor.example/v1', '/v1/messages', '?beta=true'), 'https://fornecedor.example/v1/messages?beta=true')
  assert.equal(supplierUrl('https://fornecedor.example/v1', '/v1/chat/completions'), 'https://fornecedor.example/v1/chat/completions')
  assert.equal(supplierUrl('https://f.example/api/v1', '/v1/responses'), 'https://f.example/api/v1/responses')
  assert.equal(supplierUrl('https://api.anthropic.com', '/v1/models'), 'https://api.anthropic.com/v1/models')
})

test('stream do chat da OpenAI pede o consumo e o evento extra não chega ao cliente', () => {
  const prepared = supplierRequestBody({ model: 'gpt-6.1-sol', stream: true }, '/v1/chat/completions', 'openai/gpt-6.1-sol')
  assert.equal(prepared.injectedUsage, true)
  assert.deepEqual(JSON.parse(prepared.body), { model: 'openai/gpt-6.1-sol', stream: true, stream_options: { include_usage: true } })
  assert.equal(supplierRequestBody({ model: 'x', stream: true, stream_options: { include_usage: true } }, '/v1/chat/completions', 'y').injectedUsage, false)

  const tap = new UsageTap({ stream: true, alias: 'gpt-6.1-sol', supplierId: 'openai/gpt-6.1-sol', dropInjectedUsage: true })
  let out = tap.push(encode('data: {"model":"openai/gpt-6.1-sol","choices":[{"delta":{"content":"Oi"}}]}\r\n\r\ndata: {"choices":[],"usa'))
  out += tap.push(encode('ge":{"prompt_tokens":12,"completion_tokens":3}}\n\ndata: [DONE]\n\n'))
  out += tap.end()
  assert.equal(out, 'data: {"model":"gpt-6.1-sol","choices":[{"delta":{"content":"Oi"}}]}\n\ndata: [DONE]\n\n')
  assert.deepEqual(tap.usage, { input: 12, output: 3 })
})

test('conta tokens no formato Anthropic, Responses e resposta comum', () => {
  const anthropic = new UsageTap({ stream: true, alias: 'claude-opus-5-5', supplierId: 'anthropic/claude-opus-5-5', dropInjectedUsage: false })
  anthropic.push(encode('event: message_start\ndata: {"type":"message_start","message":{"model":"anthropic/claude-opus-5-5","usage":{"input_tokens":10,"cache_read_input_tokens":90,"output_tokens":1}}}\n\n'))
  anthropic.push(encode('event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":42}}\n\n'))
  anthropic.end()
  assert.deepEqual(anthropic.usage, { input: 100, output: 42 })

  const responses = new UsageTap({ stream: true, alias: 'gpt-5.6-sol', supplierId: 'openai/gpt-5.6-sol', dropInjectedUsage: false })
  responses.push(encode('event: response.completed\ndata: {"type":"response.completed","response":{"usage":{"input_tokens":7,"output_tokens":5}}}\n\n'))
  assert.deepEqual(responses.usage, { input: 7, output: 5 })

  const plain = new UsageTap({ stream: false, alias: 'argon-4', supplierId: 'google/gemini-4-argon', dropInjectedUsage: false })
  assert.equal(plain.push(encode('{"model":"google/gemini-4-argon","usage":{"prompt_tokens":3,')), '')
  plain.push(encode('"completion_tokens":2}}'))
  const body = plain.end()
  assert.ok(body.includes('"model":"argon-4"'))
  assert.deepEqual(plain.usage, { input: 3, output: 2 })
})

const events = (text: string) => text.split('\n\n').filter(Boolean).map((block) => JSON.parse(block.split('\n').find((l) => l.startsWith('data: '))!.slice(6)))

test('Anthropic em stream: ID msg_ igual no stream, campos extras fora, tool_use e texto intactos, tokens certos', () => {
  const tap = new UsageTap({ stream: true, alias: 'claude-fable-5.2', supplierId: 'anthropic/claude-opus-5-5', dropInjectedUsage: false, kind: 'anthropic' })
  let out = tap.push(encode('event: message_start\ndata: {"type":"message_start","provider":"delver","message":{"id":"gen-xyz","type":"message","role":"assistant","model":"claude-opus-5-5-20260101","content":[],"diagnostics":null,"usage":{"input_tokens":10,"cache_read_input_tokens":90,"output_tokens":1,"service_tier":"standard","inference_geo":"global","cost":0.01}}}\n\nevent: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_abc","name":"ler","input":{}}}\n\n'))
  out += tap.push(encode('event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"o id gen-xyz e o \\"model\\":\\"x\\""}}\n\nevent: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":42,"service_tier":"standard"}}\n\n'))
  out += tap.end()
  const [start, block, delta, end] = events(out)
  assert.match(start.message.id, /^msg_[A-Za-z0-9]{24}$/)
  assert.equal(start.message.id, tap.id)
  assert.equal(start.message.model, 'claude-fable-5.2')
  assert.equal(start.provider, undefined)
  assert.equal(start.message.diagnostics, undefined)
  assert.deepEqual(start.message.usage, { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 1 })
  assert.equal(block.content_block.id, 'toolu_abc', 'ID de tool_use não muda')
  assert.equal(delta.delta.text, 'o id gen-xyz e o "model":"x"', 'texto da mensagem não muda')
  assert.deepEqual(end.usage, { output_tokens: 42 })
  assert.ok(out.includes('event: message_start\n'))
  assert.deepEqual(tap.usage, { input: 100, output: 42 })
})

test('Anthropic sem stream: ID msg_, sem campos extras e tokens certos', () => {
  const tap = new UsageTap({ stream: false, alias: 'argon-4', supplierId: 'x', dropInjectedUsage: false, kind: 'anthropic' })
  tap.push(encode('{"id":"gen-xyz","type":"message","role":"assistant","model":"real","provider":"OpenRouter","content":[{"type":"tool_use","id":"toolu_1","name":"f","input":{}}],"stop_reason":"tool_use","stop_sequence":null,"usage":{"input_tokens":5,"output_tokens":3,"cost":1}}'))
  const body = JSON.parse(tap.end())
  assert.match(body.id, /^msg_/)
  assert.equal(body.provider, undefined)
  assert.equal(body.model, 'argon-4')
  assert.equal(body.content[0].id, 'toolu_1')
  assert.deepEqual(body.usage, { input_tokens: 5, output_tokens: 3 })
  assert.deepEqual(tap.usage, { input: 5, output: 3 })
})

test('chat sem stream: ID chatcmpl-, sem provider, system_fingerprint, service_tier e cost; tool_call intacto', () => {
  const tap = new UsageTap({ stream: false, alias: 'argon-4', supplierId: 'google/gemini-4-argon', dropInjectedUsage: false, kind: 'chat' })
  tap.push(encode('{"id":"gen-xyz","provider":"Google","object":"chat.completion","created":1,"model":"google/gemini-4-argon","system_fingerprint":"fp","service_tier":"default","x_groq":{"id":"q"},"choices":[{"index":0,"finish_reason":"tool_calls","native_finish_reason":"STOP","message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_123","type":"function","function":{"name":"ler","arguments":"{}"}}]}}],"usage":{"prompt_tokens":36,"completion_tokens":5,"total_tokens":41,"cost":0.1,"is_byok":false}}'))
  const body = JSON.parse(tap.end())
  assert.match(body.id, /^chatcmpl-[A-Za-z0-9]{24}$/)
  for (const field of ['provider', 'system_fingerprint', 'service_tier', 'x_groq']) assert.equal(body[field], undefined, field)
  assert.equal(body.choices[0].native_finish_reason, undefined)
  assert.equal(body.choices[0].message.tool_calls[0].id, 'call_123')
  assert.deepEqual(body.usage, { prompt_tokens: 36, completion_tokens: 5, total_tokens: 41 })
  assert.deepEqual(tap.usage, { input: 36, output: 5 })
})

test('Responses em stream: ID resp_ igual em todos os eventos e o previous_response_id volta ao do fornecedor', () => {
  const tap = new UsageTap({ stream: true, alias: 'gpt-6-astra', supplierId: 'openai/gpt-6.1-sol', dropInjectedUsage: false, kind: 'responses' })
  let out = tap.push(encode('event: response.created\ndata: {"type":"response.created","response":{"id":"gen-xyz","object":"response","model":"openai/gpt-6.1-sol","provider":"OpenAI","output":[]}}\n\n'))
  out += tap.push(encode('event: response.output_item.added\ndata: {"type":"response.output_item.added","output_index":0,"item":{"id":"fc_9","type":"function_call","call_id":"call_9"}}\n\n'))
  out += tap.push(encode('event: response.completed\ndata: {"type":"response.completed","response":{"id":"gen-xyz","object":"response","model":"openai/gpt-6.1-sol","service_tier":"auto","usage":{"input_tokens":7,"output_tokens":5,"total_tokens":12,"cost":2}}}\n\n'))
  out += tap.end()
  const [created, item, completed] = events(out)
  assert.match(created.response.id, /^resp_[A-Za-z0-9]{24}$/)
  assert.equal(created.response.id, completed.response.id, 'o mesmo ID em todo o stream')
  assert.equal(created.response.provider, undefined)
  assert.equal(completed.response.service_tier, undefined)
  assert.equal(item.item.call_id, 'call_9', 'IDs de ferramenta não mudam')
  assert.deepEqual(completed.response.usage, { input_tokens: 7, output_tokens: 5, total_tokens: 12 })
  assert.deepEqual(tap.usage, { input: 7, output: 5 })
  // O cliente manda o nosso ID de volta: o fornecedor recebe o dele.
  const next = JSON.parse(supplierRequestBody({ model: 'gpt-6-astra', previous_response_id: tap.id, input: 'e agora?' }, '/v1/responses', 'openai/gpt-6.1-sol').body)
  assert.equal(next.previous_response_id, 'gen-xyz')
})

test('erro no meio do stream não mostra a mensagem do fornecedor', () => {
  const tap = new UsageTap({ stream: true, alias: 'a', supplierId: 'b', dropInjectedUsage: false, kind: 'anthropic' })
  const out = tap.push(encode('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"DelverTokens upstream sobrecarregado"}}\n\n'))
  assert.ok(!out.includes('Delver'))
  assert.equal(events(out)[0].error.type, 'overloaded_error')
})

test('formato e mensagem dos erros nossos por endpoint e status', () => {
  assert.equal(endpointKind('/v1/messages'), 'anthropic')
  assert.equal(endpointKind('/v1/chat/completions'), 'chat')
  assert.equal(endpointKind('/v1/responses'), 'responses')
  assert.equal(endpointKind('/v1/embeddings'), 'other')
  assert.deepEqual(supplierErrorBody('anthropic', 429), { type: 'error', error: { type: 'rate_limit_error', message: 'Muitas chamadas agora. Aguarde um instante.' } })
  assert.deepEqual(supplierErrorBody('chat', 404), { error: { message: 'Modelo ou recurso não encontrado.', type: 'not_found_error', code: null } })
  assert.deepEqual(supplierErrorBody('responses', 413), { error: { message: 'Pedido grande demais.', type: 'invalid_request_error', code: null } })
  assert.equal(supplierErrorBody('anthropic', 422).error.message, 'Não foi possível processar o pedido.')
})

test('identidade: o modelo recebe o nome vendido antes das instruções do cliente, nos três formatos', () => {
  const anthropicArray = JSON.parse(supplierRequestBody({ model: 'x', system: [{ type: 'text', text: 'Claude Code', cache_control: { type: 'ephemeral' } }] }, '/v1/messages', 'anthropic/claude-opus-5-5', 'Claude Fable 5.2').body)
  assert.match(anthropicArray.system[0].text, /você é o Claude Fable 5\.2/)
  assert.deepEqual(anthropicArray.system[1], { type: 'text', text: 'Claude Code', cache_control: { type: 'ephemeral' } }, 'as instruções do cliente ficam intactas')
  const anthropicString = JSON.parse(supplierRequestBody({ model: 'x', system: 'Seja breve.' }, '/v1/messages', 'y', 'Argon 4').body)
  assert.match(anthropicString.system, /^Identidade do modelo: você é o Argon 4.*\n\nSeja breve\.$/s)
  assert.match(JSON.parse(supplierRequestBody({ model: 'x' }, '/v1/messages', 'y', 'Argon 4').body).system, /Argon 4/)
  const chat = JSON.parse(supplierRequestBody({ model: 'x', messages: [{ role: 'user', content: 'oi' }] }, '/v1/chat/completions', 'y', 'GPT Astra 6').body)
  assert.equal(chat.messages[0].role, 'system')
  assert.match(chat.messages[0].content, /GPT Astra 6/)
  assert.deepEqual(chat.messages[1], { role: 'user', content: 'oi' })
  const responses = JSON.parse(supplierRequestBody({ model: 'x', instructions: 'Use português.' }, '/v1/responses', 'y', 'GPT Astra 6').body)
  assert.match(responses.instructions, /GPT Astra 6.*\n\nUse português\.$/s)
  // Sem nome (ou em rotas sem conversa), nada muda.
  assert.equal(JSON.parse(supplierRequestBody({ model: 'x', system: 'a' }, '/v1/messages', 'y').body).system, 'a')
  assert.equal(JSON.parse(supplierRequestBody({ model: 'x', input: 'a' }, '/v1/embeddings', 'y', 'Nome').body).instructions, undefined)
})

test('o cliente nunca vê o modelo real, mesmo quando o fornecedor devolve outro formato de nome', () => {
  // Visto em produção: pediu "anthropic/claude-opus-5-5" e o fornecedor respondeu "claude-opus-5-5".
  const plain = new UsageTap({ stream: false, alias: 'claude-fable-5.2', supplierId: 'anthropic/claude-opus-5-5', dropInjectedUsage: false })
  plain.push(encode('{"id":"msg_1","model":"claude-opus-5-5","content":[{"type":"text","text":"veja o campo \\"model\\":\\"x\\" no JSON"}],"usage":{"input_tokens":1,"output_tokens":1}}'))
  const body = JSON.parse(plain.end())
  assert.equal(body.model, 'claude-fable-5.2')
  assert.equal(body.content[0].text, 'veja o campo "model":"x" no JSON', 'texto da resposta não é mexido')
  // Stream: data no fim do nome ("claude-haiku-4-5-20251001") e um "model" em cada pedaço do chat da OpenAI.
  const stream = new UsageTap({ stream: true, alias: 'claude-opus.5.5', supplierId: 'anthropic/claude-haiku-4-5', dropInjectedUsage: false })
  const out = stream.push(encode('event: message_start\ndata: {"type":"message_start","message":{"model":"claude-haiku-4-5-20251001","usage":{"input_tokens":3,"output_tokens":1}}}\n\n'))
    + stream.push(encode('data: {"id":"c1","model":"claude-haiku-4-5-20251001","choices":[{"delta":{"content":"oi"}}]}\n\n'))
    + stream.end()
  assert.ok(!out.includes('haiku'), out)
  assert.equal(out.split('"model":"claude-opus.5.5"').length - 1, 2)
})

test('consumo: coluna obrigatória herdada da API antiga é preenchida com o valor de um registro antigo', async () => {
  const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }
  const row = { client_id: 'c1', requested_alias: 'claude-fable-5.1', status_code: 200, input_tokens: 10, output_tokens: 2, latency_ms: 900 }
  const posts: Record<string, unknown>[] = [], gets: string[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    if (init.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      posts.push(body)
      if (!('upstream_tier' in body)) return Response.json({ code: '23502', message: 'null value in column "upstream_tier" of relation "gateway_usage" violates not-null constraint' }, { status: 400 })
      return new Response(null, { status: 201 })
    }
    gets.push(decodeURIComponent(String(input)))
    return Response.json([{ upstream_tier: 'standard' }])
  }) as typeof fetch
  await recordUsage(env, request, row)
  assert.equal(posts.length, 2)
  assert.deepEqual(posts[1], { ...row, upstream_tier: 'standard' })
  assert.ok(gets[0].includes('select=upstream_tier') && gets[0].includes('upstream_tier=not.is.null'))
  // Da segunda vez já vai certo, sem tentar de novo nem consultar.
  await recordUsage(env, request, row)
  assert.equal(posts.length, 3)
  assert.equal(gets.length, 1)
  assert.equal(posts[2].upstream_tier, 'standard')
})

test('consumo: outro erro do banco não fica tentando de novo', async () => {
  let calls = 0
  const request = (async () => { calls++; return Response.json({ code: '23503', message: 'insert or update violates foreign key constraint' }, { status: 409 }) }) as typeof fetch
  await recordUsage({ SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'k' }, request, { client_id: 'x', requested_alias: 'a', status_code: 200, input_tokens: 0, output_tokens: 0, latency_ms: 1 })
  assert.equal(calls, 1)
})
