// Credenciais entregues pelo WhatsApp: validação e estado.
// O segredo da chave nunca entra no sistema — só os últimos caracteres (key_hint).

export const DELIVERY_PRODUCTS = ['claude', 'gpt', 'glm', 'outro'] as const
export type DeliveryProduct = (typeof DELIVERY_PRODUCTS)[number]
export const PRODUCT_LABELS: Record<DeliveryProduct, string> = {
  claude: 'Claude',
  gpt: 'GPT',
  glm: 'GLM',
  outro: 'Outro',
}

/** Nomes dos modelos vendidos, para exibir a credencial pelo modelo em vez do produto. */
export const MODEL_NAMES: Record<string, string> = {
  'claude-fable-5-2': 'Fable 5.2',
  'claude-fable-5-1': 'Fable 5.1',
  'argon-4': 'Argon 4',
  'gpt-6-astra': 'Astra 6',
  'glm-5': 'GLM 5',
}

/** Produto gravado no banco, deduzido do modelo (o admin não escolhe mais). */
export function productForModel(model: string | null | undefined): DeliveryProduct {
  const id = (model || '').trim().toLowerCase()
  if (id.startsWith('claude')) return 'claude'
  if (id.startsWith('gpt')) return 'gpt'
  if (id.startsWith('glm')) return 'glm'
  return 'outro'
}

/** Título da credencial: nome do modelo, ou o produto, ou um nome genérico. */
export function credentialTitle(row: { product?: string | null; model_id?: string | null }) {
  if (row.model_id && MODEL_NAMES[row.model_id]) return MODEL_NAMES[row.model_id]
  if (row.product && row.product !== 'outro' && PRODUCT_LABELS[row.product as DeliveryProduct]) return PRODUCT_LABELS[row.product as DeliveryProduct]
  return row.model_id || 'Credencial SixtySix'
}

/** Fornecedor é opcional no painel; o banco exige um texto, então vazio vira este. */
export const SUPPLIER_UNKNOWN = 'Não informado'

/** Versão do texto que o cliente aceita ao confirmar. Mude ao alterar a frase. */
export const CONFIRMATION_TEXT_VERSION = 'v1-2026-11-11'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const KEY_HINT = /^[A-Za-z0-9_-]{2,8}$/
const MODEL_ID = /^[A-Za-z0-9._:/-]{1,80}$/
// Sequência longa misturando letras e números: formato típico de chave de API.
export const LOOKS_LIKE_SECRET = /(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}/
const CONTROL = /[\u0000-\u001f\u007f]/

export type DeliveryInput = {
  id: string
  user_id: string
  subscription_id: string | null
  product: DeliveryProduct
  supplier: string
  key_hint: string
  base_url: string
  model_id: string | null
  notes: string | null
  expires_at: string | null
  replaces: string | null
}

export type DeliveryRow = {
  id: string
  user_id?: string
  product: string
  key_hint: string
  base_url: string
  model_id: string | null
  delivered_at: string
  expires_at: string | null
  replaced_at: string | null
  revoked_at: string | null
  confirmed_at: string | null
}

export type DeliveryState = 'pending' | 'confirmed' | 'expired' | 'replaced' | 'revoked'

export const STATE_LABELS: Record<DeliveryState, string> = {
  pending: 'Aguardando confirmação',
  confirmed: 'Confirmada',
  expired: 'Vencida',
  replaced: 'Substituída',
  revoked: 'Revogada',
}

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

/** URL base: só https, sem query, fragmento ou credenciais; até 200 caracteres. */
export function validBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text || text.length > 200 || /[?#@\s]/.test(text) || !text.startsWith('https://')) return null
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) return null
  } catch {
    return null
  }
  return text.replace(/\/+$/, '')
}

/** Normaliza o final da chave. Recusa qualquer coisa maior que 8 caracteres (seria o segredo). */
export function validKeyHint(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/^…+|^\.+/, '')
  return KEY_HINT.test(text) ? text : null
}

