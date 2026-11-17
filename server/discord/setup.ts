import { ChannelType, PermissionFlagsBits, REST, Routes } from 'discord.js'

/*
 * Consultas ao servidor da SixtySix no Discord pelo bot (precisa do DISCORD_BOT_TOKEN no .env):
 *   node --env-file=.env --experimental-strip-types server/discord/setup.ts listar    canais, cargos e a ordem dos cargos
 *   node ... server/discord/setup.ts convite   convite que não vence (o do rodapé do site)
 * Não muda canal nem manda mensagem.
 */
type Channel = { id: string; name: string; type: number; parent_id: string | null; position: number; topic?: string | null; permission_overwrites?: { id: string; type: number; allow: string; deny: string }[] }
type Role = { id: string; name: string; permissions: string; position: number; managed: boolean; tags?: { bot_id?: string } }

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('Falta DISCORD_BOT_TOKEN no .env.')
  process.exit(1)
}
const rest = new REST({ version: '10' }).setToken(token)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const TYPES: Record<number, string> = { 0: 'texto', 2: 'voz', 4: 'categoria', 5: 'anúncios', 13: 'palco', 15: 'fórum', 16: 'mídia' }

async function guild() {
  const guilds = (await rest.get(Routes.userGuilds())) as { id: string; name: string }[]
  if (!guilds.length) throw new Error('O bot ainda não está em nenhum servidor.')
  const wanted = process.env.DISCORD_GUILD_ID
  const g = wanted ? guilds.find((x) => x.id === wanted) : guilds.length === 1 ? guilds[0] : guilds.find((x) => norm(x.name) === 'sixtysix')
  if (!g) throw new Error(`O bot está em vários servidores (${guilds.map((x) => x.name).join(', ')}). Defina DISCORD_GUILD_ID.`)
  return g
}

async function listar() {
  const g = await guild()
  const [channels, roles, me] = await Promise.all([
    rest.get(Routes.guildChannels(g.id)) as Promise<Channel[]>,
    rest.get(Routes.guildRoles(g.id)) as Promise<Role[]>,
    rest.get(Routes.user('@me')) as Promise<{ id: string }>,
  ])
  console.log(`Servidor: ${g.name} (${g.id})\n`)
  const flags = (c: Channel) => {
    const o = c.permission_overwrites?.find((x) => x.id === g.id)
    if (o && BigInt(o.deny) & PermissionFlagsBits.ViewChannel) return ' (privado)'
    if (o && BigInt(o.deny) & PermissionFlagsBits.SendMessages) return ' (só leitura)'
    return ''
  }
  const sorted = [...channels].sort((a, b) => a.position - b.position)
  for (const c of sorted.filter((x) => !x.parent_id && x.type !== ChannelType.GuildCategory)) console.log(`  #${c.name} [${TYPES[c.type] || c.type}]${flags(c)}`)
  for (const cat of sorted.filter((x) => x.type === ChannelType.GuildCategory)) {
    console.log(`${cat.name}${flags(cat)}`)
    for (const c of sorted.filter((x) => x.parent_id === cat.id)) console.log(`  #${c.name} [${TYPES[c.type] || c.type}]${flags(c)}`)
  }
  console.log('\nCargos, de cima para baixo (o bot só dá cargos que estão abaixo do dele):')
  for (const r of [...roles].sort((a, b) => b.position - a.position)) {
    if (r.name === '@everyone') continue
    const admin = BigInt(r.permissions) & PermissionFlagsBits.Administrator ? ' (administrador)' : ''
    console.log(`  ${r.name}${admin}${r.tags?.bot_id === me.id ? '  <- este bot' : r.managed ? ' (de integração)' : ''}`)
  }
}

async function convite() {
  const g = await guild()
  const channels = (await rest.get(Routes.guildChannels(g.id))) as Channel[]
  const target = ['boasvindas', 'anuncios', 'geral'].map((n) => channels.find((c) => norm(c.name) === n)).find(Boolean)
  if (!target) throw new Error('Não achei #boas-vindas, #anúncios ou #geral para o convite.')
  const invite = (await rest.post(Routes.channelInvites(target.id), { body: { max_age: 0, max_uses: 0, unique: false } })) as { code: string }
  console.log(`Convite permanente (canal #${target.name}): https://discord.gg/${invite.code}`)
}

const command = process.argv[2]
const run = command === 'listar' ? listar : command === 'convite' ? convite : null
if (!run) {
  console.error('Use: listar | convite')
  process.exit(1)
}
await run().catch((error) => {
  console.error('Erro:', error instanceof Error ? error.message : error)
  process.exit(1)
})
