import { ChannelType, OverwriteType, PermissionFlagsBits, REST, Routes } from 'discord.js'
import { CHANNEL_MESSAGES } from './channel-messages.ts'

/*
 * Arruma o servidor da SixtySix no Discord pelo bot (precisa do DISCORD_BOT_TOKEN e do bot como Administrador):
 *   node --env-file=.env --experimental-strip-types server/discord/setup.ts listar
 *   node ... server/discord/setup.ts arrumar      cria só o que falta (cargo Equipe, categorias e canais) e posta os textos
 *   node ... server/discord/setup.ts convite      convite que não vence (para o rodapé do site)
 * Nunca apaga nem move canal existente. Os textos (embeds de channel-messages.ts) editam a mensagem que o bot já
 * postou no canal; sem ela, só vão para canais criados agora ou vazios.
 */
type Channel = { id: string; name: string; type: number; parent_id: string | null; position: number; topic?: string | null; permission_overwrites?: { id: string; type: number; allow: string; deny: string }[] }
type Role = { id: string; name: string; permissions: string; position: number; managed: boolean }
type Spec = { name: string; topic: string; readOnly?: boolean; announcement?: boolean; support?: boolean; pin?: boolean }
type Group = { category: string; staffOnly?: boolean; channels: Spec[] }

const token = process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('Falta DISCORD_BOT_TOKEN no .env.')
  process.exit(1)
}
const rest = new REST({ version: '10' }).setToken(token)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const TYPES: Record<number, string> = { 0: 'texto', 2: 'voz', 4: 'categoria', 5: 'anúncios', 13: 'palco', 15: 'fórum', 16: 'mídia' }
const bit = (p: bigint) => p.toString()
const link = (ids: Record<string, string>, name: string) => (ids[norm(name)] ? `<#${ids[norm(name)]}>` : `#${name}`)

const PLAN: Group[] = [
  {
    category: 'Importante',
    channels: [
      {
        name: 'boas-vindas', topic: 'Comece por aqui.', readOnly: true,
      },
      {
        name: 'regras', topic: 'Regras da comunidade.', readOnly: true,
      },
      { name: 'anúncios', topic: 'Novidades da SixtySix.', readOnly: true, announcement: true },
      {
        name: 'planos', topic: 'Planos e preços da SixtySix.', readOnly: true, announcement: true,
      },
    ],
  },
  {
    category: 'Suporte',
    channels: [
      {
        name: 'atendimento', topic: 'Mande sua dúvida aqui: o assistente da SixtySix abre um tópico com você e responde. A equipe acompanha.', support: true, pin: true,
      },
      {
        name: 'como-conectar', topic: 'Endereços e modelos de cada ferramenta.', readOnly: true,
      },
    ],
  },
  {
    category: 'Comunidade',
    channels: [
      { name: 'geral', topic: 'Papo livre sobre IA, código e automação.' },
      { name: 'feedbacks', topic: 'Espaço para clientes e membros deixarem suas avaliações e sugestões.' },
      { name: 'projetos', topic: 'Mostre o que você está construindo. Todo mês tem tema no Rank do mês, no painel.' },
    ],
  },
]

async function guild() {
  const guilds = (await rest.get(Routes.userGuilds())) as { id: string; name: string }[]
  if (!guilds.length) throw new Error('O bot ainda não está em nenhum servidor. Use o link de convite do bot primeiro.')
  const wanted = process.env.DISCORD_GUILD_ID
  const g = wanted ? guilds.find((x) => x.id === wanted) : guilds.length === 1 ? guilds[0] : guilds.find((x) => norm(x.name) === 'sixtysix')
  if (!g) throw new Error(`O bot está em vários servidores (${guilds.map((x) => x.name).join(', ')}). Defina DISCORD_GUILD_ID.`)
  return g
}
const channelsOf = async (id: string) => (await rest.get(Routes.guildChannels(id))) as Channel[]
const rolesOf = async (id: string) => (await rest.get(Routes.guildRoles(id))) as Role[]

