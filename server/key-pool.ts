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

/** Saúde de uma key para o painel do admin: só o final dela, nunca a key inteira. */
export type KeyHealth = {
  hint: string
  state: 'ok' | 'error' | 'refused' | 'limit' | 'unknown'
  restingUntil: string | null
  ok: number
  failed: number
  lastStatus: number | null
  lastLatencyMs: number | null
  lastOkAt: string | null
  lastErrorAt: string | null
  lastCheckAt: string | null
}
type Stats = { ok: number; failed: number; lastStatus: number | null; lastLatencyMs: number | null; lastOkAt: number | null; lastErrorAt: number | null; lastCheckAt: number | null }

const REFUSED_MS = 5 * 60_000
const LIMIT_MS = 10_000
const MAX_LIMIT_MS = 60_000

/** Final da key para o log, como o painel mostra (…2959). Nunca a key inteira. */
export const keyHint = (key: string) => `…${key.slice(-4)}`

export class KeyPool {
  private resting = new Map<string, { until: number; why: KeyRest }>()
  private stats = new Map<string, Stats>()
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

  /**
   * Anota a resposta do fornecedor para esta key, só para o painel: 2xx conta como sucesso, o resto como falha.
   * status 0 = o fornecedor nem respondeu. check = veio do teste do admin. Não mexe no descanso: quem chama decide
   * (o gateway usa rest()/ok(); o teste do admin usa checked()).
   */
  record(key: string, status: number, latencyMs?: number, check = false) {
    const now = this.now()
    const s = this.stats.get(key) || { ok: 0, failed: 0, lastStatus: null, lastLatencyMs: null, lastOkAt: null, lastErrorAt: null, lastCheckAt: null }
    const good = status >= 200 && status < 300
    if (good) { s.ok++; s.lastOkAt = now } else { s.failed++; s.lastErrorAt = now }
    s.lastStatus = status
    if (latencyMs !== undefined) s.lastLatencyMs = Math.round(latencyMs)
    if (check) s.lastCheckAt = now
    this.stats.set(key, s)
  }

  /** Resultado do teste do admin: anota e aplica o descanso como numa chamada de verdade. */
  checked(key: string, status: number, latencyMs?: number, retryAfter?: number) {
    this.record(key, status, latencyMs, true)
    if (status >= 200 && status < 300) this.ok(key)
    else if (status === 401 || status === 402 || status === 403) this.rest(key, 'refused')
    else if (status === 429) this.rest(key, 'limit', retryAfter)
  }

  /** Saúde de cada key, na ordem recebida. Sem nenhuma chamada ainda: 'unknown'; última resposta com erro (5xx, rede): 'error'. */
  health(keys: readonly string[]): KeyHealth[] {
    const now = this.now()
    const iso = (value: number | null) => (value ? new Date(value).toISOString() : null)
    return keys.map((key) => {
      const s = this.stats.get(key)
      const rest = this.resting.get(key)
      const resting = rest && rest.until > now ? rest : null
      return {
        hint: keyHint(key),
        state: resting ? resting.why : !s ? 'unknown' : s.lastStatus !== null && s.lastStatus >= 200 && s.lastStatus < 300 ? 'ok' : 'error',
        restingUntil: resting ? iso(resting.until) : null,
        ok: s?.ok || 0,
        failed: s?.failed || 0,
        lastStatus: s?.lastStatus ?? null,
        lastLatencyMs: s?.lastLatencyMs ?? null,
        lastOkAt: iso(s?.lastOkAt ?? null),
        lastErrorAt: iso(s?.lastErrorAt ?? null),
        lastCheckAt: iso(s?.lastCheckAt ?? null),
      }
    })
  }
}

/** Pool único do processo: o gateway (api/access.ts) anota as chamadas e o admin (api/management.ts) lê a saúde. */
export const providerKeyPool = new KeyPool()
