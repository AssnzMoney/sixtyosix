import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Ban, Check, KeyRound, Plus, RefreshCw, Server, Stethoscope, Trash2, X } from 'lucide-react'
import { adminHeaders } from '../lib/adminSession'

/**
 * Pool de keys do Roteador (aba "Pool de IA" do /admin).
 * Mostra, por provedor, cada key com a saúde que o gateway anota nas chamadas de verdade: respondendo, descansando
 * (recusada ou no limite, com a hora de volta), com erro ou ainda sem uso. Dá para testar (GET /models, não gasta
 * crédito), desligar, religar, remover e acrescentar keys sem reiniciar nada: o gateway passa a usar em segundos.
 * A key inteira nunca chega ao navegador, só o final (…a91f).
 */

type KeyState = 'ok' | 'error' | 'refused' | 'limit' | 'unknown'
type PoolKey = {
  index: number
  enabled: boolean
  hint: string
  state: KeyState
  restingUntil: string | null
  ok: number
  failed: number
  lastStatus: number | null
  lastLatencyMs: number | null
  lastOkAt: string | null
  lastErrorAt: string | null
  lastCheckAt: string | null
}
type PoolProvider = { id: string; name: string; base_url: string; enabled: boolean; local: boolean; problem: string | null; keys: PoolKey[] }

type Tone = 'ok' | 'warn' | 'bad' | 'idle' | 'off'
const TONE_CLASS: Record<Tone, string> = { ok: 'is-confirmed', warn: 'is-pending', bad: 'is-revoked', idle: '', off: 'is-off' }

function ago(value: string | null, now: number) {
  if (!value) return ''
  const s = Math.max(0, Math.round((now - Date.parse(value)) / 1000))
  if (s < 5) return 'agora'
  if (s < 60) return `há ${s} s`
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}