async function listar() {
  const g = await guild()
  const [channels, roles] = await Promise.all([channelsOf(g.id), rolesOf(g.id)])
  console.log(`Servidor: ${g.name} (${g.id})\n`)
  const everyone = g.id
  const flags = (c: Channel) => {
    const o = c.permission_overwrites?.find((x) => x.id === everyone)
    const out: string[] = []
    if (o && (BigInt(o.deny) & PermissionFlagsBits.ViewChannel)) out.push('privado')
    else if (o && (BigInt(o.deny) & PermissionFlagsBits.SendMessages)) out.push('só leitura')
    if (c.topic) out.push(`tópico: ${c.topic.slice(0, 60)}`)
    return out.length ? ` (${out.join(', ')})` : ''
  }
  const sorted = [...channels].sort((a, b) => a.position - b.position)
  for (const c of sorted.filter((x) => !x.parent_id && x.type !== ChannelType.GuildCategory)) console.log(`  #${c.name} [${TYPES[c.type] || c.type}]${flags(c)}`)
  for (const cat of sorted.filter((x) => x.type === ChannelType.GuildCategory)) {
    console.log(`${cat.name}${flags(cat)}`)
    for (const c of sorted.filter((x) => x.parent_id === cat.id)) console.log(`  #${c.name} [${TYPES[c.type] || c.type}]${flags(c)}`)
  }
  console.log('\nCargos:')
  for (const r of [...roles].sort((a, b) => b.position - a.position)) {
    if (r.name === '@everyone') continue
    const admin = BigInt(r.permissions) & PermissionFlagsBits.Administrator ? ' (administrador)' : ''
    console.log(`  ${r.name}${admin}${r.managed ? ' (de integração)' : ''}`)
  }
}

