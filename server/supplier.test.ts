import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UsageTap, supplierRequestBody, supplierUrl } from './supplier.ts'

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
