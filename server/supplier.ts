/**
 * Repasse para provedores do Roteador (server/router.ts): monta a URL, troca o apelido pelo
 * modelo do provedor, conta os tokens da resposta e grava o consumo em gateway_usage,
 * a mesma tabela do consumo das chaves — então tudo aparece no admin e no painel do cliente.
 */

type Env = Record<string, string | undefined>
export type Usage = { input: number; output: number }
export type UsageRow = { client_id: string; requested_alias: string; status_code: number; input_tokens: number; output_tokens: number; latency_ms: number }

/** Junta a URL do fornecedor com o caminho pedido sem duplicar o /v1. */
export function supplierUrl(base: string, path: string, search = ''): string {
  const target = new URL(base)
  const baseSegs = target.pathname.split('/').filter(Boolean)
  let pathSegs = path.split('/').filter(Boolean)
  for (let n = Math.min(baseSegs.length, pathSegs.length); n > 0; n--) {
    if (baseSegs.slice(-n).join('/') === pathSegs.slice(0, n).join('/')) { pathSegs = pathSegs.slice(n); break }
  }
  target.pathname = '/' + [...baseSegs, ...pathSegs].join('/')
  target.search = search
  return target.toString()
}

/**
 * Troca o apelido pelo id do fornecedor. Em streams do chat da OpenAI pede o consumo no
 * último evento (include_usage); esse evento extra é retirado antes de chegar ao cliente.
 */
export function supplierRequestBody(payload: Record<string, unknown>, path: string, supplierId: string) {
  const next: Record<string, unknown> = { ...payload, model: supplierId }
  const options = next.stream_options && typeof next.stream_options === 'object' ? next.stream_options as Record<string, unknown> : {}
  const injectedUsage = next.stream === true && path.endsWith('/chat/completions') && options.include_usage !== true
  if (injectedUsage) next.stream_options = { ...options, include_usage: true }
  return { body: JSON.stringify(next), injectedUsage }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Lê tokens nos formatos Anthropic (messages), OpenAI (chat e responses) e Gemini. */
export function collectUsage(value: unknown, usage: Usage) {
  if (!value || typeof value !== 'object') return
  const obj = value as Record<string, any>
  const u = obj.usage || obj.message?.usage || obj.response?.usage || obj.usageMetadata
  if (!u || typeof u !== 'object') return
  const input = num(u.prompt_tokens) ?? (u.input_tokens != null
    ? (num(u.input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0) + (num(u.cache_read_input_tokens) ?? 0)
    : num(u.promptTokenCount))
  const output = num(u.completion_tokens) ?? num(u.output_tokens) ?? num(u.candidatesTokenCount)
  // Alguns formatos repetem o total acumulado ao longo do stream: vale o maior.
  if (input != null) usage.input = Math.max(usage.input, input)
  if (output != null) usage.output = Math.max(usage.output, output)
}

/**
 * Repassa a resposta do fornecedor ao cliente contando os tokens no caminho.
 * Streams são repassados evento a evento; respostas comuns, de uma vez no final.
 */
export class UsageTap {
  readonly usage: Usage = { input: 0, output: 0 }
  private buffer = ''
  private readonly decoder = new TextDecoder()
  private readonly opts: { stream: boolean; alias: string; supplierId: string; dropInjectedUsage: boolean }
  constructor(opts: { stream: boolean; alias: string; supplierId: string; dropInjectedUsage: boolean }) { this.opts = opts }

  push(chunk: Uint8Array): string {
    this.buffer += this.decoder.decode(chunk, { stream: true })
    if (!this.opts.stream) return ''
    this.buffer = this.buffer.replace(/\r\n/g, '\n')
    let out = '', end: number
    while ((end = this.buffer.indexOf('\n\n')) !== -1) {
      out += this.event(this.buffer.slice(0, end))
      this.buffer = this.buffer.slice(end + 2)
    }
    return out
  }

  end(): string {
    this.buffer += this.decoder.decode()
    const rest = this.buffer
    this.buffer = ''
    if (this.opts.stream) return rest.trim() ? this.event(rest.replace(/\n+$/, '')) : ''
    try { collectUsage(JSON.parse(rest), this.usage) } catch { /* resposta que não é JSON: conta só a chamada */ }
    return this.hide(rest)
  }

  private event(text: string): string {
    const data = text.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
    if (data && data !== '[DONE]' && data.includes('"usage')) {
      try {
        const obj = JSON.parse(data)
        collectUsage(obj, this.usage)
        if (this.opts.dropInjectedUsage && Array.isArray(obj.choices) && !obj.choices.length && obj.usage) return ''
      } catch { /* evento que não é JSON: só repassa */ }
    }
    return this.hide(text) + '\n\n'
  }

  /** O cliente vê o apelido que comprou, nunca o id interno do fornecedor. */
  private hide(text: string): string {
    return text
      .split(JSON.stringify(this.opts.supplierId)).join(JSON.stringify(this.opts.alias))
      .replace(/("model"\s*:\s*")(?:anthropic|openai|google)\//g, '$1')
  }
}

/** Grava a chamada em gateway_usage. Falhar aqui nunca derruba a resposta do cliente. */
export async function recordUsage(env: Env, request: typeof fetch, row: UsageRow) {
  const base = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !secret) return
  try {
    const response = await request(`${base}/rest/v1/gateway_usage`, {
      method: 'POST',
      headers: { apikey: secret, ...(!secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${secret}` } : {}), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) console.error('gateway_usage recusou o registro', response.status, (await response.text().catch(() => '')).slice(0, 300))
  } catch (error) {
    console.error('Falha ao gravar gateway_usage', error)
  }
}
