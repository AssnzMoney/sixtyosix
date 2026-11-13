import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { deliveryEmail, emailConfig, expiredEmail, expiringEmail, sendEmail, supabaseAccessTemplate, welcomeEmail } from './email.ts'
import { createNotifier, userFromAuth } from './notifications.ts'
import { createCronHandler } from '../api/notifications.ts'
import { createAdminActions } from '../api/management.ts'

const NOW = Date.parse('2026-11-11T12:00:00Z')
const DAY = 86400000
const mail = { apiKey: 're_test', from: 'SixtySix <contato@sixtysix.online>' }
const supabase = { url: 'https://example.supabase.co', secret: 'sb_secret_server' }
const iso = (offset: number) => new Date(NOW + offset).toISOString()

test('e-mails escapam o nome e nunca levam a chave', () => {
  const w = welcomeEmail({ to: 'a@b.com', name: '<script>alert(1)</script>' })
  assert.ok(!w.html.includes('<script>'), 'sem HTML do usuário')
  assert.ok(w.html.includes('&lt;script&gt;'))
  const d = deliveryEmail({ to: 'a@b.com', name: 'Ana', title: 'Argon 4', hint: '9f3a' })
  assert.match(d.text, /…9f3a/)
  assert.match(d.text, /nunca vai por e-mail/)
  assert.ok(!/sk-[A-Za-z0-9]/.test(d.html))
})

test('boas-vindas: 3 passos, ferramentas e botão para os planos, em HTML e em texto', () => {
  const w = welcomeEmail({ to: 'ana@exemplo.com', name: 'Ana' })
  assert.equal(w.subject, 'Ana, sua conta na SixtySix está pronta')
  assert.match(w.html, /Boas-vindas, Ana!/)
  for (const step of ['Escolha seu plano', 'Pague por Pix ou cartão', 'Receba sua chave no WhatsApp']) {
    assert.ok(w.html.includes(step), step)
    assert.ok(w.text.includes(step), `${step} (texto)`)
  }
  assert.ok(w.html.includes('href="https://www.sixtysix.online/#planos"'))
  assert.match(w.text, /Funciona com: Claude Code, Claude Desktop, Codex, Cline, OpenCode/)
  assert.ok(!/sk-[A-Za-z0-9]/.test(w.html + w.text), 'nunca leva chave')
  assert.equal(welcomeEmail({ to: 'a@b.com' }).subject, 'Sua conta na SixtySix está pronta')
})

test('modelo do e-mail de acesso do Supabase leva o link dele e combina com o arquivo do repositório', () => {
  const access = supabaseAccessTemplate()
  assert.ok(access.html.includes('href="{{ .ConfirmationURL }}"'))
  assert.equal(readFileSync('supabase/email-acesso.html', 'utf8').trim(), access.html.trim(), 'rode scripts/email-previews.ts')
})

test('lembrete de vencimento fala do prazo e leva para renovar', () => {
  assert.equal(expiringEmail({ to: 'a@b.com', plan: 'pro', paidUntil: iso(DAY), daysLeft: 1 }).subject, 'Seu plano Pro vence amanhã')
  const e = expiringEmail({ to: 'a@b.com', plan: 'devApi', paidUntil: iso(3 * DAY), daysLeft: 3 })
  assert.equal(e.subject, 'Seu plano Dev + API vence em 3 dias')
  assert.match(e.html, /\/comprar\/devApi/)
  assert.equal(expiredEmail({ to: 'a@b.com', plan: 'dev', paidUntil: iso(-DAY) }).subject, 'Seu plano Dev venceu')
})

test('sem RESEND_API_KEY o envio fica desligado', () => {
  assert.equal(emailConfig({}), null)
  assert.deepEqual(emailConfig({ RESEND_API_KEY: ' re_x ', EMAIL_FROM: 'X <x@y.com>' }), { apiKey: 're_x', from: 'X <x@y.com>' })
})

test('envio pelo Resend com chave de idempotência', async () => {
  let call: { url: string; init: RequestInit } | undefined
  const id = await sendEmail(mail, welcomeEmail({ to: 'ana@exemplo.com', name: 'Ana' }), (async (url: string, init: RequestInit) => {
    call = { url: String(url), init }
    return Response.json({ id: 'email_1' })
  }) as typeof fetch, 'welcome:u1')
  assert.equal(id, 'email_1')
  assert.equal(call!.url, 'https://api.resend.com/emails')
  const headers = call!.init.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer re_test')
  assert.equal(headers['Idempotency-Key'], 'welcome:u1')
  const body = JSON.parse(String(call!.init.body))
  assert.deepEqual(body.to, ['ana@exemplo.com'])
  assert.equal(body.from, mail.from)
  await assert.rejects(sendEmail(mail, welcomeEmail({ to: 'invalido' }), fetch))
})