/** Valida tudo que o admin envia ao registrar uma entrega. Lança Error com a mensagem para o usuário. */
export function validateDeliveryInput(input: Record<string, unknown>): DeliveryInput {
  const fail = (message: string): never => {
    throw new Error(message)
  }
  if (!isUuid(input.id)) fail('Identificador da entrega inválido. Recarregue o painel.')
  if (!isUuid(input.user_id)) fail('Cliente inválido.')
  const subscription = input.subscription_id == null || input.subscription_id === '' ? null : input.subscription_id
  if (subscription !== null && !isUuid(subscription)) fail('Assinatura inválida.')
  const replaces = input.replaces == null || input.replaces === '' ? null : input.replaces
  if (replaces !== null && !isUuid(replaces)) fail('Credencial a substituir inválida.')
  // Sem produto, ele é deduzido do modelo.
  const product =
    input.product == null || input.product === '' ? productForModel(typeof input.model_id === 'string' ? input.model_id : '') : input.product
  if (!DELIVERY_PRODUCTS.includes(product as DeliveryProduct)) fail('Escolha o produto da chave.')

  const supplier = (typeof input.supplier === 'string' ? input.supplier.trim().replace(/\s+/g, ' ') : '') || SUPPLIER_UNKNOWN
  if (supplier.length > 60 || CONTROL.test(supplier)) fail('O fornecedor pode ter até 60 caracteres.')
  if (LOOKS_LIKE_SECRET.test(supplier)) fail('O campo fornecedor parece conter uma chave. Use só o nome do fornecedor.')

  const keyHint = validKeyHint(input.key_hint)
  if (!keyHint) {
    fail(
      typeof input.key_hint === 'string' && input.key_hint.trim().length > 8
        ? 'Cole só os últimos caracteres da chave (até 8). A chave inteira não deve ser salva no painel.'
        : 'Informe o final da chave com 2 a 8 caracteres.',
    )
  }

  const baseUrl = validBaseUrl(input.base_url)
  if (!baseUrl) fail('Informe a URL base com https://, sem parâmetros, até 200 caracteres.')

  const modelRaw = typeof input.model_id === 'string' ? input.model_id.trim() : ''
  if (modelRaw && !MODEL_ID.test(modelRaw)) fail('ID do modelo inválido.')

  const notesRaw = typeof input.notes === 'string' ? input.notes.trim() : ''
  if (notesRaw.length > 500) fail('A observação pode ter até 500 caracteres.')
  if (LOOKS_LIKE_SECRET.test(notesRaw)) fail('A observação parece conter uma chave. Não salve segredos no painel.')

  let expires: string | null = null
  if (input.expires_at != null && input.expires_at !== '') {
    // Só a data (AAAA-MM-DD) vale até o fim desse dia no horário de Brasília.
    const raw = typeof input.expires_at === 'string' ? input.expires_at.trim() : ''
    const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59-03:00` : raw)
    if (!Number.isFinite(time)) fail('Data de validade inválida.')
    expires = new Date(time).toISOString()
  }

  return {
    id: input.id as string,
    user_id: input.user_id as string,
    subscription_id: subscription as string | null,
    product: product as DeliveryProduct,
    supplier,
    key_hint: keyHint as string,
    base_url: baseUrl as string,
    model_id: modelRaw || null,
    notes: notesRaw || null,
    expires_at: expires,
    replaces: replaces as string | null,
  }
}

/** Estado calculado a partir das datas (não há coluna de status). */
export function deliveryState(row: Pick<DeliveryRow, 'revoked_at' | 'replaced_at' | 'expires_at' | 'confirmed_at'>, now = Date.now()): DeliveryState {
  if (row.revoked_at) return 'revoked'
  if (row.replaced_at) return 'replaced'
  if (row.expires_at && Date.parse(row.expires_at) <= now) return 'expired'
  return row.confirmed_at ? 'confirmed' : 'pending'
}

/** Ativa = ainda em uso pelo cliente (não revogada, não substituída, não vencida). */
export const isActiveDelivery = (row: Parameters<typeof deliveryState>[0], now = Date.now()) =>
  ['pending', 'confirmed'].includes(deliveryState(row, now))

/** Frase exata que o cliente aceita ao confirmar. */
export function deliveryConfirmationText(hint: string, url: string) {
  return `Confirmo que recebi pelo WhatsApp a chave terminada em …${hint} e a URL ${url}.`
}
