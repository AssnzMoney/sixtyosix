import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTestBridge, MODEL, PROMPT } from './handler.ts'
import { supplierUrl } from '../../server/supplier.ts'
const secret = 'test-bridge-key-12345678901234567890'
const clock = () => Date.parse('2026-11-18T12:00:00Z')
const env = { SIX_TEST_BRIDGE_KEY: secret, SIX_TEST_BRIDGE_EXPIRES_AT: '2026-11-18T12:30:00Z', LOVABLE_API_KEY: 'fake-project-key' }
const call = (changes = {}, token = secret) => new Request('https://project.example/api/six-test/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: PROMPT }], ...changes }) })
test('nega autenticação, validade, ferramentas, streaming e prompts arbitrários antes de gastar', async () => {
 let count = 0
 const fetcher = (async () => { count++; throw Error('não chamar') }) as typeof fetch
 const handler = createTestBridge(env, fetcher, clock)
 assert.equal((await handler(call({}, 'errada'))).status, 401)
 for (const changes of [{stream:true}, {tools:[]}, {model:'other'}, {messages:[{role:'user',content:'outro'}]}]) assert.equal((await handler(call(changes))).status, 400)
 assert.equal((await createTestBridge({...env,SIX_TEST_BRIDGE_EXPIRES_AT:'2026-11-18T14:00:00Z'},fetcher,clock)(call())).status,503)
 assert.equal(count, 0)
})
test('encaminha somente prompt fixo, reserva tentativa concorrente e retorna tokens sem credenciais', async () => {
 let count = 0
 const handler = createTestBridge(env, (async (url, init) => {
  count++
  assert.equal(url,'https://ai.gateway.lovable.dev/v1/chat/completions')
  assert.equal(init?.redirect,'error')
  const body = JSON.parse(String(init?.body))
  assert.equal(body.max_tokens,16)
  assert.deepEqual(body.messages,[{role:'user',content:PROMPT}])
  return Response.json({model:MODEL,choices:[{message:{content:'OK'}}],usage:{prompt_tokens:16,completion_tokens:4,total_tokens:20}, debug:'fake-project-key'})
 }) as typeof fetch, clock)
 const responses = await Promise.all([handler(call({messages:[{role:'system',content:'injetado pela Six'},{role:'user',content:PROMPT}]})),handler(call())])
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409])
 const text = await responses.find(r=>r.status===200)!.text()
 assert.ok(!text.includes('fake-project-key') && !text.includes(secret))
 assert.equal(JSON.parse(text).usage.total_tokens,20)
 assert.equal(count,1)
})
test('falha upstream não vaza resposta e não permite nova tentativa', async () => {
 const handler=createTestBridge(env,(async()=>new Response('fake-project-key',{status:401})) as typeof fetch,clock)
 const result=await handler(call())
 assert.equal(result.status,502)
 assert.ok(!(await result.text()).includes('fake-project-key'))
 assert.equal((await handler(call())).status,409)
})
test('URL do roteador mantém o prefixo da ponte sem duplicar v1',()=>{
 assert.equal(supplierUrl('https://project.example/api/six-test/v1','/v1/chat/completions'),'https://project.example/api/six-test/v1/chat/completions')
})