/** Supabase e Resend falsos, guardando o que foi chamado. */
function fakeBackend(options: { claimed?: boolean; tableMissing?: boolean; resendFails?: boolean; users?: any[]; subs?: any[]; active?: any[] } = {}) {
  const calls: { method: string; url: URL; body?: any }[] = []
  const sent: any[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const method = init.method || 'GET'
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined })
    if (url.host === 'api.resend.com') {
      if (options.resendFails) return new Response('{}', { status: 500 })
      sent.push(JSON.parse(String(init.body)))
      return Response.json({ id: 'email_' + sent.length })
    }
    if (url.pathname === '/auth/v1/admin/users') return Response.json({ users: options.users || [] })
    if (url.pathname === '/rest/v1/email_notifications') {
      if (options.tableMissing) return new Response('{}', { status: 404 })
      if (method === 'POST') return Response.json(options.claimed === false ? [] : [{ id: 'n1' }])
      return Response.json([])
    }
    if (url.pathname === '/rest/v1/billing_subscription_state') {
      return Response.json(url.searchParams.get('entitled') === 'eq.true' ? options.active || [] : options.subs || [])
    }
    throw new Error('Destino inesperado ' + url.pathname)
  }) as typeof fetch
  return { calls, sent, request }
}

const ana = { id: 'u-ana', email: 'ana@exemplo.com', name: 'Ana', whatsapp: '5581992376036' }

test('cada aviso sai uma vez só', async () => {
  const fresh = fakeBackend()
  assert.equal(await createNotifier(supabase, mail, fresh.request).welcome(ana), 'sent')
  assert.equal(fresh.sent.length, 1)
  assert.ok(fresh.calls.some((c) => c.method === 'PATCH' && c.url.pathname === '/rest/v1/email_notifications'), 'marca como enviado')

  const repeated = fakeBackend({ claimed: false })
  assert.equal(await createNotifier(supabase, mail, repeated.request).welcome(ana), 'duplicate')
  assert.equal(repeated.sent.length, 0)

  const noTable = fakeBackend({ tableMissing: true })
  assert.equal(await createNotifier(supabase, mail, noTable.request).welcome(ana), 'unavailable')
  assert.equal(noTable.sent.length, 0, 'sem a tabela de controle não envia, para não repetir')

  assert.equal(await createNotifier(supabase, null, fresh.request).welcome(ana), 'skipped')
  assert.equal(await createNotifier(supabase, mail, fresh.request).welcome({ ...ana, whatsapp: '' }), 'skipped', 'cadastro incompleto')
})

test('falha no envio libera a reserva para tentar de novo', async () => {
  const backend = fakeBackend({ resendFails: true })
  assert.equal(await createNotifier(supabase, mail, backend.request).welcome(ana), 'failed')
  assert.ok(backend.calls.some((c) => c.method === 'DELETE' && c.url.pathname === '/rest/v1/email_notifications'))
})

test('rodada diária: vence em breve, venceu e boas-vindas pendentes', async () => {
  const auth = (id: string, email: string, created: number, meta: object) => ({ id, email, created_at: iso(created), email_confirmed_at: iso(created), user_metadata: meta })
  const users = [
    auth('u-pix', 'pix@exemplo.com', -40 * DAY, { custom_name: 'Pix', whatsapp: '5581900000001' }),
    auth('u-card', 'card@exemplo.com', -40 * DAY, { custom_name: 'Card', whatsapp: '5581900000002' }),
    auth('u-ended', 'ended@exemplo.com', -40 * DAY, { custom_name: 'Ended', whatsapp: '5581900000003' }),
    auth('u-renewed', 'renewed@exemplo.com', -40 * DAY, { custom_name: 'Renewed', whatsapp: '5581900000004' }),
    auth('u-new', 'new@exemplo.com', -DAY, { custom_name: 'Nova', whatsapp: '5581900000005' }),
    auth('u-new-incomplete', 'incomplete@exemplo.com', -DAY, {}),
  ]
  const subs = [
    { id: 's-pix', user_id: 'u-pix', plan_code: 'pro', paid_until: iso(2 * DAY), entitled: true, billing_mode: 'pix', provider_status: 'approved' },
    { id: 's-card', user_id: 'u-card', plan_code: 'dev', paid_until: iso(2 * DAY), entitled: true, billing_mode: 'recurring', provider_status: 'authorized' },
    { id: 's-ended', user_id: 'u-ended', plan_code: 'devApi', paid_until: iso(-DAY), entitled: true, billing_mode: 'pix', provider_status: 'approved' },
    { id: 's-old', user_id: 'u-renewed', plan_code: 'pro', paid_until: iso(-DAY), entitled: true, billing_mode: 'pix', provider_status: 'approved' },
  ]
  const active = [
    { id: 's-pix', user_id: 'u-pix', paid_until: iso(2 * DAY) },
    { id: 's-card', user_id: 'u-card', paid_until: iso(2 * DAY) },
    { id: 's-new', user_id: 'u-renewed', paid_until: iso(29 * DAY) },
  ]
  const backend = fakeBackend({ users, subs, active })
  const result = await createNotifier(supabase, mail, backend.request).daily(NOW)
  const byRecipient = Object.fromEntries(backend.sent.map((m) => [m.to[0], m.subject]))
  assert.equal(byRecipient['pix@exemplo.com'], 'Seu plano Pro vence em 2 dias')
  assert.equal(byRecipient['ended@exemplo.com'], 'Seu plano Dev + API venceu')
  assert.equal(byRecipient['new@exemplo.com'], 'Nova, sua conta na SixtySix está pronta')
  assert.ok(!byRecipient['card@exemplo.com'], 'cartão ativo renova sozinho')
  assert.ok(!byRecipient['renewed@exemplo.com'], 'quem já renovou não recebe "venceu"')
  assert.ok(!byRecipient['incomplete@exemplo.com'], 'cadastro incompleto não recebe boas-vindas')
  assert.equal(result.counts.expiring.sent, 1)
  const expiringClaim = backend.calls.find((c) => c.method === 'POST' && c.body?.kind === 'expiring')
  assert.equal(expiringClaim!.body.ref, `s-pix:${iso(2 * DAY).slice(0, 10)}`, 'um aviso por período pago')
})

