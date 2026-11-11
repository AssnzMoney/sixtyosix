import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeWhatsapp,
  formatWhatsapp,
  maskWhatsappInput,
  whatsappLink,
  supportWhatsappLink,
  purchaseMessage,
  deliveryMessage,
  shortOrder,
} from '../src/lib/whatsapp.ts'
import {
  validateDeliveryInput,
  validKeyHint,
  validBaseUrl,
  deliveryState,
  isActiveDelivery,
  deliveryConfirmationText,
  credentialTitle,
  productForModel,
} from '../src/lib/deliveries.ts'

test('normaliza números brasileiros em vários formatos', () => {
  for (const value of ['(81) 99237-6036', '+55 81 99237-6036', '5581992376036', '081992376036', '0055 81 99237-6036', '81992376036']) {
    assert.equal(normalizeWhatsapp(value), '5581992376036', value)
  }
  assert.equal(normalizeWhatsapp('(81) 3333-4444'), '558133334444')
  assert.equal(normalizeWhatsapp('55 99999-9999'), '5555999999999', 'DDD 55 sem DDI')
})

test('recusa números inválidos', () => {
  for (const value of ['', '123', '(01) 99237-6036', '(81) 09237-6036', '(81) 1234-5678', '558199237', 'abc', null, undefined, {}]) {
    assert.equal(normalizeWhatsapp(value), null, String(value))
  }
})

test('formata, mascara e monta links só com dígitos', () => {
  assert.equal(formatWhatsapp('5581992376036'), '+55 (81) 99237-6036')
  assert.equal(formatWhatsapp('558133334444'), '+55 (81) 3333-4444')
  assert.equal(maskWhatsappInput('81992376036'), '(81) 99237-6036')
  assert.equal(maskWhatsappInput('8199'), '(81) 99')
  assert.equal(maskWhatsappInput('5581992376036'), '(81) 99237-6036')
  assert.equal(whatsappLink('(81) 99237-6036', 'Olá & tudo?'), 'https://wa.me/5581992376036?text=Ol%C3%A1%20%26%20tudo%3F')
  assert.equal(whatsappLink('javascript:alert(1)'), null)
  assert.equal(whatsappLink('5581992376036"><script>'), 'https://wa.me/5581992376036', 'sanitiza para só dígitos')
  assert.ok(supportWhatsappLink('oi').startsWith('https://wa.me/5581992376036?text='))
})

test('mensagens prontas não quebram com dados estranhos', () => {
  const text = purchaseMessage({ name: 'Ana\nSilva', plan: 'Pro', order: 'a1b2c3d4-0000-4000-8000-000000000000', email: 'ana@exemplo.com' })
  assert.ok(text.includes('Sou Ana Silva'))
  assert.ok(text.includes('pedido A1B2C3D4'))
  assert.ok(!text.includes('\n'))
  assert.equal(shortOrder('a1b2c3d4-0000-4000-8000-000000000000'), 'A1B2C3D4')
  const delivery = deliveryMessage({ name: 'Ana', hint: '9f3a', url: 'https://api.fornecedor.com' })
  assert.ok(delivery.includes('[cole a chave aqui]'))
  assert.ok(delivery.includes('…9f3a'))
})

const valid = {
  id: '2b1f3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  user_id: '11111111-2222-4333-8444-555555555555',
  product: 'claude',
  supplier: 'Fornecedor A',
  key_hint: '…9f3a',
  base_url: 'https://api.fornecedor.com/',
  model_id: 'claude-fable-5-1',
  notes: 'Rotação mensal',
  expires_at: '2026-12-11',
}

test('aceita uma entrega válida e normaliza campos', () => {
  const out = validateDeliveryInput(valid)
  assert.equal(out.key_hint, '9f3a')
  assert.equal(out.base_url, 'https://api.fornecedor.com')
  assert.equal(out.subscription_id, null)
  assert.equal(out.replaces, null)
  assert.equal(out.expires_at, '2026-12-12T02:59:59.000Z', 'fim do dia 11/12 em Brasília')
})