function until(value: string | null, now: number) {
  if (!value) return ''
  const s = Math.max(0, Math.ceil((Date.parse(value) - now) / 1000))
  if (s < 60) return `volta em ${s} s`
  return `volta às ${new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function statusText(status: number | null) {
  if (status === null) return ''
  if (status === 0) return 'sem resposta'
  return String(status)
}

/** Estado da key como o painel mostra: texto curto, tom da cor e detalhe. */
function describe(key: PoolKey, now: number): { label: string; tone: Tone; detail: string } {
  if (!key.enabled) return { label: 'Desligada', tone: 'off', detail: 'o gateway não usa esta key' }
  const resting = key.restingUntil && Date.parse(key.restingUntil) > now
  if (resting && key.state === 'refused') return { label: 'Recusada', tone: 'bad', detail: `sem saldo ou bloqueada (${statusText(key.lastStatus)}) · ${until(key.restingUntil, now)}` }
  if (resting && key.state === 'limit') return { label: 'No limite', tone: 'warn', detail: `429 do fornecedor · ${until(key.restingUntil, now)}` }
  // Descanso que acabou entre uma atualização e outra: vale a última resposta.
  if (key.lastStatus === null) return { label: 'Sem uso ainda', tone: 'idle', detail: 'teste para conferir' }
  if (key.lastStatus >= 200 && key.lastStatus < 300) return { label: 'Respondendo', tone: 'ok', detail: `última resposta ${ago(key.lastOkAt, now)}` }
  return { label: 'Com erro', tone: 'warn', detail: `última resposta ${statusText(key.lastStatus)} ${ago(key.lastErrorAt, now)}` }
}

export function KeyPoolPanel({ token }: { token: string }) {
  const [providers, setProviders] = useState<PoolProvider[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState('')
  const [auto, setAuto] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [adding, setAdding] = useState<string | null>(null)
  const [addText, setAddText] = useState('')

  const call = useCallback(
    async <T,>(body: Record<string, unknown>): Promise<T> => {
      const response = await fetch('/api/management', {
        method: 'POST',
        headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
      return result as T
    },
    [token],
  )

  const load = useCallback(async () => {
    try {
      const result = await call<{ providers: PoolProvider[] }>({ action: 'router-key-pool' })
      setProviders(result.providers || [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o pool.')
    }
  }, [call])

  useEffect(() => {
    void load()
  }, [load])

  // Saúde ao vivo: recarrega a cada 10 s enquanto a aba está aberta e visível.
  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 10000)
    return () => clearInterval(timer)
  }, [auto, load])

  // Contagem regressiva do descanso e o "há 2 min".
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const replaceKeys = (id: string, keys: PoolKey[]) => setProviders((list) => (list || []).map((p) => (p.id === id ? { ...p, keys } : p)))

  async function run(id: string, task: () => Promise<string | void>) {
    setWorking(id)
    setNotice('')
    setError('')
    try {
      const message = await task()
      if (message) setNotice(message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setWorking('')
    }
  }

  const totals = useMemo(() => {
    const keys = (providers || []).filter((p) => p.enabled).flatMap((p) => p.keys)
    const live = keys.filter((k) => k.enabled)
    const tones = live.map((k) => describe(k, now).tone)
    return {
      total: keys.length,
      live: live.length,
      ok: tones.filter((t) => t === 'ok').length,
      resting: tones.filter((t) => t === 'warn').length,
      bad: tones.filter((t) => t === 'bad').length,
    }
  }, [providers, now])

  return (
    <div className="sx-pool">
      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <KeyRound size={17} /> Pool de keys do Roteador
          </h3>
          <div className="sx-actions">
            <label className="sx-pool-auto">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Ao vivo (10 s)
            </label>
            <button type="button" className="sx-btn" onClick={() => run('reload', async () => { await load() })} disabled={working === 'reload'}>
              <RefreshCw size={15} className={working === 'reload' ? 'sx-spin' : ''} /> Atualizar
            </button>
          </div>
        </div>
        <div className="sx-pool-stats">
          <div>
            <span>Keys ligadas</span>
            <strong>
              {totals.live}
              <small>/{totals.total}</small>
            </strong>
          </div>
          <div className="is-ok">
            <span>Respondendo</span>
            <strong>{totals.ok}</strong>
          </div>
          <div className="is-warn">
            <span>No limite ou com erro</span>
            <strong>{totals.resting}</strong>
          </div>
          <div className="is-bad">
            <span>Recusadas</span>
            <strong>{totals.bad}</strong>
          </div>
        </div>
        <p className="sx-router-note sx-pool-help">
          Cada chamada começa numa key diferente. Recusada (sem saldo, bloqueada) descansa 5 min; no limite (429), o tempo que o fornecedor pedir. Erro 502/503 passa na hora para a próxima key. O teste usa a lista de modelos e não gasta crédito.
        </p>
      </section>

      {error && <p className="sx-admin-message is-error">{error}</p>}
      {notice && <p className="sx-admin-message">{notice}</p>}

      {providers === null ? (
        <section className="sx-admin-panel">
          <p className="sx-router-note">Carregando o pool…</p>
        </section>
      ) : !providers.length ? (
        <section className="sx-admin-panel">
          <p className="sx-router-note sx-admin-empty">Nenhum provedor no Roteador ainda. Cadastre o fornecedor na aba Roteador → Adicionar provedor.</p>
        </section>
      ) : (
        providers.map((p) => {
          const described = p.keys.map((k) => describe(k, now))
          const count = (tone: Tone) => described.filter((d) => d.tone === tone).length
          const busy = working.startsWith(p.id)
          return (
            <section key={p.id} className={`sx-admin-panel sx-pool-provider${p.enabled ? '' : ' is-disabled'}`}>
              <div className="sx-router-head">
                <div className="sx-pool-title">
                  <h3>
                    <Server size={17} /> {p.name}
                    {p.local && <span className="sx-state is-pending">Gateway local</span>}
                    {!p.enabled && <span className="sx-state is-revoked">Provedor desligado</span>}
                  </h3>
                  <code>{p.base_url}</code>
                </div>
                <div className="sx-actions">
                  <button
                    type="button"
                    className="sx-btn"
                    disabled={busy || !p.keys.length}
                    onClick={() =>
                      run(`${p.id}:test`, async () => {
                        const result = await call<{ keys: PoolKey[] }>({ action: 'router-pool-test', id: p.id })
                        replaceKeys(p.id, result.keys)
                        const good = result.keys.filter((k) => k.lastStatus !== null && k.lastStatus >= 200 && k.lastStatus < 300).length
                        return `${p.name}: ${good} de ${result.keys.length} ${result.keys.length === 1 ? 'key respondeu' : 'keys responderam'} bem.`
                      })
                    }
                  >
                    <Stethoscope size={15} className={working === `${p.id}:test` ? 'sx-spin' : ''} /> {working === `${p.id}:test` ? 'Testando…' : 'Testar todas'}
                  </button>
                  <button type="button" className="sx-btn is-primary" onClick={() => { setAdding(adding === p.id ? null : p.id); setAddText('') }}>
                    {adding === p.id ? <X size={15} /> : <Plus size={15} />} {adding === p.id ? 'Fechar' : 'Adicionar keys'}
                  </button>
                </div>
              </div>

              {p.keys.length > 0 && (
                <div className="sx-pool-bar" aria-label={`${count('ok')} respondendo, ${count('warn')} no limite ou com erro, ${count('bad')} recusadas, ${count('idle')} sem uso, ${count('off')} desligadas`}>
                  {(['ok', 'warn', 'bad', 'idle', 'off'] as Tone[]).map((tone) =>
                    count(tone) ? <span key={tone} className={`is-${tone}`} style={{ flexGrow: count(tone) }} title={`${count(tone)}`} /> : null,
                  )}
                </div>
              )}

              {adding === p.id && (
                <form
                  className="sx-pool-add"
                  onSubmit={(e) => {
                    e.preventDefault()
                    run(`${p.id}:add`, async () => {
                      const result = await call<{ added: number; keys: PoolKey[] }>({ action: 'router-pool-keys-add', id: p.id, keys: addText })
                      replaceKeys(p.id, result.keys)
                      setAdding(null)
                      setAddText('')
                      return `${result.added} ${result.added === 1 ? 'key nova entrou' : 'keys novas entraram'} no pool de ${p.name}. O gateway usa em segundos.`
                    })
                  }}
                >
                  <textarea
                    rows={4}
                    autoComplete="off"
                    spellCheck={false}
                    value={addText}
                    placeholder="Cole as keys novas, uma por linha. As que já estão no pool são ignoradas."
                    onChange={(e) => setAddText(e.target.value)}
                  />
                  <div className="sx-actions">
                    <button type="submit" className="sx-btn is-primary" disabled={!addText.trim() || working === `${p.id}:add`}>
                      <Plus size={15} /> {working === `${p.id}:add` ? 'Salvando…' : 'Adicionar ao pool'}
                    </button>
                  </div>
                </form>
              )}

              {p.problem ? (
                <p className="sx-router-note sx-admin-empty">{p.problem}</p>
              ) : !p.keys.length ? (
                <p className="sx-router-note sx-admin-empty">Este provedor está sem keys.</p>
              ) : (
                <ul className="sx-router-list sx-pool-keys">
                  {p.keys.map((k, i) => {
                    const d = described[i]
                    const rowId = `${p.id}:${k.index}`
                    const rowBusy = working === rowId || working === `${rowId}:test`
                    return (
                      <li key={`${k.index}-${k.hint}`} className={`is-${d.tone}`}>
                        <span className={`sx-pool-dot is-${d.tone}`} aria-hidden="true" />
                        <div className="sx-router-main">
                          <strong>
                            <code>{k.hint}</code> <span className={`sx-state ${TONE_CLASS[d.tone]}`}>{d.label}</span>
                          </strong>
                          <span>{d.detail}</span>
                        </div>
                        <div className="sx-pool-metrics">
                          <span title="Respostas boas desde que o servidor ligou">
                            <Check size={13} /> {k.ok.toLocaleString('pt-BR')}
                          </span>
                          <span title="Falhas desde que o servidor ligou" className={k.failed ? 'is-bad' : ''}>
                            <X size={13} /> {k.failed.toLocaleString('pt-BR')}
                          </span>
                          <span title="Tempo até o fornecedor começar a responder, na última chamada">
                            <Activity size={13} /> {k.lastLatencyMs === null ? '—' : `${k.lastLatencyMs.toLocaleString('pt-BR')} ms`}
                          </span>
                        </div>
                        <div className="sx-actions">
                          <button
                            type="button"
                            className="sx-btn"
                            disabled={rowBusy}
                            aria-label={`Testar a key ${k.hint}`}
                            onClick={() =>
                              run(`${rowId}:test`, async () => {
                                const result = await call<{ keys: PoolKey[] }>({ action: 'router-pool-test', id: p.id, index: k.index, hint: k.hint })
                                replaceKeys(p.id, result.keys)
                                const after = result.keys.find((x) => x.index === k.index)
                                const status = after?.lastStatus ?? null
                                return status !== null && status >= 200 && status < 300 ? `Key ${k.hint} respondeu bem (${after?.lastLatencyMs} ms).` : `Key ${k.hint} falhou: ${statusText(status) || 'sem resposta'}.`
                              })
                            }
                          >
                            <Stethoscope size={15} className={working === `${rowId}:test` ? 'sx-spin' : ''} /> Testar
                          </button>
                          <button
                            type="button"
                            className="sx-btn"
                            disabled={rowBusy}
                            onClick={() =>
                              run(rowId, async () => {
                                const result = await call<{ keys: PoolKey[] }>({ action: 'router-pool-key-enabled', id: p.id, index: k.index, hint: k.hint, enabled: !k.enabled })
                                replaceKeys(p.id, result.keys)
                                return k.enabled ? `Key ${k.hint} desligada. O gateway para de usar em segundos.` : `Key ${k.hint} ligada de volta.`
                              })
                            }
                          >
                            {k.enabled ? <Ban size={15} /> : <Check size={15} />} {k.enabled ? 'Desligar' : 'Ligar'}
                          </button>
                          <button
                            type="button"
                            className="sx-btn is-danger"
                            disabled={rowBusy}
                            aria-label={`Remover a key ${k.hint}`}
                            onClick={() => {
                              if (!window.confirm(`Remover a key ${k.hint} do pool de ${p.name}? Para usar de novo, será preciso colar a key outra vez.`)) return
                              run(rowId, async () => {
                                const result = await call<{ keys: PoolKey[] }>({ action: 'router-pool-key-remove', id: p.id, index: k.index, hint: k.hint })
                                replaceKeys(p.id, result.keys)
                                return `Key ${k.hint} removida do pool.`
                              })
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
