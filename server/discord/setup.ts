import { ChannelType, OverwriteType, PermissionFlagsBits, REST, Routes } from 'discord.js'
import { WHATSAPP } from './knowledge.ts'

/*
 * Arruma o servidor da SixtySix no Discord pelo bot (precisa do DISCORD_BOT_TOKEN e do bot como Administrador):
 *   node --env-file=.env --experimental-strip-types server/discord/setup.ts listar
 *   node ... server/discord/setup.ts arrumar      cria só o que falta (cargo Equipe, categorias e canais) e posta os textos
 *   node ... server/discord/setup.ts convite      convite que não vence (para o rodapé do site)
 * Nunca apaga nem move canal existente. Os textos só vão para canais criados agora ou vazios.
 */
type Channel = { id: string; name: string; type: number; parent_id: string | null; position: number; topic?: string | null; permission_overwrites?: { id: string; type: number; allow: string; deny: string }[] }
type Role = { id: string; name: string; permissions: string; position: number; managed: boolean }
type Spec = { name: string; topic: string; readOnly?: boolean; announcement?: boolean; text?: (ids: Record<string, string>) => string; pin?: boolean }
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
    category: 'INFORMAÇÕES',
    channels: [
      {
        name: 'boas-vindas', topic: 'Comece por aqui.', readOnly: true,
        text: (ids) => `**Bem-vindo à comunidade da SixtySix.**\nAqui você tira dúvidas, acompanha as novidades e troca ideia com quem programa e automatiza com IA.\n\n**Por onde começar**\n- Dúvida ou problema: escreva em ${link(ids, 'suporte')}. O assistente responde na hora e a equipe acompanha.\n- Configurar sua ferramenta: ${link(ids, 'como-conectar')}.\n- Novidades: ${link(ids, 'anúncios')}.\n- Mostre o que você está construindo: ${link(ids, 'projetos')}.\n\nAinda não é cliente? Planos a partir de R$ 79,99 no Pix e teste grátis de 3 horas: https://www.sixtysix.online`,
      },
      {
        name: 'regras', topic: 'Regras da comunidade.', readOnly: true,
        text: (ids) => `**Regras**\n1. Respeito com todo mundo. Sem ofensa, spam ou divulgação de outros serviços.\n2. Nunca cole sua chave da SixtySix aqui. Mensagem com chave é apagada na hora.\n3. Dúvidas vão em ${link(ids, 'suporte')}: o assistente abre um tópico só para você.\n4. Pagamento e conta são resolvidos pela equipe, no tópico ou no WhatsApp ${WHATSAPP}.\n5. Conteúdo ilegal ou pirataria leva a banimento.`,
      },
      { name: 'anúncios', topic: 'Novidades da SixtySix.', readOnly: true, announcement: true },
    ],
  },
  {
    category: 'SUPORTE',
    channels: [
      {
        name: 'suporte', topic: 'Mande sua dúvida: o assistente abre um tópico com você e responde. A equipe acompanha.', pin: true,
        text: () => `**Como funciona o suporte**\nEscreva sua dúvida aqui, numa mensagem só: a ferramenta, o sistema e a mensagem de erro (sem a chave). O assistente da SixtySix abre um tópico com o seu nome e responde em segundos. Se precisar, ele chama a equipe, que continua no mesmo tópico.\n\nUrgente ou assunto de pagamento: WhatsApp ${WHATSAPP}.`,
      },
      {
        name: 'como-conectar', topic: 'Endereços e modelos de cada ferramenta.', readOnly: true,
        text: (ids) => `**Como conectar**\nO passo a passo completo, já com a sua chave, fica no painel: https://www.sixtysix.online/dashboard (aba Como conectar).\n\n**Endereços**\n- Claude Code, Claude Desktop e Orca: \`https://www.sixtysix.online\`\n- Codex, Cline, OpenCode e Cursor: \`https://www.sixtysix.online/v1\`\n\n**Modelos**\n- \`claude-opus-5-5\`: Claude Code e Claude Desktop\n- \`gpt-6-astra\`: Codex\n- \`argon-4\`: Cline, OpenCode, Orca e Cursor\n\n**Claude Code no PowerShell**\n\`\`\`\n$env:ANTHROPIC_BASE_URL='https://www.sixtysix.online'\n$env:ANTHROPIC_API_KEY='SUA_CHAVE'\nclaude --model claude-opus-5-5\n\`\`\`\nDeu erro? Pergunte em ${link(ids, 'suporte')}.`,
      },
    ],
  },
  {
    category: 'COMUNIDADE',
    channels: [
      { name: 'geral', topic: 'Papo livre sobre IA, código e automação.' },
      { name: 'projetos', topic: 'Mostre o que você está construindo. Todo mês tem tema no Rank do mês, no painel.' },
    ],
  },
  { category: 'EQUIPE', staffOnly: true, channels: [{ name: 'equipe', topic: 'Só a equipe da SixtySix.' }] },
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
  let staff = roles.find((r) => norm(r.name) === norm(process.env.DISCORD_STAFF_ROLE || 'Equipe'))
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
      if (existing) {
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
  for (const group of PLAN) {
    for (const spec of group.channels) {
      const channel = byName.get(norm(spec.name))
      if (!channel || !spec.text) continue
      const last = (await rest.get(Routes.channelMessages(channel.id), { query: new URLSearchParams({ limit: '1' }) })) as unknown[]
      if (!created.has(channel.id) && last.length) {
        console.log(`#${channel.name} já tem mensagens: texto não postado`)
        continue
      }
      const message = (await rest.post(Routes.channelMessages(channel.id), { body: { content: spec.text(ids), allowed_mentions: { parse: [] } } })) as { id: string }
      if (spec.pin) await rest.put(Routes.channelPin(channel.id, message.id)).catch(() => undefined)
      console.log(`Texto postado em #${channel.name}`)
    }
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
