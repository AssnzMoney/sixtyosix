/**
 * Consumo real do período (aba "Consumo e falhas" do /admin).
 *
 * O painel baixava as chamadas uma por uma e parava em 10.000: com mais uso que isso no período, os totais, o
 * consumo por cliente e os erros mostravam só uma parte. Aqui o servidor percorre todas as chamadas do período
 * no Supabase (de 1.000 em 1.000, só as colunas da soma) e devolve os números já somados por chave.
 */
type Row = Record<string, any>

export type UsageClient = { client_id: string; requests: number; input: number; output: number; errors: number; last: string; peak: number; models: Record<string, number> }
export type UsageSummary = {
  total: { requests: number; input: number; output: number; errors: number }
  clients: UsageClient[]
  errors: { code: number; count: number; last: string }[]
  complete: boolean
}

const PAGE = 1000
/** Teto de segurança: 3 milhões de chamadas ou 40 s de leitura. Passou disso, devolve o que somou com complete = false. */
const MAX_ROWS = 3_000_000
const MAX_MS = 40_000

export function summarizeUsage(errorsSince = '') {
  const clients = new Map<string, UsageClient & { window: number[] }>()
  const errors = new Map<number, { count: number; last: string }>()
  const total = { requests: 0, input: 0, output: 0, errors: 0 }
  const errorCutoff = errorsSince ? Date.parse(`${errorsSince}T00:00:00Z`) : NaN
  return {
    /** As linhas precisam chegar em ordem de created_at crescente (o pico por minuto depende disso). */
    add(row: Row) {
      const id = String(row.client_id || '')
      const at = String(row.created_at || '')
      let c = clients.get(id)
      if (!c) { c = { client_id: id, requests: 0, input: 0, output: 0, errors: 0, last: '', peak: 0, models: {}, window: [] }; clients.set(id, c) }
      const input = Number(row.input_tokens || 0), output = Number(row.output_tokens || 0), code = Number(row.status_code)
      c.requests++; c.input += input; c.output += output
      total.requests++; total.input += input; total.output += output
      if (at > c.last) c.last = at
      if (row.requested_alias) c.models[String(row.requested_alias)] = (c.models[String(row.requested_alias)] || 0) + 1
      const time = Date.parse(at)
      if (code >= 400 && (!Number.isFinite(errorCutoff) || !Number.isFinite(time) || time >= errorCutoff)) {
        c.errors++; total.errors++
        const e = errors.get(code) || { count: 0, last: '' }
        e.count++
        if (at > e.last) e.last = at
        errors.set(code, e)
      }
      // Pico por minuto: o maior número de chamadas dentro de 60 segundos seguidos.
      if (Number.isFinite(time)) {
        c.window.push(time)
        while (time - c.window[0] >= 60000) c.window.shift()
        if (c.window.length > c.peak) c.peak = c.window.length
      }
    },
    result(complete: boolean): UsageSummary {
      return {
        total,
        clients: [...clients.values()].map(({ window: _w, ...c }) => c).sort((a, b) => b.input + b.output - (a.input + a.output) || b.requests - a.requests),
        errors: [...errors.entries()].map(([code, e]) => ({ code, ...e })).sort((a, b) => b.count - a.count),
        complete,
      }
    },
  }
}

/** Lê todas as chamadas do período em gateway_usage e soma. from/to = AAAA-MM-DD (UTC), já validados. */
export async function loadUsageSummary(db: { url: string; headers: Record<string, string> }, request: typeof fetch, from: string, to: string, now: () => number = Date.now, errorsSince = ''): Promise<UsageSummary> {
  const sum = summarizeUsage(errorsSince)
  const started = now()
  const end = new Date(Date.parse(to) + 86400000).toISOString()
  // Paginação por cursor (created_at, id): não pula nem repete linha quando chegam chamadas novas durante a leitura.
  let cursor: { at: string; id: string } | null = null
  for (let read = 0; read < MAX_ROWS; ) {
    const range = cursor
      ? `(created_at.lt.${end},or(created_at.gt.${cursor.at},and(created_at.eq.${cursor.at},id.gt.${cursor.id})))`
      : `(created_at.gte.${from}T00:00:00Z,created_at.lt.${end})`
    const params = new URLSearchParams({ select: 'id,client_id,requested_alias,status_code,input_tokens,output_tokens,created_at', order: 'created_at.asc,id.asc', limit: String(PAGE), and: range })
    const response = await request(`${db.url}/rest/v1/gateway_usage?${params}`, { headers: db.headers, signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error(`gateway_usage ${response.status}`)
    const rows = (await response.json()) as Row[]
    for (const row of rows) sum.add(row)
    read += rows.length
    if (rows.length < PAGE) return sum.result(true)
    const last = rows[rows.length - 1]
    cursor = { at: String(last.created_at), id: String(last.id) }
    if (now() - started > MAX_MS) break
  }
  return sum.result(false)
}
