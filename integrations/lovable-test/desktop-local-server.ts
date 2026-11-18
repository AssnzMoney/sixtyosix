/** Usa o handler REAL da Six, com banco e configurações isolados em memória. */
import { createServer } from 'node:http'
import { appendFileSync, readFileSync, existsSync } from 'node:fs'
const diagnostic = (value: unknown) => appendFileSync('C:/Users/Alysson/AppData/Local/Temp/six-desktop-diagnostic.log', JSON.stringify({ at: new Date().toISOString(), ...value as object }) + '\n')
import { join } from 'node:path'
import { nativeBody, NATIVE_BODY_LIMIT } from './native-messages.server.ts'
import { localBudgetExhausted, localBridgeFailure } from './local-test-errors.ts'
import { createHash, randomBytes } from 'node:crypto'
import accessHandler from '../../api/access.ts'
import { clearRouterCache, sealSecret } from '../../server/router.ts'

const mock = process.argv.includes('--mock')
const bridgeKey = mock ? 'local-simulated-key-1234567890123456' : process.env.SIX_TEST_BRIDGE_KEY
if (!bridgeKey || bridgeKey.length < 32) throw Error('Configure SIX_TEST_BRIDGE_KEY no ambiente local; não passe como argumento.')
const db = 'https://six-local-test.invalid'
const dbSecret = 'sb_secret_' + randomBytes(24).toString('hex')
const clientKey = process.env.SIX_LOCAL_CLIENT_KEY || 'sk-rt-' + randomBytes(24).toString('hex')
const providerId = '33333333-3333-4333-8333-333333333333'
const clientId = '44444444-4444-4444-8444-444444444444'
const alias = 'claude-opus-5-5'
const bridgeDispatcher = 'https://six-bridge-dispatcher.local/v1'

const bridgesFile = join(process.cwd(), 'integrations/lovable-test/bridges.txt')
function getBridgePool(): string[] {
    const fromEnv = process.env.SIX_TEST_BRIDGE_URLS
        ? process.env.SIX_TEST_BRIDGE_URLS.split(',').map(s => s.trim()).filter(Boolean)
        : []
    if (fromEnv.length > 0) return fromEnv

    if (existsSync(bridgesFile)) {
        try {
            const lines = readFileSync(bridgesFile, 'utf8')
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#'))
            if (lines.length > 0) return lines
        } catch { }
    }
    return [process.env.SIX_TEST_BRIDGE_URL || 'https://bright-byte-bulletin.lovable.app/api/public/six-test/v1']
}
let activeBridgeIndex = 0

const realFetch = globalThis.fetch
process.env.SUPABASE_URL = db
process.env.SUPABASE_SERVICE_ROLE_KEY = dbSecret
const usage: unknown[] = []
const initialCalls = Number(process.env.SIX_LOCAL_INITIAL_CALLS ?? 0)
const maxCalls = Number(process.env.SIX_LOCAL_MAX_CALLS ?? 10000)
if (!Number.isInteger(initialCalls) || !Number.isInteger(maxCalls) || initialCalls < 0 || maxCalls < initialCalls) throw Error('Limites locais inválidos.')
let externalCalls = initialCalls, bridgeStatus: number | undefined
clearRouterCache()

