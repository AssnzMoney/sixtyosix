import { ChannelType, Client, Events, GatewayIntentBits, PermissionFlagsBits, type GuildMember, type Message, type Role } from 'discord.js'
import { createAgent, hasKey, RateLimiter, type Turn } from './agent.ts'
import { failure, keyWarning, replyPayloads, slowDown, staffAlert } from './embeds.ts'

/*
 * Agente de suporte da SixtySix no Discord (processo "sixtysix-discord" no PM2; liga só com DISCORD_BOT_TOKEN no .env).
 *  - Pergunta no canal #suporte vira um tópico (thread) só daquela pessoa, e o agente responde lá dentro.
 *  - Alguém da equipe escreveu no tópico: o agente para de responder nele (a pessoa assumiu). Citar o bot volta.
 *  - Em outros canais, responde quando alguém cita o bot.
 *  - Chave da SixtySix colada em qualquer canal: apaga a mensagem e avisa para gerar uma nova.
 *  - Precisou da equipe: avisa no canal privado de registro (DISCORD_LOG_CHANNEL) com o link do tópico, marcando os
 *    cargos da equipe lá dentro, sem marcar ninguém no canal público.
 * Configuração opcional: DISCORD_SUPPORT_CHANNEL (nome ou id, padrão "suporte"), DISCORD_STAFF_ROLE (nomes ou ids
 * separados por vírgula, padrão "Equipe"), DISCORD_LOG_CHANNEL (nome ou id, opcional), DISCORD_AGENT_MODEL.
 */
const env = process.env
const token = env.DISCORD_BOT_TOKEN
if (!token) {
  console.log('DISCORD_BOT_TOKEN não configurado: o agente do Discord fica desligado.')
  process.exit(0)
}
const supportName = (env.DISCORD_SUPPORT_CHANNEL || 'suporte').toLowerCase()
const staffNames = (env.DISCORD_STAFF_ROLE || 'Equipe').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
const logName = (env.DISCORD_LOG_CHANNEL || '').toLowerCase()
const agent = createAgent(env)
const limiter = new RateLimiter(8, 10 * 60_000)
/** Tópicos em que a equipe já está atendendo: o agente não se mete. */
const humanThreads = new Set<string>()

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

const isSupport = (channel: Message['channel']) => channel.type === ChannelType.GuildText && (channel.id === supportName || channel.name.toLowerCase() === supportName)
const isSupportThread = (channel: Message['channel']) =>
  channel.isThread() && channel.ownerId === client.user?.id && !!channel.parent && (channel.parent.id === supportName || channel.parent.name.toLowerCase() === supportName)
const staffRoles = (message: Message): Role[] =>
  message.guild ? [...message.guild.roles.cache.values()].filter((r) => staffNames.includes(r.id) || staffNames.includes(r.name.toLowerCase())) : []
const isStaff = (member: GuildMember | null, roles: Role[]) => !!member && (member.permissions.has(PermissionFlagsBits.Administrator) || roles.some((r) => member.roles.cache.has(r.id)))
const logChannel = (message: Message) =>
  logName ? message.guild?.channels.cache.find((c) => (c.id === logName || c.name.toLowerCase() === logName) && c.isSendable()) : undefined

/** Avisa a equipe no canal privado de registro, com o link da conversa. Devolve se conseguiu avisar. */
async function notifyStaff(message: Message, target: Message['channel'], reason: string) {
  const log = logChannel(message)
  if (!log || !log.isSendable()) return false
  const roles = staffRoles(message)
  const question = describe(message).replace(/\s+/g, ' ').slice(0, 1000)
  const url = 'url' in target && typeof target.url === 'string' ? target.url : message.url
  await log.send({
    ...staffAlert(roles.map((r) => r.id), reason, nameOf(message), url, question),
    allowedMentions: { parse: [], roles: roles.map((r) => r.id) },
  }).catch((error) => console.error('discord: não consegui avisar a equipe', error instanceof Error ? error.message : error))
  return true
}
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
    if (m.author.id === client.user?.id) {
      const said = m.embeds.filter((e) => e.title !== 'Equipe avisada').map((e) => e.description || '').filter(Boolean).join('\n') || m.content
      if (said) turns.push({ role: 'assistant', content: said })
    } else turns.push({ role: 'user', name: nameOf(m), content: describe(m) })
  }
  return turns
}

async function answer(message: Message, target: Message['channel'], inThread: boolean) {
  if (!target.isSendable()) return
  const roles = staffRoles(message)
  const hasLog = !!logChannel(message)
  // Com canal de registro, a equipe é avisada lá; sem ele, os cargos são marcados na própria conversa.
  const mentionRoles = !hasLog ? roles.map((r) => r.id) : []
  const mentionText = mentionRoles.map((id) => `<@&${id}>`).join(' ') || undefined
  if (!limiter.allow(message.author.id)) {
    await target.send({ ...slowDown(), allowedMentions: { parse: [] } })
    return
  }
  await target.sendTyping().catch(() => undefined)
  const typing = setInterval(() => target.sendTyping().catch(() => undefined), 8000)
  try {
    const reply = await agent.ask(await history(message, inThread))
    if (reply.escalate) await notifyStaff(message, target, 'Uma dúvida no suporte precisa de vocês')
    const payloads = replyPayloads(reply.text, reply.escalate)
    for (const [i, payload] of payloads.entries()) {
      const last = i === payloads.length - 1
      await target.send({ ...payload, content: last && reply.escalate ? mentionText : undefined, allowedMentions: { parse: [], roles: last && reply.escalate ? mentionRoles : [] } })
    }
  } catch (error) {
    console.error('discord: não consegui responder', error instanceof Error ? error.message : error)
    await notifyStaff(message, target, 'O assistente não conseguiu responder esta dúvida')
    await target.send({ ...failure(), content: mentionText, allowedMentions: { parse: [], roles: mentionRoles } })
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
        const warn = await message.channel.send({ ...keyWarning(message.author.id), allowedMentions: { users: [message.author.id] } })
        setTimeout(() => void warn.delete().catch(() => undefined), 60_000)
      }
      return
    }
    const mentioned = message.mentions.users.has(client.user.id)
    const roles = staffRoles(message)
    if (isSupport(message.channel)) {
      if (isStaff(message.member, roles)) return
      const thread = await message.startThread({ name: `Dúvida de ${nameOf(message)}`.slice(0, 90), autoArchiveDuration: 1440 })
      await answer(message, thread, true)
      return
    }
    if (isSupportThread(message.channel)) {
      if (isStaff(message.member, roles)) {
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
  console.log(`Agente do Discord no ar como ${ready.user.tag}, em ${ready.guilds.cache.size} servidor(es). Suporte: #${supportName}. Equipe: ${staffNames.join(', ')}. Registro: ${logName ? `#${logName}` : '(nenhum)'}.`)
})
client.on(Events.Error, (error) => console.error('discord: erro do cliente', error.message))
process.on('unhandledRejection', (error) => console.error('discord: erro sem tratamento', error instanceof Error ? error.message : error))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void client.destroy().finally(() => process.exit(0)))

await client.login(token)
