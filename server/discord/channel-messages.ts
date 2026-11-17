import { buttons, COLORS, footer, ICON, LINKS, type Payload } from './embeds.ts'
import { WHATSAPP } from './knowledge.ts'

/**
 * Textos fixos dos canais do servidor, em embed. A chave é o nome do canal sem acento e sem enfeite ("boasvindas").
 * O setup.ts edita a mensagem que o bot já postou no canal (ou posta, se o canal estiver vazio), então mudar um
 * texto aqui e rodar "setup.ts arrumar" atualiza o canal sem criar mensagem repetida.
 */
type Ids = Record<string, string>
const ch = (ids: Ids, key: string, label: string) => (ids[key] ? `<#${ids[key]}>` : `#${label}`)

export const CHANNEL_MESSAGES: Record<string, (ids: Ids) => Payload> = {
  boasvindas: (ids) => ({
    embeds: [{
      title: 'Bem-vindo à SixtySix',
      description: 'Aqui você tira dúvidas, acompanha as novidades e troca ideia com quem programa e automatiza com IA.',
      color: COLORS.brand,
      thumbnail: { url: ICON },
      fields: [
        { name: 'Dúvida ou problema', value: `Escreva em ${ch(ids, 'atendimento', 'atendimento')}. O assistente responde na hora e a equipe acompanha.` },
        { name: 'Planos e preços', value: ch(ids, 'planos', 'planos'), inline: true },
        { name: 'Configurar', value: ch(ids, 'comoconectar', 'como-conectar'), inline: true },
        { name: 'Novidades', value: ch(ids, 'anuncios', 'anúncios'), inline: true },
        { name: 'Seus projetos', value: `${ch(ids, 'projetos', 'projetos')}: todo mês tem tema no Rank do mês, no painel.` },
      ],
      footer: footer(),
    }],
    components: buttons([
      { label: 'Ver os planos', url: LINKS.plans },
      { label: 'Teste grátis de 3 horas', url: LINKS.trial },
      { label: 'Abrir o painel', url: LINKS.dashboard },
    ]),
  }),

  regras: (ids) => ({
    embeds: [{
      title: 'Regras da comunidade',
      description: [
        '**1.** Respeito com todo mundo. Sem ofensa, spam ou divulgação de outros serviços.',
        '**2.** Nunca cole a sua chave da SixtySix aqui. Mensagem com chave é apagada na hora.',
        `**3.** Dúvidas vão em ${ch(ids, 'atendimento', 'atendimento')}: o assistente abre um tópico só para você.`,
        `**4.** Pagamento e conta são resolvidos pela equipe, no tópico ou no WhatsApp ${WHATSAPP}.`,
        '**5.** Conteúdo ilegal ou pirataria leva a banimento.',
      ].join('\n\n'),
      color: COLORS.brand,
      footer: footer(),
    }],
  }),

  planos: () => ({
    embeds: [{
      title: 'Planos da SixtySix',
      description: 'Preço fixo em reais no Pix, sem IOF, sem rateio e sem cota a cada 5 horas.',
      color: COLORS.brand,
      thumbnail: { url: ICON },
      fields: [
        { name: 'Dev · R$ 79,99/mês', value: 'GPT Astra 6 pelo site (conversa no painel). Sem chave de API.' },
        { name: 'Dev + API · R$ 94,99/mês', value: 'GPT Astra 6 com chave de API para Claude Code, Cursor e VS Code.' },
        { name: 'Pro · R$ 119,99/mês', value: 'Claude Opus 5.5, GPT Astra 6 e Argon 4 com chave de API, mais geração de imagens (Gemini 3 Pro e outros). Uso ilimitado no Claude Code, Cursor, VS Code, Codex, Cline, OpenCode e Orca.' },
        { name: 'Pagamento', value: 'Pix vale 30 dias, sem renovação automática. No cartão, renova todo mês.', inline: true },
        { name: 'Teste grátis', value: '3 horas, sem cartão, pedido pelo WhatsApp.', inline: true },
      ],
      footer: footer(),
    }],
    components: buttons([
      { label: 'Assinar', url: LINKS.plans },
      { label: 'Pedir teste grátis', url: LINKS.trial },
    ]),
  }),

  atendimento: () => ({
    embeds: [{
      title: 'Como funciona o atendimento',
      description: 'Escreva a sua dúvida aqui, numa mensagem só. O assistente da SixtySix abre um tópico com o seu nome e responde em segundos. Se precisar, ele chama a equipe, que continua no mesmo tópico.',
      color: COLORS.brand,
      fields: [
        { name: 'O que mandar', value: '- A ferramenta (Claude Code, Codex, Cline...)\n- O sistema (Windows, macOS ou Linux)\n- A mensagem de erro, sem a chave' },
        { name: 'Nunca cole a sua chave', value: 'Mensagem com chave é apagada na hora.', inline: true },
        { name: 'Urgente ou pagamento', value: `WhatsApp ${WHATSAPP}`, inline: true },
      ],
      footer: footer(),
    }],
    components: buttons([
      { label: 'Falar no WhatsApp', url: LINKS.whatsapp },
      { label: 'Abrir o painel', url: LINKS.dashboard },
    ]),
  }),

  comoconectar: (ids) => ({
    embeds: [{
      title: 'Como conectar',
      description: 'O passo a passo completo, já com a sua chave, fica no painel, na aba **Como conectar**.',
      color: COLORS.brand,
      fields: [
        { name: 'Claude Code, Claude Desktop e Orca', value: 'Endereço: `https://www.sixtysix.online`\nModelo: `claude-opus-5-5`' },
        { name: 'Codex', value: 'Endereço: `https://www.sixtysix.online/v1`\nModelo: `gpt-6-astra`', inline: true },
        { name: 'Cline, OpenCode e Cursor', value: 'Endereço: `https://www.sixtysix.online/v1`\nModelo: `argon-4`', inline: true },
        { name: 'Claude Code no PowerShell', value: "```powershell\n$env:ANTHROPIC_BASE_URL='https://www.sixtysix.online'\n$env:ANTHROPIC_API_KEY='SUA_CHAVE'\nclaude --model claude-opus-5-5\n```" },
        { name: 'Deu erro?', value: `Pergunte em ${ch(ids, 'atendimento', 'atendimento')}.` },
      ],
      footer: footer(),
    }],
    components: buttons([{ label: 'Abrir o passo a passo', url: LINKS.dashboard }]),
  }),
}
