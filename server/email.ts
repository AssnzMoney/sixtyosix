// Envio de e-mails transacionais pelo Resend (https://resend.com).
// Sem RESEND_API_KEY nada é enviado: o restante do site funciona igual.

export type EmailConfig = { apiKey: string; from: string; replyTo?: string }
export type EmailMessage = { to: string; subject: string; html: string; text: string }

export const SITE_URL = 'https://www.sixtysix.online'
const SUPPORT_WHATSAPP_LINK = 'https://wa.me/5581992376036'
const SUPPORT_WHATSAPP_LABEL = '(81) 99237-6036'
const LOGO_URL = `${SITE_URL}/icon-192.png`

export function emailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) return null
  return {
    apiKey,
    from: env.EMAIL_FROM?.trim() || 'SixtySix <contato@sixtysix.online>',
    ...(env.EMAIL_REPLY_TO?.trim() ? { replyTo: env.EMAIL_REPLY_TO.trim() } : {}),
  }
}

export const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 320 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(value)

/** Envia um e-mail. A chave de idempotência evita duplicar o mesmo aviso se a função rodar de novo. */
export async function sendEmail(config: EmailConfig, message: EmailMessage, request: typeof fetch = fetch, idempotencyKey?: string) {
  if (!isEmail(message.to)) throw new Error('Destinatário inválido.')
  const response = await request('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey.slice(0, 256) } : {}),
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Resend respondeu ${response.status}.`)
  const body = (await response.json().catch(() => ({}))) as { id?: string }
  return body.id || null
}

/* ------------------------------ Modelos ------------------------------ */

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
/** Nome vindo do cadastro: sem quebras, curto e só o primeiro nome se for longo. */
export function firstName(value: unknown) {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : ''
  return text.slice(0, 30)
}
export const planName = (code: string) => ({ dev: 'Dev', devApi: 'Dev + API', pro: 'Pro' })[code] || 'SixtySix'
export const brDate = (value: string) =>
  new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'long', year: 'numeric' })

type Step = { title: string; text: string }
type Block =
  | { kind: 'p'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'steps'; items: Step[] }
  | { kind: 'chips'; label: string; items: string[] }
type Link = { label: string; url: string }

// Cores do site (src/index.css): tinta verde-petróleo, papel, menta e o verde-limão dos botões.
const C = { ink: '#1f4647', muted: '#4e6b68', dark: '#123435', paper: '#fbf9f4', cream: '#f3efe6', mint: '#e4f9ee', green: '#15803d', lime: '#9eea6c', limeInk: '#0b3824', line: '#e6ebe8' }
const FONT = "Arial,Helvetica,sans-serif"

function blockHtml(b: Block): string {
  if (b.kind === 'p') return `<p style="margin:0 0 16px;font:400 16px/1.6 ${FONT};color:${C.ink};">${escapeHtml(b.text)}</p>`
  if (b.kind === 'note')
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;"><tr><td style="padding:14px 16px;border-radius:14px;background:${C.mint};font:600 14px/1.5 ${FONT};color:${C.green};">${escapeHtml(b.text)}</td></tr></table>`
  if (b.kind === 'heading')
    return `<p style="margin:8px 0 14px;font:700 12px/1.4 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${escapeHtml(b.text)}</p>`
  if (b.kind === 'steps')
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;">${b.items
      .map(
        (s, i) => `<tr>
<td width="44" valign="top" style="padding:0 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="32" height="32" align="center" valign="middle" style="width:32px;height:32px;border-radius:999px;background:${C.lime};font:700 15px/32px ${FONT};color:${C.limeInk};">${i + 1}</td></tr></table></td>
<td valign="top" style="padding:3px 0 18px;"><p style="margin:0 0 4px;font:700 16px/1.35 ${FONT};color:${C.ink};">${escapeHtml(s.title)}</p><p style="margin:0;font:400 14.5px/1.55 ${FONT};color:${C.muted};">${escapeHtml(s.text)}</p></td>
</tr>`,
      )
      .join('')}</table>`
  return `<p style="margin:0 0 10px;font:700 12px/1.4 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${escapeHtml(b.label)}</p>
<p style="margin:0 0 22px;line-height:2.4;">${b.items
    .map((item) => `<span style="display:inline-block;margin:0 6px 0 0;padding:7px 13px;border-radius:999px;background:${C.cream};border:1px solid ${C.line};font:700 13px/1 ${FONT};color:${C.ink};white-space:nowrap;">${escapeHtml(item)}</span>`)
    .join(' ')}</p>`
}

const blockText = (b: Block): string[] =>
  b.kind === 'steps' ? b.items.map((s, i) => `${i + 1}. ${s.title}: ${s.text}`)
  : b.kind === 'chips' ? [`${b.label}: ${b.items.join(', ')}`]
  : b.kind === 'heading' ? ['', b.text.toUpperCase()]
  : [b.text]

/**
 * Layout único de todos os e-mails: papel, card branco e botão verde-limão, como o site.
 * Com `hero`, o topo do card vira uma faixa verde-escura com o título em destaque (boas-vindas, acesso).
 * Tabelas e estilo em linha para funcionar no Gmail, Outlook e no app de e-mail do celular.
 */
export function layout(input: {
  preheader: string
  title: string
  hero?: { eyebrow: string; subtitle: string }
  blocks: Block[]
  button?: Link
  secondary?: Link
  footnote?: string
}) {
  const body = input.blocks.map(blockHtml).join('')
  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px;"><tr><td align="center" style="border-radius:999px;background:${C.lime};">
<a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:16px 30px;font:700 16px/1 ${FONT};color:${C.limeInk};text-decoration:none;border-radius:999px;">${escapeHtml(input.button.label)} &rarr;</a>
</td></tr></table>`
    : ''
  const secondary = input.secondary
    ? `<p style="margin:12px 0 0;font:400 14px/1.5 ${FONT};color:${C.muted};">ou <a href="${escapeHtml(input.secondary.url)}" style="color:${C.green};font-weight:700;text-decoration:underline;">${escapeHtml(input.secondary.label)}</a></p>`
    : ''
  const top = input.hero
    ? `<tr><td style="padding:38px 32px 34px;background:${C.dark};border-radius:24px 24px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="padding:6px 12px;border-radius:999px;background:#1d4a4b;font:700 11.5px/1 ${FONT};letter-spacing:1.4px;text-transform:uppercase;color:${C.lime};">${escapeHtml(input.hero.eyebrow)}</td></tr></table>
<h1 style="margin:18px 0 10px;font:700 30px/1.15 ${FONT};color:#ffffff;letter-spacing:-0.6px;">${escapeHtml(input.title)}</h1>
<p style="margin:0;font:400 16px/1.55 ${FONT};color:#cfe3dc;">${escapeHtml(input.hero.subtitle)}</p>
</td></tr>
<tr><td style="padding:30px 32px 32px;background:#ffffff;border:1px solid ${C.line};border-top:0;border-radius:0 0 24px 24px;">`
    : `<tr><td style="padding:32px 32px 32px;background:#ffffff;border:1px solid ${C.line};border-radius:24px;">
<h1 style="margin:0 0 16px;font:700 26px/1.2 ${FONT};color:${C.ink};letter-spacing:-0.5px;">${escapeHtml(input.title)}</h1>`
  const footnote = input.footnote || 'Você recebe este e-mail porque tem uma conta na SixtySix.'
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<span style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:28px 12px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 6px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><a href="${SITE_URL}" style="text-decoration:none;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px;"></td>
<td valign="middle" style="padding-left:10px;font:700 19px/1 ${FONT};color:${C.ink};letter-spacing:-0.3px;">SixtySix</td>
</tr></table></a></td>
<td align="right" valign="middle" style="font:400 13px/1 ${FONT};color:${C.muted};"><a href="${SITE_URL}" style="color:${C.muted};text-decoration:none;">sixtysix.online</a></td>
</tr></table></td></tr>
${top}
${body}${button}${secondary}
</td></tr>
<tr><td align="center" style="padding:24px 18px 0;font:400 13px/1.7 ${FONT};color:${C.muted};">
Dúvidas? Fale com a gente no WhatsApp <a href="${SUPPORT_WHATSAPP_LINK}" style="color:${C.green};font-weight:700;text-decoration:none;">${SUPPORT_WHATSAPP_LABEL}</a><br>
<span style="font-size:12px;">${escapeHtml(footnote)} <a href="${SITE_URL}/privacidade.html" style="color:${C.muted};">Privacidade</a></span>
</td></tr>
</table></td></tr></table></body></html>`
  const text = [
    input.title,
    ...(input.hero ? [input.hero.subtitle] : []),
    '',
    ...input.blocks.flatMap(blockText),
    ...(input.button ? ['', `${input.button.label}: ${input.button.url}`] : []),
    ...(input.secondary ? [`Ou ${input.secondary.label}: ${input.secondary.url}`] : []),
    '',
    `Dúvidas? WhatsApp ${SUPPORT_WHATSAPP_LABEL}: ${SUPPORT_WHATSAPP_LINK}`,
    footnote,
  ].join('\n')
  return { html, text }
}

/** Código de 6 dígitos para entrar na administração (verificação em duas etapas). */
export function adminCodeEmail(input: { to: string; code: string }): EmailMessage {
  const code = String(input.code || '').replace(/\D/g, '').slice(0, 6)
  return {
    to: input.to,
    subject: `Código de acesso à administração: ${code}`,
    ...layout({
      preheader: `Seu código é ${code}. Ele vale por 10 minutos.`,
      title: 'Código de acesso à administração',
      blocks: [
        { kind: 'p', text: 'Use este código para entrar na administração da SixtySix:' },
        { kind: 'note', text: code },
        { kind: 'p', text: 'Ele vale por 10 minutos. Depois de entrar, este aparelho fica liberado por 30 dias.' },
        { kind: 'p', text: 'Se não foi você que tentou entrar, ignore este e-mail e troque a senha da sua conta.' },
      ],
    }),
  }
}

export function welcomeEmail(input: { to: string; name?: string }): EmailMessage {
  const name = firstName(input.name)
  const title = name ? `Boas-vindas, ${name}!` : 'Boas-vindas à SixtySix!'
  return {
    to: input.to,
    subject: name ? `${name}, sua conta na SixtySix está pronta` : 'Sua conta na SixtySix está pronta',
    ...layout({
      preheader: 'Veja como começar em 3 passos: plano, Pix e sua chave no WhatsApp.',
      title,
      hero: { eyebrow: 'Conta criada', subtitle: 'Claude Code, Codex e os melhores modelos de IA no seu terminal, pagos em reais.' },
      blocks: [
        { kind: 'p', text: 'Que bom ter você aqui. Sua conta está pronta, e em poucos minutos você já está programando com IA no seu terminal ou editor.' },
        { kind: 'heading', text: 'Como começar' },
        {
          kind: 'steps',
          items: [
            { title: 'Escolha seu plano', text: 'Dev, Dev + API ou Pro. Cada um vale 30 dias, e você renova quando quiser.' },
            { title: 'Pague por Pix ou cartão', text: 'Direto no site, em reais. A confirmação do Pix sai na hora.' },
            { title: 'Receba sua chave no WhatsApp', text: 'Enviamos a chave e a URL de configuração para o número do seu cadastro. O painel tem o passo a passo de cada ferramenta.' },
          ],
        },
        { kind: 'chips', label: 'Funciona com', items: ['Claude Code', 'Claude Desktop', 'Codex', 'Cline', 'OpenCode'] },
        { kind: 'note', text: 'Por segurança, sua chave nunca vai por e-mail: ela chega só pelo WhatsApp.' },
      ],
      button: { label: 'Escolher meu plano', url: `${SITE_URL}/#planos` },
      secondary: { label: 'abra seu painel', url: `${SITE_URL}/dashboard` },
    }),
  }
}

