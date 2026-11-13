import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RULES, route } from './app.ts'
import accessHandler from '../api/access.ts'
import accountHandler from '../api/account.ts'
import managementHandler from '../api/management.ts'
import mercadoPagoHandler from '../api/mercadopago.ts'
import notificationsHandler from '../api/notifications.ts'

test('VPS: as rotas repetem as reescritas do vercel.json', () => {
  const cases: [string, unknown, string][] = [
    ['/v1/messages?beta=true', accessHandler, '/v1/messages?beta=true&action=proxy&path=%2Fv1%2Fmessages'],
    ['/v1/models', accessHandler, '/v1/models?action=proxy&path=%2Fv1%2Fmodels'],
    ['/glm/v1/messages', accessHandler, '/glm/v1/messages?action=proxy&path=%2Fglm%2Fv1%2Fmessages'],
    ['/api/codex/models', accessHandler, '/api/codex/models?action=proxy&path=%2Fapi%2Fcodex%2Fmodels'],
    ['/api/health', accessHandler, '/api/health?action=health'],
    ['/api/router-status', accessHandler, '/api/router-status?action=router-status'],
    ['/api/account/trial', accessHandler, '/api/account/trial?action=trial'],
    ['/api/account/summary?from=2026-01-01', accountHandler, '/api/account/summary?from=2026-01-01&action=summary'],
    ['/api/billing/checkout', mercadoPagoHandler, '/api/billing/checkout?action=checkout'],
    ['/api/mercadopago/webhook?data.id=1&type=payment', mercadoPagoHandler, '/api/mercadopago/webhook?data.id=1&type=payment'],
    ['/api/management?resource=users', managementHandler, '/api/management?resource=users'],
    ['/api/notifications', notificationsHandler, '/api/notifications'],
  ]
  for (const [input, handler, url] of cases) {
    const found = route(input)
    assert.ok(found, input)
    assert.equal(found.handler, handler, input)
    assert.equal(found.url, url, input)
  }
})

test('VPS: páginas do site não caem em nenhuma função', () => {
  for (const page of ['/', '/login', '/dashboard', '/adminxv1', '/assets/index-abc.js', '/robots.txt', '/v1x', '/api/accountx']) {
    assert.equal(route(page), null, page)
  }
  assert.ok(RULES.length >= 14)
})

test('VPS: /healthz diz ao Caddy que o processo pode receber pedidos (e não passa por nenhuma função)', async () => {
  const { createServer } = await import('node:http')
  const { handle } = await import('./app.ts')
  const server = createServer(handle)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const { port } = server.address() as { port: number }
    const response = await fetch(`http://127.0.0.1:${port}/healthz`)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
