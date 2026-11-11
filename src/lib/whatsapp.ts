// WhatsApp: normalização de telefone, links wa.me e mensagens prontas.
// Módulo puro, usado pelo site e pelas funções em api/.

/** WhatsApp oficial da SixtySix (vendas, entrega e suporte). */
export const SUPPORT_WHATSAPP = '5581992376036'
export const DASHBOARD_URL = 'https://www.sixtysix.online/dashboard'

/**
 * Normaliza um número brasileiro para 55 + DDD + número (12 ou 13 dígitos).
 * Aceita "(81) 99237-6036", "+55 81 99237-6036", "081992376036" e "0055…".
 * Devolve null quando o número não é válido.
 */
export function normalizeWhatsapp(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  let digits = String(value).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  return /^55[1-9]{2}(9\d{8}|[2-8]\d{7})$/.test(digits) ? digits : null
}

/** "5581992376036" → "+55 (81) 99237-6036". Devolve o valor original se não for válido. */
export function formatWhatsapp(value: unknown): string {
  const digits = normalizeWhatsapp(value)
  if (!digits) return typeof value === 'string' ? value : ''
  const ddd = digits.slice(2, 4)
  const number = digits.slice(4)
  const split = number.length === 9 ? 5 : 4
  return `+55 (${ddd}) ${number.slice(0, split)}-${number.slice(split)}`
}

/** Máscara enquanto digita: "81992376036" → "(81) 99237-6036". */
export function maskWhatsappInput(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  digits = digits.slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  const split = rest.length > 8 ? 5 : 4
  return rest.length <= split ? `(${ddd}) ${rest}` : `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}

/** Link wa.me sempre com só dígitos. Devolve null para número inválido. */
export function whatsappLink(phone: unknown, text?: string): string | null {
  const digits = normalizeWhatsapp(phone)
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** Link para o WhatsApp da SixtySix com mensagem pronta. */
export function supportWhatsappLink(text?: string): string {
  return whatsappLink(SUPPORT_WHATSAPP, text) as string
}

export const shortOrder = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase()

const clean = (value: unknown, max = 80) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Mensagem que o cliente envia logo depois do pagamento aprovado. */
export function purchaseMessage(input: { name?: string; plan?: string; order?: string; email?: string }) {
  const parts = [
    `Olá! ${clean(input.name) ? `Sou ${clean(input.name)}. ` : ''}Acabei de pagar o plano ${clean(input.plan) || 'SixtySix'}`,
    input.order ? ` (pedido ${shortOrder(input.order)})` : '',
    clean(input.email, 120) ? `, e-mail ${clean(input.email, 120)}` : '',
    '. Quero receber minha chave e a URL de configuração.',
  ]
  return parts.join('')
}

/** Mensagem do admin ao chamar um cliente que pagou. */
export function customerGreeting(input: { name?: string; plan?: string }) {
  const name = clean(input.name)
  const plan = clean(input.plan)
  return `Olá${name ? `, ${name}` : ''}! Aqui é da SixtySix. Recebemos seu pagamento${plan ? ` do plano ${plan}` : ''} e vamos enviar por aqui sua chave e a URL de configuração.`
}

/** Mensagem do admin ao entregar uma credencial (a chave é colada à mão, nunca sai do sistema). */
export function deliveryMessage(input: { name?: string; hint: string; url: string }) {
  const name = clean(input.name)
  return [
    `Olá${name ? `, ${name}` : ''}! Segue sua credencial SixtySix:`,
    '',
    `Chave (termina em …${clean(input.hint, 8)}): [cole a chave aqui]`,
    `URL: ${clean(input.url, 200)}`,
    '',
    `Depois de configurar, confirme o recebimento no seu painel: ${DASHBOARD_URL}`,
  ].join('\n')
}

/** Lembrete para o cliente confirmar o recebimento. */
export function confirmationReminder(input: { name?: string; hint: string }) {
  const name = clean(input.name)
  return `Olá${name ? `, ${name}` : ''}! Você recebeu a chave terminada em …${clean(input.hint, 8)}? Confirme o recebimento no seu painel: ${DASHBOARD_URL}`
}