/**
 * Modelo do e-mail de acesso que o Supabase manda no cadastro e no login por e-mail
 * ("Confirm signup" e "Magic Link" em Authentication → Emails). O Supabase troca
 * {{ .ConfirmationURL }} pelo link; gerado em supabase/email-acesso.html por scripts/email-previews.ts.
 */
export function supabaseAccessTemplate() {
  return layout({
    preheader: 'Clique no botão para entrar na SixtySix. O link vale por 1 hora.',
    title: 'Seu link de acesso',
    hero: { eyebrow: 'Entrar na SixtySix', subtitle: 'Falta só um clique para abrir sua conta.' },
    blocks: [
      { kind: 'p', text: 'Use o botão abaixo para confirmar seu e-mail e entrar. Se você está criando a conta agora, ela fica pronta no mesmo clique.' },
      { kind: 'note', text: 'O link vale por 1 hora e funciona uma vez só. Se não foi você que pediu, pode ignorar este e-mail.' },
    ],
    button: { label: 'Entrar na SixtySix', url: '{{ .ConfirmationURL }}' },
    footnote: 'Você recebe este e-mail porque alguém pediu para entrar na SixtySix com este endereço.',
  })
}

export function deliveryEmail(input: { to: string; name?: string; title: string; hint: string }): EmailMessage {
  const name = firstName(input.name)
  const hint = String(input.hint || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 8)
  return {
    to: input.to,
    subject: 'Sua credencial SixtySix chegou no WhatsApp',
    ...layout({
      preheader: `Confira o WhatsApp e confirme o recebimento da chave terminada em …${hint}.`,
      title: name ? `${name}, sua credencial chegou` : 'Sua credencial chegou',
      blocks: [
        { kind: 'p', text: `Enviamos pelo WhatsApp sua credencial ${input.title}, com a chave terminada em …${hint} e a URL de configuração.` },
        { kind: 'note', text: 'Por segurança, a chave nunca vai por e-mail. Se não encontrou a mensagem, fale com a gente no WhatsApp.' },
        { kind: 'p', text: 'Depois de configurar, confirme o recebimento no seu painel. Leva só um clique.' },
      ],
      button: { label: 'Confirmar recebimento', url: `${SITE_URL}/dashboard` },
    }),
  }
}

