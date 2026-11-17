import { findRoute, loadRouter } from '../router.ts'
import { supplierUrl } from '../supplier.ts'
import { SUPPORT_PROMPT } from './knowledge.ts'

/**
 * Cérebro do agente de suporte do Discord: monta a conversa, chama o modelo pelo nosso Roteador (mesmo fornecedor e
 * keys do gateway, sem passar pelo limite de um cliente) e devolve o texto e se precisa chamar a equipe.
 * As partes sem rede (chave vazada, divisão da mensagem, marca de equipe, limite por pessoa) ficam separadas e testadas.
 */
type Env = Record<string, string | undefined>
export type Turn = { role: 'user' | 'assistant'; name?: string; content: string }

/** Chave da SixtySix colada no chat (sk-rt-, sk-sp-, sk-sx-, sk-flg-). O bot apaga a mensagem e avisa. */
const KEY_PATTERN = /\bsk-(?:rt|sp|sx|flg)-[A-Za-z0-9_-]{12,}/
export const hasKey = (text: string) => KEY_PATTERN.test(text)

/** Marca que o modelo põe no fim quando a equipe precisa assumir (knowledge.ts explica quando). */
export const ESCALATE = '[[EQUIPE]]'
export function parseReply(text: string) {
  const escalate = text.includes(ESCALATE)
  const clean = text.split(ESCALATE).join('').replace(/\n{3,}/g, '\n\n').trim()
  return { text: clean, escalate }
}

/** Divide em pedaços que cabem no Discord (2000 caracteres), sem quebrar bloco de código no meio. */
export function splitMessage(text: string, limit = 1900): string[] {
  const chunks: string[] = []
  let current = ''
  let fence = ''
  const push = () => {
    if (!current.trim()) return
    chunks.push(fence ? `${current}\n\`\`\`` : current)
    current = fence ? fence : ''
  }
  for (const raw of text.split('\n')) {
    // Linha sozinha maior que o limite: corta em pedaços.
    const parts = raw.length > limit ? raw.match(new RegExp(`[\\s\\S]{1,${limit}}`, 'g')) || [raw] : [raw]
    for (const line of parts) {
      if (current && current.length + line.length + 1 > limit) push()
      current = current ? `${current}\n${line}` : line
      if (/^\s*```/.test(line)) fence = fence ? '' : line.trim()
    }
  }
  if (current.trim() && current !== fence) chunks.push(current)
  return chunks
}

/** Histórico para o modelo: as mensagens mais novas que cabem no orçamento, com o nome de quem falou. */
export function toMessages(history: Turn[], budget = 14000) {
  const kept: Turn[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i]
    const text = t.content.trim()
    if (!text) continue
    if (used + text.length > budget && kept.length) break
    used += text.length
    kept.unshift({ ...t, content: text.slice(0, budget) })
  }
  // A conversa precisa começar pela pessoa.
  while (kept.length && kept[0].role === 'assistant') kept.shift()
  return [
    { role: 'system', content: SUPPORT_PROMPT },
    ...kept.map((t) => ({ role: t.role, content: t.role === 'user' && t.name ? `${t.name}: ${t.content}` : t.content })),
  ]
}

/** Até `max` perguntas por pessoa a cada `windowMs`: segura quem manda muitas seguidas (custo e abuso). */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  private max: number
  private windowMs: number
  constructor(max: number, windowMs: number) {
    this.max = max
    this.windowMs = windowMs
  }
  allow(id: string, now = Date.now()) {
    const recent = (this.hits.get(id) || []).filter((t) => now - t < this.windowMs)
    if (recent.length >= this.max) {
      this.hits.set(id, recent)
      return false
    }
    recent.push(now)
    this.hits.set(id, recent)
    return true
  }
}

const textOf = (content: unknown) =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (c && typeof c === 'object' && typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : '')).join('') : ''

/** Chama o modelo (DISCORD_AGENT_MODEL, padrão claude-opus-5-5; se falhar, argon-4) e devolve a resposta. */
export function createAgent(env: Env, request: typeof fetch = fetch) {
  const models = [...new Set([env.DISCORD_AGENT_MODEL || 'claude-opus-5-5', 'argon-4'])]
  return {
    async ask(history: Turn[]) {
      const router = await loadRouter(env, request)
      const messages = toMessages(history)
      // Limite ou instabilidade do fornecedor (429, 502, 503, 529): tenta a próxima key e, a cada volta pelas keys,
      // espera um pouco (retry-after ou 1,5 s dobrando até 8 s), por até DISCORD_AGENT_WAIT_MS (padrão 40 s) no total.
      // Só depois passa para o modelo reserva. É o mesmo cuidado que o gateway tem com os clientes.
      const deadline = Date.now() + (env.DISCORD_AGENT_WAIT_MS !== undefined ? Number(env.DISCORD_AGENT_WAIT_MS) : 40000)
      for (const model of models) {
        const route = findRoute(router, model)
        if (!route) continue
        const keys = route.provider.keys?.length ? route.provider.keys : [route.provider.key]
        let pause = 1500
        for (let attempt = 0; ; attempt++) {
          const key = keys[attempt % keys.length]
          let status = 0, retryAfter = NaN
          try {
            const response = await request(supplierUrl(route.provider.url, '/v1/chat/completions'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'x-api-key': key },
              body: JSON.stringify({ model: route.upstream, max_tokens: 1200, temperature: 0.3, messages }),
              signal: AbortSignal.timeout(90000),
            })
            status = response.status
            if (response.ok) {
              const data = (await response.json()) as { choices?: { message?: { content?: unknown } }[] }
              const text = textOf(data.choices?.[0]?.message?.content)
              if (text.trim()) return { ...parseReply(text), model }
              break
            }
            retryAfter = Number(response.headers.get('retry-after'))
            console.error('discord: o modelo recusou', model, status, (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200))
          } catch (error) {
            console.error('discord: falha ao chamar o modelo', model, error instanceof Error ? error.message : error)
            break
          }
          if (![429, 502, 503, 529].includes(status)) break
          const lap = (attempt + 1) % keys.length === 0
          const wait = lap ? Math.min(8000, retryAfter > 0 ? retryAfter * 1000 : pause) : 0
          if (Date.now() + wait > deadline) break
          if (wait) {
            await new Promise((resolve) => setTimeout(resolve, wait))
            pause = Math.min(pause * 2, 8000)
          }
        }
      }
      throw new Error('nenhum modelo respondeu')
    },
  }
}
