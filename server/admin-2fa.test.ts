import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAdminActions, createAdminService } from '../api/management.ts'

const base = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_server', VITE_SUPABASE_ANON_KEY: 'public' }
const withEmail = { ...base, RESEND_API_KEY: 're_test' }

/** Supabase e Resend simulados. `who` troca a conta logada; o último e-mail enviado fica em `mail`. */
function fixture(env: Record<string, string>) {
  const state = { who: { id: 'admin-1', email: 'alissonmedeiroz007@gmail.com' }, mail: null as null | { to: string[]; subject: string; text: string } }
  const request = (async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    if (url.endsWith('/auth/v1/user')) return Response.json({ ...state.who, email_confirmed_at: '2026-01-01T00:00:00Z' })
    if (url.includes('/auth/v1/admin/users')) return Response.json({ users: [{ id: 'u1', email: 'cliente@example.com' }] })
    if (url === 'https://api.resend.com/emails') {
      state.mail = JSON.parse(String(init.body))
      return Response.json({ id: 'email-1' })
    }
    return Response.json([])
  }) as typeof fetch
  return { state, read: createAdminService(env, request), act: createAdminActions(env, request) }
}
const codeFrom = (text: string) => /\b(\d{6})\b/.exec(text)?.[1] || ''

test('admin com e-mail configurado: sem o código, não entra', async () => {
  const { read } = fixture(withEmail)
  await assert.rejects(read('Bearer t', new URLSearchParams({ resource: 'users' })), (e: any) => e.status === 401 && e.code === 'admin_2fa_required')
})

test('admin: código chega por e-mail, código errado é recusado e o certo libera o aparelho', async () => {
  const { state, read, act } = fixture(withEmail)
  const sent = await act('Bearer t', { action: 'admin-2fa-send' }) as { challenge: string; sentTo: string }
  assert.deepEqual(state.mail!.to, ['alissonmedeiroz007@gmail.com'])
  assert.equal(sent.sentTo, 'al***@gmail.com')
  const code = codeFrom(state.mail!.text)
  assert.equal(code.length, 6)
  assert.ok(!sent.challenge.includes(code), 'o código não vai para o navegador')
  const wrong = code === '000000' ? '111111' : '000000'
  await assert.rejects(act('Bearer t', { action: 'admin-2fa-verify', challenge: sent.challenge, code: wrong }), /incorreto/)
  const ok = await act('Bearer t', { action: 'admin-2fa-verify', challenge: sent.challenge, code }) as { session: string; expiresAt: string }
  assert.ok(Date.parse(ok.expiresAt) - Date.now() > 29 * 86400000, 'vale 30 dias')
  const page = await read('Bearer t', new URLSearchParams({ resource: 'users' }), ok.session) as { twoFactor: string }
  assert.equal(page.twoFactor, 'on')
  // Ações também exigem a sessão do aparelho.
  await assert.rejects(act('Bearer t', { action: 'router-key-delete', id: 'x' }), (e: any) => e.code === 'admin_2fa_required')
  // A sessão de um administrador não vale para o outro.
  state.who = { id: 'admin-2', email: 'alysontrx@gmail.com' }
  await assert.rejects(read('Bearer t', new URLSearchParams({ resource: 'users' }), ok.session), (e: any) => e.code === 'admin_2fa_required')
})

test('admin: sessão adulterada ou desafio de outra conta não passam', async () => {
  const { state, read, act } = fixture(withEmail)
  const sent = await act('Bearer t', { action: 'admin-2fa-send' }) as { challenge: string }
  const code = codeFrom(state.mail!.text)
  const ok = await act('Bearer t', { action: 'admin-2fa-verify', challenge: sent.challenge, code }) as { session: string }
  const [body, signature] = ok.session.split('.')
  const forged = Buffer.from(JSON.stringify({ kind: 'session', u: 'admin-1', e: 'alissonmedeiroz007@gmail.com', exp: Date.now() + 9e12 })).toString('base64url')
  await assert.rejects(read('Bearer t', new URLSearchParams({ resource: 'users' }), `${forged}.${signature}`), (e: any) => e.code === 'admin_2fa_required')
  await assert.rejects(read('Bearer t', new URLSearchParams({ resource: 'users' }), `${body}.x${signature.slice(1)}`), (e: any) => e.code === 'admin_2fa_required')
  // O desafio de um admin não serve para o outro, nem com o código certo.
  state.who = { id: 'admin-2', email: 'alysontrx@gmail.com' }
  await assert.rejects(act('Bearer t', { action: 'admin-2fa-verify', challenge: sent.challenge, code }), /venceu/)
})

test('sem envio de e-mail configurado, o admin abre sem código (para ninguém ficar trancado)', async () => {
  const { read, act } = fixture(base)
  const page = await read('Bearer t', new URLSearchParams({ resource: 'users' })) as { twoFactor: string }
  assert.equal(page.twoFactor, 'off')
  assert.deepEqual(await act('Bearer t', { action: 'admin-2fa-send' }), { twoFactor: 'off' })
})
