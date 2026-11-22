// Servidor da SixtySix fora da Vercel (VPS): as mesmas funções de api/ e o site de dist/.
// Rodar: node --env-file=.env --experimental-strip-types --import ./scripts/test-register.mjs server/start.ts
// As regras de rota copiam o vercel.json (rewrites), na mesma ordem.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import accessHandler from '../api/access.js'
import accountHandler from '../api/account.js'
import managementHandler from '../api/management.js'
import mercadoPagoHandler from '../api/mercadopago.js'
import notificationsHandler from '../api/notifications.js'

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown | Promise<unknown>
type Rule = { pattern: RegExp; handler: Handler; target: (match: RegExpMatchArray) => Record<string, string> }

/** Reescritas do vercel.json. `target` devolve os parâmetros que a Vercel acrescentava (action, path). */
export const RULES: Rule[] = [
  { pattern: /^\/api\/mercadopago\/webhook\/?$/, handler: mercadoPagoHandler, target: () => ({}) },
  { pattern: /^\/api\/billing\/([^/]+)\/?$/, handler: mercadoPagoHandler, target: (m) => ({ action: m[1] }) },
  { pattern: /^\/api\/account\/trial\/?$/, handler: accessHandler, target: () => ({ action: 'trial' }) },
  { pattern: /^\/api\/account\/([^/]+)\/?$/, handler: accountHandler, target: (m) => ({ action: m[1] }) },
  { pattern: /^(\/glm\/v1(?:\/.*)?)$/, handler: accessHandler, target: (m) => ({ action: 'proxy', path: m[1] }) },
  { pattern: /^(\/v1(?:\/.*)?)$/, handler: accessHandler, target: (m) => ({ action: 'proxy', path: m[1] }) },
  { pattern: /^(\/api\/codex(?:\/.*)?)$/, handler: accessHandler, target: (m) => ({ action: 'proxy', path: m[1] }) },
  { pattern: /^\/api\/health\/?$/, handler: accessHandler, target: () => ({ action: 'health' }) },
  { pattern: /^\/api\/router-status\/?$/, handler: accessHandler, target: () => ({ action: 'router-status' }) },
  // Rotas que a Vercel resolvia pelo nome do arquivo em api/.
  { pattern: /^\/api\/access\/?$/, handler: accessHandler, target: () => ({}) },
  { pattern: /^\/api\/account\/?$/, handler: accountHandler, target: () => ({}) },
  { pattern: /^\/api\/management\/?$/, handler: managementHandler, target: () => ({}) },
  { pattern: /^\/api\/mercadopago\/?$/, handler: mercadoPagoHandler, target: () => ({}) },
  { pattern: /^\/api\/notifications\/?$/, handler: notificationsHandler, target: () => ({}) },
]

/** Acha a função e monta a URL que ela espera (como a Vercel fazia: pasta da função + query da reescrita). */
export function route(rawUrl: string) {
  const url = new URL(rawUrl || '/', 'http://localhost')
  for (const rule of RULES) {
    const match = url.pathname.match(rule.pattern)
    if (!match) continue
    const params = new URLSearchParams(url.search)
    for (const [key, value] of Object.entries(rule.target(match))) params.set(key, value)
    const query = params.toString()
    return { handler: rule.handler, url: `${url.pathname}${query ? `?${query}` : ''}` }
  }
  return null
}

/* ------------------------------ Site (dist/) ------------------------------ */

const DIST = resolve(process.env.SIXTYSIX_DIST || 'dist')
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
}

function sendFile(res: ServerResponse, file: string, method: string, immutable: boolean) {
  const size = statSync(file).size
  res.statusCode = 200
  res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream')
  res.setHeader('Content-Length', size)
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (method === 'HEAD') return void res.end()
  createReadStream(file).pipe(res)
}

/** Arquivo de dist/ se existir; senão o index.html (o site cuida da rota), como o "/(.*)" do vercel.json. */
export function serveSite(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return void res.end()
  }
  let pathname = '/'
  try { pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname) } catch { /* fica na raiz */ }
  const file = normalize(join(DIST, pathname))
  if (file.startsWith(DIST + sep) || file === DIST) {
    try {
      if (statSync(file).isFile()) return sendFile(res, file, req.method, pathname.startsWith('/assets/'))
    } catch { /* não existe: cai no index.html */ }
  }
  try {
    sendFile(res, join(DIST, 'index.html'), req.method, false)
  } catch {
    res.statusCode = 503
    res.end('Site em atualização. Tente de novo em instantes.')
  }
}

/* --------------------------------- Servidor -------------------------------- */

/**
 * Processo terminando (publicação): não recebe pedidos novos. O Caddy pergunta /healthz aos dois processos
 * (portas 8080 e 8081) e manda o tráfego só para quem responde 200.
 */
let draining = false

export function handle(req: IncomingMessage, res: ServerResponse) {
  // Só o Caddy chega aqui (o /healthz de fora vai para o site): diz se este processo pode receber pedidos.
  if ((req.url || '').split('?')[0] === '/healthz') {
    res.statusCode = draining ? 503 : 200
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return void res.end(draining ? 'terminando' : 'ok')
  }
  const target = route(req.url || '/')
  if (!target) return serveSite(req, res)
  req.url = target.url
  Promise.resolve(target.handler(req, res)).catch((error) => {
    console.error('Falha na rota', target.url.split('?')[0], error)
    if (!res.headersSent) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Serviço temporariamente indisponível.' }))
    } else res.destroy()
  })
}

/** Sobe o servidor (server/start.ts chama isto; os testes importam só as rotas). */
export function start() {
  const port = Number(process.env.PORT || 8080)
  const host = process.env.HOST || '127.0.0.1'
  const server = createServer(handle)
  // Respostas longas em streaming (Claude Code): sem o teto de 300 s da Vercel.
  server.requestTimeout = 0
  server.headersTimeout = 60_000
  server.keepAliveTimeout = 65_000
  server.listen(port, host, () => console.log(`SixtySix no ar em http://${host}:${port}`))
  // Na publicação (deploy/deploy.sh reinicia um processo de cada vez): para de aceitar pedidos novos, que o
  // Caddy passa para o outro processo, e espera as respostas em andamento terminarem, até DRAIN_MS (10 min).
  // O kill_timeout do PM2 (deploy/ecosystem.config.cjs) é maior que isso, para não cortar uma resposta longa.
  const drainMs = Number(process.env.DRAIN_MS || 10 * 60_000)
  const stop = (signal: string) => {
    if (draining) return
    draining = true
    console.log(`${signal}: sem pedidos novos; esperando as respostas em andamento terminarem`)
    server.close(() => {
      console.log('Respostas em andamento terminaram; saindo')
      process.exit(0)
    })
    // Conexões paradas (keep-alive) não seguram a saída.
    server.closeIdleConnections()
    setInterval(() => server.closeIdleConnections(), 1000).unref()
    setTimeout(() => {
      console.log('Tempo de espera esgotado; saindo')
      process.exit(0)
    }, drainMs).unref()
  }
  process.on('SIGTERM', () => stop('SIGTERM'))
  process.on('SIGINT', () => stop('SIGINT'))
  return server
}
