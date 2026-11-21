/**
 * Pool de keys do provedor (várias keys, uma por linha no admin), com a saúde de cada uma na memória do processo.
 *
 * Antes o gateway só revezava: cada chamada começava na key seguinte, mesmo que ela tivesse acabado de levar 429
 * ou estivesse sem saldo. Uma key recusada (401/402/403) derrubava a chamada inteira e, no revezamento, uma em cada
 * N chamadas caía nela. Agora:
 * - key recusada descansa alguns minutos e a chamada segue na próxima;
 * - key no limite (429) descansa o retry-after do fornecedor (ou alguns segundos);
 * - as keys descansando vão para o fim da fila, mas nunca saem dela: se todas estiverem descansando, o gateway
 *   tenta mesmo assim (a que volta primeiro na frente), então o pool nunca para de atender por engano.
 * - a key que responde bem volta ao normal na hora.
 */
export type KeyRest = 'refused' | 'limit'

const REFUSED_MS = 5 * 60_000
const LIMIT_MS = 10_000
const MAX_LIMIT_MS = 60_000

/** Final da key para o log, como o painel mostra (…2959). Nunca a key inteira. */
export const keyHint = (key: string) => `…${key.slice(-4)}`

export class KeyPool {
  private resting = new Map<string, { until: number; why: KeyRest }>()
  private turn = 0
  private now: () => number
  constructor(now: () => number = Date.now) { this.now = now }

  /** Ordem de tentativa desta chamada: começa numa key diferente a cada chamada; as que descansam vão para o fim. */
  order(keys: readonly string[]): string[] {
    if (keys.length <= 1) return [...keys]
    const start = this.turn++ % keys.length
    const turn = keys.map((_, i) => keys[(start + i) % keys.length])
    const now = this.now()
    const until = (key: string) => { const s = this.resting.get(key); return s && s.until > now ? s.until : 0 }
    return [...turn.filter((key) => !until(key)), ...turn.filter((key) => until(key)).sort((a, b) => until(a) - until(b))]
  }

  /** Key recusada (sem saldo, bloqueada) ou no limite: descansa. retryAfter em segundos, como vem do fornecedor. */
  rest(key: string, why: KeyRest, retryAfter?: number) {
    const ms = why === 'refused' ? REFUSED_MS : Math.min(MAX_LIMIT_MS, retryAfter && retryAfter > 0 ? retryAfter * 1000 : LIMIT_MS)
    const first = !this.isResting(key)
    this.resting.set(key, { until: this.now() + ms, why })
    return first
  }

  /** Respondeu bem: volta ao normal. */
  ok(key: string) { this.resting.delete(key) }

  isResting(key: string) { const s = this.resting.get(key); return Boolean(s && s.until > this.now()) }
}
