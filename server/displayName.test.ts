import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDisplayName, savedDisplayName } from '../src/lib/displayName.ts'

test('provider name and an old local onboarding flag do not replace an explicit name choice', () => {
  assert.equal(savedDisplayName({ display_name: 'discord#123', name: 'Google Name', has_completed_onboarding: true }), '')
  assert.equal(savedDisplayName({ custom_name: 'Capitão João', display_name: 'discord#123' }), 'Capitão João')
})
test('keeps the entire chosen name and validates blank or excessive names', () => {
  assert.equal(normalizeDisplayName('  Capitão   João  '), 'Capitão João')
  assert.throws(() => normalizeDisplayName('   '))
  assert.throws(() => normalizeDisplayName('a'.repeat(31)))
  assert.equal(savedDisplayName({ custom_name: 'a'.repeat(31) }), '')
})
