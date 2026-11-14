/**
 * Proteção contra sobrecarga do gateway (supabase/gateway-guard.sql).
 * Sem limite diário: só chamadas por minuto e respostas simultâneas por chave, mais bloqueio de IP.
 * Acima do limite o cliente recebe 429 com Retry-After e a ferramenta tenta de novo sozinha.
 * Se a migração não estiver aplicada ou o banco falhar, a chamada segue (nunca derruba o serviço).
 */
import { createHash } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'

type Env = Record<string, string | undefined>

export type GateResult =
  | { ok: true; leased: boolean }
  | { ok: false; status: number; message: string; retryAfter?: number }

const MESSAGES: Record<string, { status: number; message: string }> = {
  rate: { status: 429, message: 'Muitas chamadas em pouco tempo. Aguarde alguns segundos: a sua ferramenta tenta de novo sozinha.' },
  busy: { status: 429, message: 'Você já tem várias respostas em andamento nesta chave. Aguarde uma terminar.' },
  ip_blocked: { status: 403, message: 'Acesso bloqueado a partir deste endereço. Fale com a SixtySix pelo WhatsApp: (81) 99237-6036.' },
  ip_pending: { status: 403, message: 'Este endereço (IP) ainda não foi liberado para a sua chave. Peça a liberação pelo WhatsApp: (81) 99237-6036.' },
  ip_in_use: { status: 403, message: 'Sua chave está sendo usada em outro endereço agora. Se você trocou de rede, ela passa para cá sozinha depois de alguns minutos sem uso no endereço antigo.' },
  ip_swap_limit: { status: 403, message: 'Esta chave trocou de endereço muitas vezes nas últimas 24 horas. Fale com a SixtySix pelo WhatsApp: (81) 99237-6036.' },
}

