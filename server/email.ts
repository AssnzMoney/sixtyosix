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

type Block = { kind: 'p'; text: string } | { kind: 'note'; text: string }
/** Layout único: papel, card branco, tinta verde-petróleo e botão verde-limão, como o site. */
function layout(input: { preheader: string; title: string; blocks: Block[]; button?: { label: string; url: string } }) {
  const paragraphs = input.blocks
    .map((b) =>
      b.kind === 'p'
        ? `<p style="margin:0 0 16px;font:400 16px/1.6 Arial,Helvetica,sans-serif;color:#1f4647;">${escapeHtml(b.text)}</p>`
        : `<p style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#e4f9ee;font:600 14px/1.5 Arial,Helvetica,sans-serif;color:#15803d;">${escapeHtml(b.text)}</p>`,
    )
    .join('')
  const button = input.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="border-radius:999px;background:#9eea6c;">
<a href="${escapeHtml(input.button.url)}" style="display:inline-block;padding:14px 26px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0b3824;text-decoration:none;border-radius:999px;">${escapeHtml(input.button.label)}</a>
</td></tr></table>`
    : ''
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#fbf9f4;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf9f4;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 18px;"><img src="${LOGO_URL}" width="44" height="44" alt="SixtySix" style="display:block;border:0;"></td></tr>
<tr><td style="padding:30px 28px;background:#ffffff;border:1px solid #e6ebe8;border-radius:24px;">
<h1 style="margin:0 0 16px;font:700 26px/1.2 Arial,Helvetica,sans-serif;color:#1f4647;letter-spacing:-0.5px;">${escapeHtml(input.title)}</h1>
${paragraphs}${button}
</td></tr>
<tr><td style="padding:18px 6px 0;font:400 12.5px/1.6 Arial,Helvetica,sans-serif;color:#4e6b68;">
Dúvidas? Fale com a gente no WhatsApp <a href="${SUPPORT_WHATSAPP_LINK}" style="color:#15803d;font-weight:700;">${SUPPORT_WHATSAPP_LABEL}</a>.<br>
Você recebe este e-mail porque tem uma conta na SixtySix. <a href="${SITE_URL}/privacidade.html" style="color:#4e6b68;">Privacidade</a>
</td></tr>
</table></td></tr></table></body></html>`
  const text = [
    input.title,
    '',
    ...input.blocks.map((b) => b.text),
    ...(input.button ? ['', `${input.button.label}: ${input.button.url}`] : []),
    '',
    `Dúvidas? WhatsApp ${SUPPORT_WHATSAPP_LABEL}: ${SUPPORT_WHATSAPP_LINK}`,
    'Você recebe este e-mail porque tem uma conta na SixtySix.',
  ].join('\n')
  return { html, text }
}

export function welcomeEmail(input: { to: string; name?: string }): EmailMessage {
  const name = firstName(input.name)
  const title = name ? `Boas-vindas, ${name}!` : 'Boas-vindas à SixtySix!'
  return {
    to: input.to,
    subject: 'Sua conta na SixtySix está pronta',
    ...layout({
      preheader: 'Escolha seu plano e receba sua chave pelo WhatsApp.',
      title,
      blocks: [
        { kind: 'p', text: 'Sua conta está criada. No painel você acompanha seu plano, suas credenciais e o passo a passo para conectar o Claude Code, o Codex e outras ferramentas.' },
        { kind: 'p', text: 'Para começar, escolha um plano e pague por Pix ou cartão. Logo depois do pagamento, enviamos sua chave e a URL de configuração pelo seu WhatsApp.' },
      ],
      button: { label: 'Abrir meu painel', url: `${SITE_URL}/dashboard` },
    }),
  }
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
