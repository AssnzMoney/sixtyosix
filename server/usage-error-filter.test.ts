import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorVisibleSince } from '../src/lib/usage-error-filter.ts'

test('oculta apenas erros anteriores à meia-noite UTC escolhida', () => {
  assert.equal(errorVisibleSince('2026-11-19T23:59:59Z', '2026-11-20'), false)
  assert.equal(errorVisibleSince('2026-11-20T00:00:00Z', '2026-11-20'), true)
  assert.equal(errorVisibleSince('2026-11-21T01:00:00Z', '2026-11-20'), true)
  assert.equal(errorVisibleSince('2026-11-19T22:00:00-03:00', '2026-11-20'), true)
})

test('mostrar todos restaura erros antigos e datas desconhecidas permanecem visíveis', () => {
  assert.equal(errorVisibleSince('2020-01-01T00:00:00Z', ''), true)
  assert.equal(errorVisibleSince(null, '2026-11-20'), true)
  assert.equal(errorVisibleSince('invalid', '2026-11-20'), true)
  assert.equal(errorVisibleSince('2020-01-01', 'invalid'), true)
})