export function expiringEmail(input: { to: string; name?: string; plan: string; paidUntil: string; daysLeft: number }): EmailMessage {
  const name = firstName(input.name)
  const days = Math.max(1, Math.round(input.daysLeft))
  const when = days === 1 ? 'amanhã' : `em ${days} dias`
  const plan = planName(input.plan)
  return {
    to: input.to,
    subject: `Seu plano ${plan} vence ${when}`,
    ...layout({
      preheader: `Renove pelo Pix até ${brDate(input.paidUntil)} para não perder o acesso.`,
      title: name ? `${name}, seu plano vence ${when}` : `Seu plano vence ${when}`,
      blocks: [
        { kind: 'p', text: `Seu acesso ao plano ${plan} vai até ${brDate(input.paidUntil)}. Para continuar sem interrupção, renove antes dessa data.` },
        { kind: 'p', text: 'A renovação é feita no site, por Pix ou cartão, e libera mais 30 dias assim que o pagamento é confirmado.' },
      ],
      button: { label: `Renovar o plano ${plan}`, url: `${SITE_URL}/comprar/${encodeURIComponent(input.plan)}` },
    }),
  }
}

export function expiredEmail(input: { to: string; name?: string; plan: string; paidUntil: string }): EmailMessage {
  const name = firstName(input.name)
  const plan = planName(input.plan)
  return {
    to: input.to,
    subject: `Seu plano ${plan} venceu`,
    ...layout({
      preheader: 'Renove para voltar a usar sua chave e o chat do site.',
      title: name ? `${name}, seu plano venceu` : 'Seu plano venceu',
      blocks: [
        { kind: 'p', text: `O acesso do plano ${plan} terminou em ${brDate(input.paidUntil)}. Sua chave e o chat do site ficam pausados até a renovação.` },
        { kind: 'p', text: 'É só renovar no site, por Pix ou cartão. Se precisar de uma chave nova, a gente envia pelo WhatsApp.' },
      ],
      button: { label: `Renovar o plano ${plan}`, url: `${SITE_URL}/comprar/${encodeURIComponent(input.plan)}` },
    }),
  }
}
