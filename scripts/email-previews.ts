// Gera a prévia de todos os e-mails em .claude/prints/emails/ (fora do git) e o modelo do
// e-mail de acesso do Supabase em supabase/email-acesso.html (para colar no painel do Supabase).
// Rodar: node --experimental-strip-types --import ./scripts/test-register.mjs scripts/email-previews.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { adminCodeEmail, deliveryEmail, expiredEmail, expiringEmail, supabaseAccessTemplate, welcomeEmail } from '../server/email.ts'

const out = '.claude/prints/emails'
mkdirSync(out, { recursive: true })
const day = 86400000
const emails = {
  'boas-vindas': welcomeEmail({ to: 'ana@exemplo.com', name: 'Ana' }),
  'credencial-chegou': deliveryEmail({ to: 'ana@exemplo.com', name: 'Ana', title: 'Pro', hint: '9f3a' }),
  'plano-vencendo': expiringEmail({ to: 'ana@exemplo.com', name: 'Ana', plan: 'pro', paidUntil: new Date(Date.now() + 3 * day).toISOString(), daysLeft: 3 }),
  'plano-vencido': expiredEmail({ to: 'ana@exemplo.com', name: 'Ana', plan: 'pro', paidUntil: new Date(Date.now() - day).toISOString() }),
  'codigo-admin': adminCodeEmail({ to: 'admin@exemplo.com', code: '482913' }),
}
for (const [name, email] of Object.entries(emails)) {
  writeFileSync(`${out}/${name}.html`, email.html)
  console.log(`${name}: "${email.subject}"`)
}
const access = supabaseAccessTemplate()
writeFileSync(`${out}/acesso-supabase.html`, access.html.replace('{{ .ConfirmationURL }}', 'https://www.sixtysix.online/auth/callback'))
writeFileSync('supabase/email-acesso.html', access.html + '\n')
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>E-mails SixtySix</title><body style="font:16px Arial;padding:24px">${[...Object.keys(emails), 'acesso-supabase'].map(n => `<p><a href="${n}.html">${n}</a></p>`).join('')}`)
console.log('acesso-supabase: supabase/email-acesso.html')
