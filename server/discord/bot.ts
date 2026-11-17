import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits, type GuildMember, type Message, type Role } from 'discord.js'
import { createAgent, hasKey, RateLimiter, splitMessage, type Turn } from './agent.ts'
import { WHATSAPP_LINK } from './knowledge.ts'

/*
 * Agente de suporte da SixtySix no Discord (processo "sixtysix-discord" no PM2; liga só com DISCORD_BOT_TOKEN no .env).
 *  - Pergunta no canal #suporte vira um tópico (thread) só daquela pessoa, e o agente responde lá dentro.
 *  - Alguém da equipe escreveu no tópico: o agente para de responder nele (a pessoa assumiu). Citar o bot volta.
 *  - Em outros canais, responde quando alguém cita o bot.
 *  - Chave da SixtySix colada em qualquer canal: apaga a mensagem e avisa para gerar uma nova.
 * Configuração opcional: DISCORD_SUPPORT_CHANNEL (nome ou id, padrão "suporte"), DISCORD_STAFF_ROLE (nome ou id,
 * padrão "Equipe"), DISCORD_AGENT_MODEL (padrão claude-opus-5-5).
 */
const env = process.env
const token = env.DISCORD_BOT_TOKEN
if (!token) {
  console.log('DISCORD_BOT_TOKEN não configurado: o agente do Discord fica desligado.')
  process.exit(0)
}
const supportName = (env.DISCORD_SUPPORT_CHANNEL || 'suporte').toLowerCase()
const staffName = (env.DISCORD_STAFF_ROLE || 'Equipe').toLowerCase()
const agent = createAgent(env)
const limiter = new RateLimiter(8, 10 * 60_000)
/** Tópicos em que a equipe já está atendendo: o agente não se mete. */
const humanThreads = new Set<string>()

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

const isSupport = (channel: Message['channel']) => channel.type === ChannelType.GuildText && (channel.id === supportName || channel.name.toLowerCase() === supportName)
const isSupportThread = (channel: Message['channel']) =>
  channel.isThread() && channel.ownerId === client.user?.id && !!channel.parent && (channel.parent.id === supportName || channel.parent.name.toLowerCase() === supportName)
const staffRole = (message: Message): Role | undefined =>
  message.guild?.roles.cache.find((r) => r.id === staffName || r.name.toLowerCase() === staffName)
const isStaff = (member: GuildMember | null, role?: Role) => !!member && (member.permissions.has(PermissionFlagsBits.Administrator) || (!!role && member.roles.cache.has(role.id)))
const nameOf = (message: Message) => message.member?.displayName || message.author.globalName || message.author.username
const strip = (text: string) => text.replace(new RegExp(`<@!?${client.user?.id}>`, 'g'), '').trim()
const describe = (message: Message) => {
  const files = [...message.attachments.values()].map((a) => `[anexo: ${a.name}]`).join(' ')
  return [strip(message.content), files].filter(Boolean).join('\n')
}

/** Conversa do tópico para o modelo: a pergunta que abriu o tópico e as mensagens seguintes (até 25). */
async function history(message: Message, inThread: boolean): Promise<Turn[]> {
  if (!inThread || !message.channel.isThread()) return [{ role: 'user', name: nameOf(message), content: describe(message) }]
  const thread = message.channel
  const turns: Turn[] = []
  const starter = await thread.fetchStarterMessage().catch(() => null)
  if (starter) turns.push({ role: 'user', name: nameOf(starter), content: describe(starter) })
  const recent = await thread.messages.fetch({ limit: 25 })
  for (const m of [...recent.values()].reverse()) {
    if (m.system) continue
    turns.push(m.author.id === client.user?.id ? { role: 'assistant', content: m.content } : { role: 'user', name: nameOf(m), content: describe(m) })
  }
  return turns
}

async function answer(message: Message, target: Message['channel'], inThread: boolean) {
  if (!target.isSendable()) return
  const role = staffRole(message)
  const staffMention = role ? `<@&${role.id}>` : 'a equipe'
  if (!limiter.allow(message.author.id)) {
    await target.send({ content: `Muitas perguntas seguidas. Espere uns minutos ou chame ${staffMention}.`, allowedMentions: { parse: [] } })
    return
  }
  await target.sendTyping().catch(() => undefined)
  const typing = setInterval(() => target.sendTyping().catch(() => undefined), 8000)
  try {
    const reply = await agent.ask(await history(message, inThread))
    let text = reply.text
    if (reply.escalate) text += `\n\n${staffMention} vai te ajudar por aqui. Se preferir, chame no WhatsApp: ${WHATSAPP_LINK}`
    for (const chunk of splitMessage(text)) await target.send({ content: chunk, allowedMentions: { parse: [], roles: reply.escalate && role ? [role.id] : [] } })
  } catch (error) {
    console.error('discord: não consegui responder', error instanceof Error ? error.message : error)
    await target.send({ content: `Não consegui responder agora. ${staffMention} vai ver sua mensagem; se for urgente, chame no WhatsApp: ${WHATSAPP_LINK}`, allowedMentions: { parse: [], roles: role ? [role.id] : [] } })
  } finally {
    clearInterval(typing)
  }
}

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot || !client.user) return
    // Chave colada no chat: apaga e avisa (o aviso some sozinho depois de 1 minuto).
    if (message.inGuild() && hasKey(message.content)) {
      await message.delete().catch(() => undefined)
      if (message.channel.isSendable()) {
        const warn = await message.channel.send({
          content: `<@${message.author.id}>, apaguei sua mensagem porque tinha uma chave da SixtySix. Nunca cole a chave aqui. Para garantir, gere uma nova no painel: https://www.sixtysix.online/dashboard (Chaves de API, Gerar nova).`,
          allowedMentions: { users: [message.author.id] },
        })
        setTimeout(() => void warn.delete().catch(() => undefined), 60_000)
      }
      return
    }
    const mentioned = message.mentions.users.has(client.user.id)
    const role = staffRole(message)
    if (isSupport(message.channel)) {
      if (isStaff(message.member, role)) return
      const thread = await message.startThread({ name: `Dúvida de ${nameOf(message)}`.slice(0, 90), autoArchiveDuration: 1440 })
      await answer(message, thread, true)
      return
    }
    if (isSupportThread(message.channel)) {
      if (isStaff(message.member, role)) {
        humanThreads.add(message.channel.id)
        return
      }
      if (humanThreads.has(message.channel.id) && !mentioned) return
      await answer(message, message.channel, true)
      return
    }
    if (mentioned) await answer(message, message.channel, false)
  } catch (error) {
    console.error('discord: erro ao tratar mensagem', error instanceof Error ? error.message : error)
  }
})

client.once(Events.ClientReady, (ready) => {
  console.log(`Agente do Discord no ar como ${ready.user.tag}, em ${ready.guilds.cache.size} servidor(es). Canal de suporte: #${supportName}.`)
})
client.on(Events.Error, (error) => console.error('discord: erro do cliente', error.message))
process.on('unhandledRejection', (error) => console.error('discord: erro sem tratamento', error instanceof Error ? error.message : error))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void client.destroy().finally(() => process.exit(0)))

await client.login(token)
