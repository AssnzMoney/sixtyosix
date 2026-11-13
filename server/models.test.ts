import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withPlanModels } from './model-aliases.ts'

/** Modelos do Roteador marcados para o Pro (em produção vêm de loadRouter().proAliases). */
const EXTRAS = ['claude-opus-5-5', 'gpt-6.1-sol', 'argon-4']

test('Pro recebe Argon 4 logo depois do Fable 5.2', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-2', 'gpt-6-astra', 'glm-5']), ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5'])
})

test('Pro recebe os modelos do Roteador no fim, sem repetir o Argon 4', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-2', 'gpt-6-astra', 'glm-5'], EXTRAS), ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5', 'claude-opus-5-5', 'gpt-6.1-sol'])
})

test('assinaturas antigas com o Fable 5.1 passam a ter o Fable 5.2, sem repetir', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-1', 'gpt-6-astra', 'glm-5']), ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5'])
  assert.deepEqual(withPlanModels(['claude-fable-5-1', 'claude-fable-5-2', 'glm-5']), ['claude-fable-5-2', 'argon-4', 'glm-5'])
})

test('planos sem Fable não recebem Argon 4 nem os modelos do Roteador', () => {
  assert.deepEqual(withPlanModels(['gpt-6-astra', 'glm-5'], EXTRAS), ['gpt-6-astra', 'glm-5'])
  assert.deepEqual(withPlanModels([], EXTRAS), [])
})

test('modelos já gravados não são duplicados', () => {
  assert.deepEqual(withPlanModels(['claude-fable-5-2', 'argon-4', 'glm-5']), ['claude-fable-5-2', 'argon-4', 'glm-5'])
  assert.deepEqual(withPlanModels(['gpt-6-astra', 'argon-4']), ['gpt-6-astra', 'argon-4'])
  assert.deepEqual(withPlanModels(['claude-fable-5-2', 'claude-opus-5-5'], EXTRAS), ['claude-fable-5-2', 'argon-4', 'claude-opus-5-5', 'gpt-6.1-sol'])
})
