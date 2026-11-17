import { Client, Events, GatewayIntentBits, type Guild, type GuildMember, type Role } from 'discord.js'

/*
 * Bot da SixtySix no Discord (processo "sixtysix-discord" no PM2; liga só com DISCORD_BOT_TOKEN no .env).
 * Fica online e só cuida dos cargos, sem mandar mensagem nenhuma:
 *  - quem entra no servidor ganha o cargo de membro (DISCORD_MEMBER_ROLE, padrão "Membro");
 *  - bot que entra ganha o cargo de bots (DISCORD_BOT_ROLE, padrão "Bots");
 *  - ao ligar, confere todo mundo e dá o cargo a quem ainda não tem.
 * O cargo do bot precisa estar acima desses cargos na lista do servidor (regra do Discord); se não estiver, ele
 * avisa no log e não dá o cargo.
 */
const env = process.env
const token = env.DISCORD_BOT_TOKEN
if (!token) {
  console.log('DISCORD_BOT_TOKEN não configurado: o bot do Discord fica desligado.')
  process.exit(0)
}
const memberRole = (env.DISCORD_MEMBER_ROLE || 'Membro').trim().toLowerCase()
const botRole = (env.DISCORD_BOT_ROLE || 'Bots').trim().toLowerCase()

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })

const findRole = (guild: Guild, wanted: string): Role | undefined => guild.roles.cache.find((r) => r.id === wanted || r.name.toLowerCase() === wanted)
const warned = new Set<string>()

/** Dá o cargo certo (membro ou bots) a quem ainda não tem. Devolve se deu. */
async function ensureRole(member: GuildMember, reason: string) {
  if (member.id === client.user?.id) return false
  const role = findRole(member.guild, member.user.bot ? botRole : memberRole)
  if (!role || member.roles.cache.has(role.id)) return false
  if (!role.editable) {
    if (!warned.has(role.id)) {
      warned.add(role.id)
      console.error(`discord: não consigo dar o cargo ${role.name}: suba o cargo do bot acima dele em Configurações do servidor > Cargos.`)
    }
    return false
  }
  await member.roles.add(role, reason)
  return true
}

client.on(Events.GuildMemberAdd, (member) => {
  ensureRole(member, 'Entrou no servidor').catch((error) => console.error('discord: erro ao dar cargo', error instanceof Error ? error.message : error))
})

client.once(Events.ClientReady, async (ready) => {
  console.log(`Bot do Discord online como ${ready.user.tag}, em ${ready.guilds.cache.size} servidor(es). Cargos automáticos: ${memberRole} (pessoas) e ${botRole} (bots).`)
  for (const guild of ready.guilds.cache.values()) {
    try {
      const members = await guild.members.fetch()
      let given = 0
      for (const member of members.values()) if (await ensureRole(member, 'Cargo automático')) given++
      console.log(`discord: ${guild.name}: ${members.size} membros conferidos, ${given} receberam cargo agora.`)
    } catch (error) {
      console.error('discord: não consegui conferir os membros', guild.name, error instanceof Error ? error.message : error)
    }
  }
})
client.on(Events.Error, (error) => console.error('discord: erro do cliente', error.message))
process.on('unhandledRejection', (error) => console.error('discord: erro sem tratamento', error instanceof Error ? error.message : error))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void client.destroy().finally(() => process.exit(0)))

await client.login(token)