test('nunca aceita o segredo da chave em nenhum campo', () => {
  const secret = 'sk-ant-api03-AbCdEf0123456789XyZ'
  assert.throws(() => validateDeliveryInput({ ...valid, key_hint: secret }), /últimos caracteres/)
  assert.throws(() => validateDeliveryInput({ ...valid, notes: `chave ${secret}` }), /parece conter uma chave/)
  assert.throws(() => validateDeliveryInput({ ...valid, supplier: secret }), /parece conter uma chave/)
  assert.equal(validKeyHint('123456789'), null)
  assert.equal(validKeyHint('ab'), 'ab')
  assert.doesNotThrow(() => validateDeliveryInput({ ...valid, supplier: 'FornecedorComNomeBemComprido' }))
})

test('URL base só https, sem parâmetros nem credenciais', () => {
  assert.equal(validBaseUrl('http://api.fornecedor.com'), null)
  assert.equal(validBaseUrl('https://api.fornecedor.com/v1?key=abc'), null)
  assert.equal(validBaseUrl('https://user:pass@api.fornecedor.com'), null)
  assert.equal(validBaseUrl('https://api.fornecedor.com/v1#x'), null)
  assert.equal(validBaseUrl('https://localhost'), null)
  assert.equal(validBaseUrl('https://api.fornecedor.com/v1/'), 'https://api.fornecedor.com/v1')
  assert.throws(() => validateDeliveryInput({ ...valid, base_url: 'ftp://x.com' }), /URL base/)
})

test('valida ids, produto e datas', () => {
  assert.throws(() => validateDeliveryInput({ ...valid, id: 'x' }), /Identificador/)
  assert.throws(() => validateDeliveryInput({ ...valid, user_id: '1' }), /Cliente/)
  assert.throws(() => validateDeliveryInput({ ...valid, product: 'outra-coisa' }), /produto/)
  assert.throws(() => validateDeliveryInput({ ...valid, expires_at: 'amanhã' }), /validade/)
  assert.throws(() => validateDeliveryInput({ ...valid, replaces: 'nao-e-uuid' }), /substituir/)
})

test('estado calculado pelas datas', () => {
  const base = { revoked_at: null, replaced_at: null, expires_at: null, confirmed_at: null }
  const now = Date.parse('2026-11-11T12:00:00Z')
  assert.equal(deliveryState(base, now), 'pending')
  assert.equal(deliveryState({ ...base, confirmed_at: '2026-11-10T00:00:00Z' }, now), 'confirmed')
  assert.equal(deliveryState({ ...base, expires_at: '2026-11-11T11:00:00Z' }, now), 'expired')
  assert.equal(deliveryState({ ...base, replaced_at: '2026-11-11T00:00:00Z', confirmed_at: 'x' }, now), 'replaced')
  assert.equal(deliveryState({ ...base, revoked_at: '2026-11-11T00:00:00Z', replaced_at: 'x' }, now), 'revoked')
  assert.equal(isActiveDelivery({ ...base, confirmed_at: 'x' }, now), true)
  assert.equal(isActiveDelivery({ ...base, revoked_at: 'x' }, now), false)
  assert.equal(deliveryConfirmationText('9f3a', 'https://api.x.com'), 'Confirmo que recebi pelo WhatsApp a chave terminada em …9f3a e a URL https://api.x.com.')
})

test('fornecedor vazio vira "Não informado" e o produto sai do modelo', () => {
  const out = validateDeliveryInput({ ...valid, supplier: '', product: undefined, model_id: 'argon-4' })
  assert.equal(out.supplier, 'Não informado')
  assert.equal(out.product, 'outro')
  assert.equal(validateDeliveryInput({ ...valid, product: '', model_id: 'claude-fable-5-1' }).product, 'claude')
  assert.equal(validateDeliveryInput({ ...valid, product: undefined, model_id: '' }).product, 'outro')
})

test('título da credencial usa o nome do modelo', () => {
  assert.equal(credentialTitle({ product: 'outro', model_id: 'argon-4' }), 'Argon 4')
  assert.equal(credentialTitle({ product: 'claude', model_id: null }), 'Claude')
  assert.equal(credentialTitle({ product: 'outro', model_id: null }), 'Credencial SixtySix')
  assert.equal(productForModel('GPT-6-astra'), 'gpt')
})
