import {test} from 'node:test'
import assert from 'node:assert/strict'
import {localBudgetExhausted,localBridgeFailure} from './local-test-errors.ts'
test('orçamento local encerra com 403, não 429',async()=>{const r=localBudgetExhausted();assert.equal(r.status,403);assert.equal((await r.json()).error.type,'permission_error')})
test('falha da ponte preserva status para diagnóstico sem solicitar retry',async()=>{const r=localBridgeFailure(502);assert.equal(r.status,422);assert.equal(r.headers.get('X-Six-Bridge-Status'),'502');assert.ok((await r.json()).error.message.includes('HTTP 502'));assert.equal(r.headers.get('retry-after'),null)})
