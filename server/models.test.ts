import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withPlanModels } from './model-aliases.ts'

test('Pro recebe Argon 4 logo depois do Fable 5.1', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-1', 'gpt-6-astra', 'glm-5']), ['claude-fable-5-1', 'argon-4', 'gpt-6-astra', 'glm-5'])
})

test('Fable 5.2 some até de assinaturas antigas', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-1', 'claude-fable-5-2', 'gpt-6-astra', 'glm-5']), ['claude-fable-5-1', 'argon-4', 'gpt-6-astra', 'glm-5'])
  assert.deepEqual(withPlanModels(['claude-fable-5-2', 'glm-5']), ['claude-fable-5-1', 'argon-4', 'glm-5'])
})

test('planos sem Fable não recebem Argon 4', () => {
  assert.deepEqual(withPlanModels(['gpt-6-astra', 'glm-5']), ['gpt-6-astra', 'glm-5'])
  assert.deepEqual(withPlanModels([]), [])
})

test('Argon 4 já gravado não é duplicado', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-1', 'argon-4', 'glm-5']), ['claude-fable-5-1', 'argon-4', 'glm-5'])
  assert.deepEqual(withPlanModels(['gpt-6-astra', 'argon-4']), ['gpt-6-astra', 'argon-4'])
})