test('rodada diária exige o segredo do cron', async () => {
  assert.equal((await createCronHandler({})('Bearer x')).status, 503)
  const env = { CRON_SECRET: 'segredo', SUPABASE_URL: supabase.url, SUPABASE_SERVICE_ROLE_KEY: supabase.secret }
  assert.equal((await createCronHandler(env)('Bearer errado')).status, 401)
  assert.equal((await createCronHandler(env)(undefined)).status, 401)
  const skipped = await createCronHandler(env)('Bearer segredo')
  assert.equal(skipped.status, 200)
  assert.match(String((skipped.body as any).skipped), /RESEND_API_KEY/)
})

test('entrega registrada avisa o cliente por e-mail, sem a chave', async () => {
  const uid = '22222222-2222-4222-8222-222222222222'
  const id = '11111111-1111-4111-8111-111111111111'
  const sent: any[] = []
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    if (url.host === 'api.resend.com') { sent.push(JSON.parse(String(init.body))); return Response.json({ id: 'email_1' }) }
    if (url.pathname === '/auth/v1/user') return Response.json({ id: 'admin', email: 'alissonmedeiroz007@gmail.com', email_confirmed_at: iso(-DAY) })
    if (url.pathname === `/auth/v1/admin/users/${uid}`) return Response.json({ id: uid, email: 'cliente@exemplo.com', user_metadata: { custom_name: 'Cliente', whatsapp: '5581900000009' } })
    if (url.pathname === '/rest/v1/rpc/admin_register_delivery') return Response.json(id)
    if (url.pathname === '/rest/v1/email_notifications') return Response.json(init.method === 'POST' ? [{ id: 'n1' }] : [])
    throw new Error('Destino inesperado ' + url.pathname)
  }) as typeof fetch
  const env = { SUPABASE_URL: supabase.url, SUPABASE_SERVICE_ROLE_KEY: supabase.secret, VITE_SUPABASE_ANON_KEY: 'public', RESEND_API_KEY: 're_test' }
  const actions = createAdminActions(env, request)
  // Com e-mail configurado o admin pede o código: entra primeiro com o código que chegou por e-mail.
  const challenge = await actions('Bearer ok', { action: 'admin-2fa-send' }) as { challenge: string }
  const code = /\b(\d{6})\b/.exec(sent.pop().text)![1]
  const { session } = await actions('Bearer ok', { action: 'admin-2fa-verify', challenge: challenge.challenge, code }) as { session: string }
  const result = await actions('Bearer ok', {
    action: 'register-delivery',
    delivery: { id, user_id: uid, subscription_id: null, product: '', supplier: '', key_hint: '9f3a', base_url: 'https://api.fornecedor.com', model_id: 'argon-4', notes: null, expires_at: null, replaces: null },
  }, session)
  assert.deepEqual(result, { id, email: 'sent' })
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].to, ['cliente@exemplo.com'])
  assert.match(sent[0].subject, /credencial/)
  assert.match(sent[0].text, /Argon 4/)
})

test('usuário do Supabase vira destinatário com nome e WhatsApp', () => {
  assert.deepEqual(userFromAuth({ id: 'u', email: 'a@b.com', user_metadata: { custom_name: 'Ana', whatsapp: '55' } }), {
    id: 'u', email: 'a@b.com', name: 'Ana', whatsapp: '55', created_at: undefined, email_confirmed_at: null,
  })
})