globalThis.fetch = (async (input, init = {}) => {
    const url = String(input)
    if (url.startsWith(db + '/rest/v1/router_models?')) return Response.json([{ alias, label: 'Opus teste local', upstream_model: 'anthropic/claude-opus-5-5', in_pro: false, provider: { id: providerId, name: 'Lovable local test', base_url: bridgeDispatcher, encrypted_key: sealSecret(bridgeKey, dbSecret, 'router:provider:' + providerId), enabled: true } }])
    if (url.startsWith(db + '/rest/v1/router_keys?')) {
        const hash = createHash('sha256').update(clientKey).digest('hex')
        return Response.json(url.includes(hash) ? [{ gateway_client_id: clientId, models: [alias], expires_at: new Date(Date.now() + 300000).toISOString(), revoked_at: null }] : [])
    }
    if (url.startsWith(db + '/rest/v1/gateway_usage')) { usage.push(JSON.parse(String(init.body))); return new Response(null, { status: 201 }) }
    if (url === db + '/rest/v1/rpc/gateway_gate') return Response.json({ ok: true, leased: true })
    if (url.startsWith(db + '/rest/v1/rpc/gateway_')) return new Response(null, { status: 204 })
    if (url === bridgeDispatcher + '/messages' && init.method === 'POST') {
        const payload = JSON.parse(String(init.body))
        const translated = nativeBody(payload)
        if (externalCalls >= maxCalls) return localBudgetExhausted()
        externalCalls++

        if (mock) {
            return Response.json({ id: 'msg_simulated', type: 'message', role: 'assistant', model: 'anthropic/claude-opus-5-5', content: [{ type: 'text', text: 'SIMULADO_LOCAL' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } })
        }

        const pool = getBridgePool()
        let response: Response | null = null
        let attempts = 0

        while (attempts < pool.length) {
            const targetBridge = pool[activeBridgeIndex % pool.length].replace(/\/$/, '')
            let curRes = await realFetch(targetBridge + '/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bridgeKey },
                body: JSON.stringify(translated),
                redirect: 'manual',
                signal: AbortSignal.timeout(65000)
            })

            // Fallback de tokens se a versão na Lovable estiver limitada a 1024
            if (curRes.status === 400 && translated.max_tokens > 1024) {
                diagnostic({ phase: 'bridge-fallback-tokens', bridge: targetBridge, originalMaxTokens: translated.max_tokens })
                curRes = await realFetch(targetBridge + '/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bridgeKey },
                    body: JSON.stringify({ ...translated, max_tokens: 1024 }),
                    redirect: 'manual',
                    signal: AbortSignal.timeout(65000)
                })
            }

            // Failover se o workspace atual estiver sem saldo (402 ou 502 com upstream 402)
            const isExhausted = curRes.status === 402 || (curRes.status === 502 && curRes.headers.get('x-six-test-upstream-status') === '402')
            if (isExhausted && pool.length > 1 && attempts < pool.length - 1) {
                const nextIndex = (activeBridgeIndex + 1) % pool.length
                console.log(`[FAILOVER] Workspace ${targetBridge} esgotou saldo (402). Alternando para ${pool[nextIndex]}...`)
                diagnostic({ phase: 'bridge-failover', from: targetBridge, to: pool[nextIndex], reason: '402_QUOTA_EXHAUSTED' })
                activeBridgeIndex = nextIndex
                attempts++
                continue
            }

            response = curRes
            bridgeStatus = response.status
            diagnostic({ phase: 'bridge-response', bridge: targetBridge, status: response.status, externalCalls, contentType: response.headers.get('content-type') })
            break
        }

        if (!response!.ok) {
            const errorText = await response!.text().catch(() => '')
            diagnostic({ phase: 'bridge-error-detail', status: response!.status, errorText, headers: Object.fromEntries(response!.headers.entries()) })
            return localBridgeFailure(response!.status)
        }
        return response!
    }
    throw Error('Destino bloqueado pelo isolamento do teste local.')
}) as typeof fetch

const server = createServer(async (req, res) => {
    const u = new URL(req.url || '/', 'http://localhost')
    const summary: any = { method: req.method, path: u.pathname }
    res.on('finish', () => diagnostic({ ...summary, status: res.statusCode, externalCalls, bridgeStatus }))
    try {
        if (u.pathname === '/' && ['GET', 'HEAD'].includes(req.method || '')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, mode: 'six-local-test' })); return }
        if (req.method === 'POST') {
            const chunks: Buffer[] = []; let size = 0
            for await (const part of req) { const bytes = Buffer.from(part); size += bytes.length; if (size > NATIVE_BODY_LIMIT) { res.statusCode = 413; res.end(); return } chunks.push(bytes) }
            const raw = Buffer.concat(chunks); (req as any).body = raw
            try { const body = JSON.parse(raw.toString('utf8')); Object.assign(summary, { model: body.model, stream: body.stream, tools: body.tools?.length || 0, messageRoles: body.messages?.map((m: any) => m.role), contentTypes: body.messages?.map((m: any) => Array.isArray(m.content) ? m.content.map((c: any) => c.type) : typeof m.content), fixedPrompt: body.messages?.length === 1 && (body.messages[0].content === 'Responda apenas OK' || (Array.isArray(body.messages[0].content) && body.messages[0].content.every((c: any) => c.type === 'text') && body.messages[0].content.map((c: any) => c.text).join('') === 'Responda apenas OK')) }) } catch { }
        }
        if (u.pathname.startsWith('/v1/')) req.url = '/api/access?action=proxy&path=' + encodeURIComponent(u.pathname)
        await accessHandler(req, res)
    } catch { if (!res.headersSent) { res.statusCode = 500; res.end('Local test error') } else res.destroy() }
})

await new Promise<void>(resolve => server.listen(17866, '127.0.0.1', resolve))
console.log('READY http://127.0.0.1:17866')
const stop = (reason?: string) => { console.log('STOPPING SERVER:', reason); server.closeAllConnections(); server.close(() => process.exit(0)) }
process.on('SIGTERM', () => stop('SIGTERM'))
process.on('SIGINT', () => stop('SIGINT'))
// Rodar continuamente sem timeout automático; se configurado SIX_LOCAL_TIMEOUT_MS, respeita o valor
const timeoutMs = process.env.SIX_LOCAL_TIMEOUT_MS ? Number(process.env.SIX_LOCAL_TIMEOUT_MS) : 0
if (timeoutMs > 0) setTimeout(() => stop('TIMEOUT'), timeoutMs)