function database(env: Env) {
  const url = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  return url?.startsWith('https://') && secret ? { url, secret } : null
}
const headersFor = (secret: string) => ({
  apikey: secret,
  ...(!secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${secret}` } : {}),
  'Content-Type': 'application/json',
})

/** IP de quem chamou, como a Vercel informa (x-real-ip ou o primeiro de x-forwarded-for). */
export function clientIp(headers: IncomingHttpHeaders, fallback = '') {
  const real = headers['x-real-ip']
  if (typeof real === 'string' && real.trim()) return real.trim().slice(0, 64)
  const forwarded = headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim()
  return (first || fallback).slice(0, 64)
}

export type Device = { id: string | null; label: string | null }
/**
 * Dispositivo de quem chamou. Nenhuma ferramenta manda dados do hardware; o que dá para usar:
 * - Claude Code: cada instalação manda um id próprio em metadata.user_id ("user_<hash>_account_..._session_...").
 *   É o sinal forte ("cc:"): o mesmo id em outro IP é a mesma máquina mudando de rede.
 * - Outras ferramentas: o nome no user-agent e o sistema/processador (x-stainless-os/arch, ou o que o
 *   Codex põe no user-agent). Sinal fraco ("ua:"): aparece no admin, mas nunca libera troca de IP sozinho.
 */
export function deviceOf(headers: IncomingHttpHeaders, payload?: Record<string, unknown> | null): Device {
  const head = (name: string) => {
    const value = headers[name]
    return (Array.isArray(value) ? value[0] : value || '').trim().slice(0, 200)
  }
  const ua = head('user-agent')
  const tool = /claude-cli|claude-code/i.test(ua) ? 'Claude Code' : /codex/i.test(ua) ? 'Codex' : /opencode/i.test(ua) ? 'OpenCode' : /cline/i.test(ua) ? 'Cline' : (ua.split(/[\/ ]/)[0] || '').slice(0, 30)
  const inside = /\(([^)]*)\)/.exec(ua)?.[1] || ''
  const os = head('x-stainless-os') || (/windows|mac ?os|darwin|linux/i.exec(inside)?.[0] ?? '')
  const label = [tool, [os, head('x-stainless-arch')].filter(Boolean).join(' ')].filter(Boolean).join(' · ').slice(0, 120) || null
  const meta = payload && typeof payload.metadata === 'object' && payload.metadata ? (payload.metadata as Record<string, unknown>).user_id : null
  const install = typeof meta === 'string' ? /^user_([0-9a-f]{16,128})(?:_|$)/i.exec(meta)?.[1] : undefined
  if (install) return { id: 'cc:' + createHash('sha256').update(install.toLowerCase()).digest('hex').slice(0, 32), label }
  if (!label) return { id: null, label: null }
  return { id: 'ua:' + createHash('sha256').update([tool, head('x-stainless-os') || inside, head('x-stainless-arch')].join('|').toLowerCase()).digest('hex').slice(0, 32), label }
}

let warned = false
let legacyGate = false
export async function gateRequest(env: Env, request: typeof fetch, input: { clientId: string; ip: string; requestId: string; device?: Device }): Promise<GateResult> {
  const db = database(env)
  if (!db || !input.clientId) return { ok: true, leased: false }
  try {
    const device = legacyGate ? {} : { p_device: input.device?.id ?? null, p_device_label: input.device?.label ?? null }
    const response = await request(`${db.url}/rest/v1/rpc/gateway_gate`, {
      method: 'POST',
      headers: headersFor(db.secret),
      body: JSON.stringify({ p_client: input.clientId, p_ip: input.ip || null, p_request: input.requestId, ...device }),
      signal: AbortSignal.timeout(5000),
    })
    // Sem supabase/auto-delivery.sql a função ainda não aceita o dispositivo: volta para a chamada antiga.
    if (response.status === 404 && !legacyGate) {
      legacyGate = true
      return gateRequest(env, request, input)
    }
    if (!response.ok) {
      if (!warned) { warned = true; console.error('Proteção do gateway indisponível (aplique supabase/gateway-guard.sql?)', response.status) }
      return { ok: true, leased: false }
    }
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean; reason?: string; retry_after?: number; leased?: boolean }
    if (result.ok !== false) return { ok: true, leased: result.leased === true }
    const known = MESSAGES[String(result.reason)] || MESSAGES.rate
    const retryAfter = Number.isFinite(result.retry_after) ? Math.max(1, Math.min(120, Number(result.retry_after))) : undefined
    return { ok: false, status: known.status, message: known.message, ...(retryAfter ? { retryAfter } : {}) }
  } catch (error) {
    console.error('Falha na proteção do gateway; a chamada segue.', error)
    return { ok: true, leased: false }
  }
}

/** Libera a vaga de resposta simultânea. Erros são ignorados: a vaga expira sozinha. */
export async function releaseRequest(env: Env, request: typeof fetch, requestId: string) {
  const db = database(env)
  if (!db) return
  await request(`${db.url}/rest/v1/rpc/gateway_release`, {
    method: 'POST',
    headers: headersFor(db.secret),
    body: JSON.stringify({ p_request: requestId }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined)
}

/* --------------------------- validação do admin --------------------------- */

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const IPV6 = /^[0-9a-f:]{2,39}$/i

/** IP ou faixa (CIDR) aceitos para bloqueio: 1.2.3.4, 1.2.3.0/24, 2001:db8::1, 2001:db8::/32. */
export function validNetwork(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase()
  const [address, prefix, extra] = text.split('/')
  if (extra !== undefined || !address) return null
  const v4 = IPV4.test(address)
  const v6 = !v4 && IPV6.test(address) && address.includes(':') && (address.match(/::/g) || []).length <= 1
  if (!v4 && !v6) return null
  if (prefix !== undefined) {
    if (!/^\d{1,3}$/.test(prefix)) return null
    const bits = Number(prefix)
    if (bits > (v4 ? 32 : 128) || bits < (v4 ? 8 : 16)) return null
  }
  return text
}

/** Limite opcional: inteiro positivo ou null (sem limite / usa o padrão). */
export function validLimit(value: unknown, max: number): number | null | undefined {
  if (value === null || value === '' || value === undefined) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined
}
