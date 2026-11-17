import { splitMessage } from './agent.ts'
import { WHATSAPP_LINK } from './knowledge.ts'

/**
 * Mensagens do Discord em embed (cartão com faixa de cor, título, campos e botões), no visual da SixtySix.
 * Formato cru da API do Discord: serve tanto para o bot (discord.js aceita) quanto para o setup.ts (REST).
 */
export const COLORS = { brand: 0x9eea6c, warn: 0xf6c77d, danger: 0xef4444, ink: 0x0e3a3b }
export const SITE = 'https://www.sixtysix.online'
export const ICON = `${SITE}/icon-192.png`
export const LINKS = {
  dashboard: `${SITE}/dashboard`,
  plans: `${SITE}/#planos`,
  whatsapp: WHATSAPP_LINK,
  trial: `${WHATSAPP_LINK}?text=${encodeURIComponent('Olá! Quero o teste grátis de 3 horas da SixtySix.')}`,
}

export type EmbedField = { name: string; value: string; inline?: boolean }
export type Embed = {
  title?: string
  description?: string
  color?: number
  fields?: EmbedField[]
  footer?: { text: string; icon_url?: string }
  thumbnail?: { url: string }
  url?: string
}
export type Button = { label: string; url: string }
export type Payload = { content?: string; embeds: Embed[]; components?: { type: 1; components: { type: 2; style: 5; label: string; url: string }[] }[] }

export const footer = (text = 'SixtySix · sixtysix.online') => ({ text, icon_url: ICON })
/** Botões de link (até 5 por linha). */
export const buttons = (list: Button[]) => (list.length ? [{ type: 1 as const, components: list.slice(0, 5).map((b) => ({ type: 2 as const, style: 5 as const, label: b.label.slice(0, 80), url: b.url })) }] : [])

/**
 * Resposta do assistente em embeds: textos longos viram várias mensagens (até 3900 caracteres cada, sem quebrar
 * bloco de código). Quando a equipe foi chamada, a última leva um cartão âmbar e o botão do WhatsApp.
 */
export function replyPayloads(text: string, escalate: boolean): Payload[] {
  const chunks = splitMessage(text || '...', 3900)
  return chunks.map((chunk, i) => {
    const last = i === chunks.length - 1
    const embeds: Embed[] = [{ description: chunk, color: COLORS.brand, ...(last ? { footer: footer('Assistente da SixtySix · resposta automática') } : {}) }]
    if (last && escalate) embeds.push({ title: 'Equipe avisada', description: 'A equipe da SixtySix já foi chamada e continua o atendimento aqui neste tópico.', color: COLORS.warn })
    return { embeds, components: last && escalate ? buttons([{ label: 'Falar no WhatsApp', url: LINKS.whatsapp }]) : [] }
  })
}

/** Aviso de chave apagada (some sozinho depois de um minuto). */
export const keyWarning = (userId: string): Payload => ({
  content: `<@${userId}>`,
  embeds: [{
    title: 'Mensagem apagada: tinha uma chave',
    description: 'Nunca cole a sua chave da SixtySix no Discord. Para garantir, gere uma nova no painel, em **Chaves de API → Gerar nova**. A antiga para de funcionar na hora.',
    color: COLORS.danger,
    footer: footer(),
  }],
  components: buttons([{ label: 'Abrir o painel', url: LINKS.dashboard }]),
})

/** Pedido de calma para quem mandou muitas perguntas seguidas. */
export const slowDown = (): Payload => ({
  embeds: [{ description: 'Muitas perguntas seguidas. Espere uns minutos e mande de novo. Se for urgente, chame a equipe no WhatsApp.', color: COLORS.warn }],
  components: buttons([{ label: 'Falar no WhatsApp', url: LINKS.whatsapp }]),
})

/** O assistente não conseguiu responder. */
export const failure = (): Payload => ({
  embeds: [{ title: 'Não consegui responder agora', description: 'A equipe da SixtySix já foi avisada e vai ver a sua mensagem. Se for urgente, chame no WhatsApp.', color: COLORS.warn, footer: footer() }],
  components: buttons([{ label: 'Falar no WhatsApp', url: LINKS.whatsapp }]),
})

/** Aviso para a equipe no canal privado de registro (a marcação dos cargos vai no texto, que é o que notifica). */
export const staffAlert = (roles: string[], reason: string, who: string, url: string, question: string): Payload => ({
  content: roles.map((id) => `<@&${id}>`).join(' ') || undefined,
  embeds: [{
    title: reason,
    color: COLORS.warn,
    fields: [
      { name: 'Quem', value: who.slice(0, 200), inline: true },
      { name: 'Conversa', value: `[Abrir tópico](${url})`, inline: true },
      { name: 'Última mensagem', value: (question || '(sem texto)').slice(0, 1000) },
    ],
    footer: footer('Assistente da SixtySix'),
  }],
  components: buttons([{ label: 'Abrir a conversa', url }]),
})