async function arrumar() {
  const g = await guild()
  let roles = await rolesOf(g.id)
  const staffNames = (process.env.DISCORD_STAFF_ROLE || 'Equipe').split(',').map((n) => norm(n)).filter(Boolean)
  let staff = staffNames.map((n) => roles.find((r) => norm(r.name) === n || r.id === n)).find(Boolean)
  if (!staff) {
    staff = (await rest.post(Routes.guildRoles(g.id), { body: { name: 'Equipe', color: 0x16a34a, hoist: true, mentionable: true } })) as Role
    console.log('Criado o cargo Equipe (dê esse cargo a quem atende).')
  }
  const channels = await channelsOf(g.id)
  const byName = new Map(channels.map((c) => [norm(c.name), c]))
  const created = new Set<string>()
  const readOnly = (staffId: string) => [
    { id: g.id, type: OverwriteType.Role, deny: bit(PermissionFlagsBits.SendMessages | PermissionFlagsBits.CreatePublicThreads | PermissionFlagsBits.SendMessagesInThreads) },
    { id: staffId, type: OverwriteType.Role, allow: bit(PermissionFlagsBits.SendMessages) },
  ]
  for (const group of PLAN) {
    let category = byName.get(norm(group.category))
    if (!category || category.type !== ChannelType.GuildCategory) {
      const overwrites = group.staffOnly
        ? [{ id: g.id, type: OverwriteType.Role, deny: bit(PermissionFlagsBits.ViewChannel) }, { id: staff.id, type: OverwriteType.Role, allow: bit(PermissionFlagsBits.ViewChannel) }]
        : []
      category = (await rest.post(Routes.guildChannels(g.id), { body: { name: group.category, type: ChannelType.GuildCategory, permission_overwrites: overwrites } })) as Channel
      console.log(`Criada a categoria ${group.category}`)
    }
    for (const spec of group.channels) {
      const existing = byName.get(norm(spec.name))
      if (existing && spec.support) {
        const patch: Record<string, unknown> = { topic: spec.topic }
        if (existing.type === ChannelType.GuildAnnouncement) patch.type = ChannelType.GuildText
        const overwrites = (existing.permission_overwrites || []).filter((o) => o.id !== g.id)
        overwrites.push({ id: g.id, type: OverwriteType.Role, allow: bit(PermissionFlagsBits.SendMessages | PermissionFlagsBits.SendMessagesInThreads | PermissionFlagsBits.ReadMessageHistory), deny: '0' })
        patch.permission_overwrites = overwrites
        await rest.patch(Routes.channel(existing.id), { body: patch })
        console.log(`#${existing.name}: aberto para escrever (o assistente responde aqui)${patch.type === ChannelType.GuildText ? ', virou canal de texto' : ''}`)
        continue
      }
      if (existing) {
        if (spec.topic && !existing.topic) await rest.patch(Routes.channel(existing.id), { body: { topic: spec.topic } }).catch(() => undefined)
        console.log(`Já existe: #${existing.name} (mantido como está)`)
        continue
      }
      const body: Record<string, unknown> = { name: spec.name, topic: spec.topic, parent_id: category.id, type: spec.announcement ? ChannelType.GuildAnnouncement : ChannelType.GuildText }
      if (spec.readOnly) body.permission_overwrites = readOnly(staff.id)
      const made = (await rest.post(Routes.guildChannels(g.id), { body })) as Channel
      byName.set(norm(spec.name), made)
      created.add(made.id)
      console.log(`Criado #${spec.name}${spec.readOnly ? ' (só leitura)' : ''}`)
    }
  }
  const ids = Object.fromEntries([...byName.entries()].map(([k, c]) => [k, c.id]))
  const me = (await rest.get(Routes.user('@me'))) as { id: string }
  for (const group of PLAN) {
    for (const spec of group.channels) {
      const channel = byName.get(norm(spec.name))
      const build = CHANNEL_MESSAGES[norm(spec.name)]
      if (!channel || !build) continue
      const body = { content: '', ...build(ids), allowed_mentions: { parse: [] } }
      const recent = (await rest.get(Routes.channelMessages(channel.id), { query: new URLSearchParams({ limit: '50' }) })) as { id: string; author: { id: string } }[]
      // A mensagem mais antiga do bot no canal é a do texto fixo: edita ela (sem repetir mensagem).
      const mine = recent.filter((m) => m.author.id === me.id).at(-1)
      if (mine) {
        await rest.patch(Routes.channelMessage(channel.id, mine.id), { body })
        console.log(`Texto atualizado em #${channel.name}`)
        continue
      }
      if (!created.has(channel.id) && recent.length) {
        console.log(`#${channel.name} já tem mensagens de outras pessoas: texto não postado`)
        continue
      }
      const message = (await rest.post(Routes.channelMessages(channel.id), { body })) as { id: string }
      if (spec.pin) await rest.put(Routes.channelPin(channel.id, message.id)).catch(() => undefined)
      console.log(`Texto postado em #${channel.name}`)
    }
  }
  const welcome = byName.get('boasvindas')
  if (welcome) {
    await rest.patch(Routes.guild(g.id), { body: { system_channel_id: welcome.id } }).catch((e) => console.log('Não deu para ligar as mensagens de entrada:', e instanceof Error ? e.message : e))
    console.log('Mensagens de entrada de membros: #boas-vindas')
  }
  console.log('\nPronto. Agora: node ... server/discord/setup.ts convite')
}

async function convite() {
  const g = await guild()
  const channels = await channelsOf(g.id)
  const target = ['boasvindas', 'anuncios', 'geral'].map((n) => channels.find((c) => norm(c.name) === n)).find(Boolean)
  if (!target) throw new Error('Não achei #boas-vindas, #anúncios ou #geral para o convite.')
  const invite = (await rest.post(Routes.channelInvites(target.id), { body: { max_age: 0, max_uses: 0, unique: false } })) as { code: string }
  console.log(`Convite permanente (canal #${target.name}): https://discord.gg/${invite.code}`)
}

const command = process.argv[2]
const run = command === 'listar' ? listar : command === 'arrumar' ? arrumar : command === 'convite' ? convite : null
if (!run) {
  console.error('Use: listar | arrumar | convite')
  process.exit(1)
}
await run().catch((error) => {
  console.error('Erro:', error instanceof Error ? error.message : error)
  process.exit(1)
})
