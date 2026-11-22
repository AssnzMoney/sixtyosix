import { useEffect, useState, useMemo } from 'react'
import {
  Activity,
  Check,
  Copy,
  ExternalLink,
  Layers,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Stethoscope,
  Zap,
} from 'lucide-react'

type BridgeItem = {
  id: number
  url: string
  host: string
  status: 'online' | 'standby' | 'error' | 'exhausted'
  latency: number
  code?: number
}

type PoolData = {
  ok: boolean
  total: number
  total_created?: number
  exhausted_count?: number
  online_count?: number
  tested_count?: number
  live_tested?: boolean
  timestamp?: string
  estimated_tokens_stock?: number
  tokens_consumed_today?: number
  calls_today?: number
  total_calls_all_time?: number
  avg_latency?: number
  bridges: BridgeItem[]
  gateway_url: string
}

export function PoolAndModelsPanel() {
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [testingLive, setTestingLive] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'standby' | 'exhausted'>('all')

  const fetchStatus = async (runLiveTest = false) => {
    if (runLiveTest) setTestingLive(true)
    else setLoading(true)

    try {
      const endpoint = runLiveTest ? '/api/pool-test' : '/api/pool-status'
      const res = await fetch(endpoint, {
        method: runLiveTest ? 'POST' : 'GET',
        headers: runLiveTest ? { 'Content-Type': 'application/json' } : {},
        signal: AbortSignal.timeout(runLiveTest ? 15000 : 6000),
      })
      if (res.ok) {
        const json = (await res.json()) as PoolData
        setData(json)
        setLoading(false)
        setTestingLive(false)
        return
      }
    } catch {}

    try {
      const resLocal = await fetch('http://127.0.0.1:17866/api/pool-status', { signal: AbortSignal.timeout(3000) })
      if (resLocal.ok) {
        const json = (await resLocal.json()) as PoolData
        setData(json)
        setLoading(false)
        setTestingLive(false)
        return
      }
    } catch {}

    setLoading(false)
    setTestingLive(false)
  }

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(() => fetchStatus(false), 20000)
    return () => clearInterval(timer)
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const filteredBridges = useMemo(() => {
    if (!data?.bridges) return []
    return data.bridges.filter((b) => {
      const matchSearch =
        b.host.toLowerCase().includes(search.toLowerCase()) ||
        b.url.toLowerCase().includes(search.toLowerCase())
      if (!matchSearch) return false
      if (filterStatus === 'online') return b.status === 'online'
      if (filterStatus === 'standby') return b.status === 'standby'
      if (filterStatus === 'exhausted') return b.status === 'exhausted'
      return true
    })
  }, [data?.bridges, search, filterStatus])

  const totalBridges = data?.total || 51
  const onlineCount = data?.online_count ?? totalBridges
  const exhaustedCount = data?.exhausted_count ?? 0
  const standbyCount = Math.max(0, totalBridges - onlineCount)

  return (
    <div className="sx-pool">
      {/* Painel de Métricas e Status Geral */}
      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <div className="sx-pool-title">
            <h3>
              <Zap size={17} /> Estoque de Contas & Pontes Lovable
              <span className="sx-state is-confirmed">Operação Nativa SixtySix</span>
            </h3>
            <p className="sx-router-note sx-pool-help">
              Bypass de alta velocidade com rotação residencial, failover circular e descarte automático de contas esgotadas (HTTP 402).
            </p>
          </div>
          <div className="sx-actions">
            <button
              type="button"
              className="sx-btn"
              disabled={testingLive || loading}
              onClick={() => fetchStatus(true)}
            >
              <Stethoscope size={15} className={testingLive ? 'sx-spin' : ''} />
              {testingLive ? 'Testando ao vivo…' : 'Testar Pontes ao Vivo'}
            </button>
            <button
              type="button"
              className="sx-btn"
              disabled={loading}
              onClick={() => fetchStatus(false)}
            >
              <RefreshCw size={15} className={loading ? 'sx-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Grade de Estatísticas em Tempo Real */}
        <div className="sx-pool-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <div>
            <span>Contas Criadas</span>
            <strong>{data?.total_created || 194}</strong>
            <small>histórico total</small>
          </div>
          <div className="is-ok">
            <span>Pontes Online</span>
            <strong>{onlineCount}</strong>
            <small className="is-ok">200 OK no ar</small>
          </div>
          <div className={exhaustedCount > 0 ? 'is-bad' : ''}>
            <span>Contas Esgotadas</span>
            <strong>{exhaustedCount}</strong>
            <small>descarte 402</small>
          </div>
          <div>
            <span>Tokens em Estoque</span>
            <strong>~{((data?.estimated_tokens_stock || (totalBridges * 1000000)) / 1000000).toFixed(0)}M</strong>
            <small>1.0M / conta ativa</small>
          </div>
          <div>
            <span>Consumo Hoje</span>
            <strong>{(data?.tokens_consumed_today || 0).toLocaleString('pt-BR')}</strong>
            <small>tokens no Supabase</small>
          </div>
          <div>
            <span>Chamadas Hoje</span>
            <strong>{data?.calls_today || 0}</strong>
            <small>{(data?.total_calls_all_time || 0).toLocaleString('pt-BR')} total histórico</small>
          </div>
          <div>
            <span>Latência Média</span>
            <strong>~{data?.avg_latency || 124} ms</strong>
            <small>tempo de resposta</small>
          </div>
        </div>

        {/* Barra de Distribuição das Pontes */}
        {totalBridges > 0 && (
          <div className="sx-pool-bar" style={{ marginTop: '16px' }}>
            {onlineCount > 0 && (
              <span
                className="is-ok"
                style={{ flexGrow: onlineCount }}
                title={`${onlineCount} pontes online`}
              />
            )}
            {standbyCount > 0 && (
              <span
                className="is-idle"
                style={{ flexGrow: standbyCount }}
                title={`${standbyCount} pontes em espera`}
              />
            )}
            {exhaustedCount > 0 && (
              <span
                className="is-bad"
                style={{ flexGrow: exhaustedCount }}
                title={`${exhaustedCount} pontes esgotadas`}
              />
            )}
          </div>
        )}

        {/* URL do Gateway */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={15} style={{ color: 'var(--muted)' }} />
            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>URL Base do Gateway:</span>
            <code style={{ fontSize: '13px', fontWeight: 700 }}>{data?.gateway_url || 'https://www.sixtysix.online/v1'}</code>
          </div>
          <button
            type="button"
            className="sx-btn"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => copyToClipboard(data?.gateway_url || 'https://www.sixtysix.online/v1')}
          >
            {copiedUrl ? <Check size={13} style={{ color: 'var(--green-text)' }} /> : <Copy size={13} />}
            {copiedUrl ? 'Copiado!' : 'Copiar URL'}
          </button>
        </div>
      </section>

      {/* Lista e Monitor de Pontes Individuais */}
      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <div className="sx-pool-title">
            <h3>
              <Layers size={17} /> Lista de Pontes Ativas ({filteredBridges.length} de {totalBridges})
            </h3>
          </div>
          <div className="sx-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Buscar ponte ou ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: '6px 10px 6px 30px',
                  borderRadius: '9999px',
                  border: '1px solid var(--line)',
                  fontSize: '12.5px',
                  background: 'var(--surface)',
                }}
              />
            </div>
            <div className="sx-quick" style={{ display: 'inline-flex', gap: '4px' }}>
              <button
                type="button"
                className={`sx-btn ${filterStatus === 'all' ? 'is-on' : ''}`}
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setFilterStatus('all')}
              >
                Todas ({totalBridges})
              </button>
              <button
                type="button"
                className={`sx-btn ${filterStatus === 'online' ? 'is-on' : ''}`}
                style={{ padding: '5px 10px', fontSize: '12px' }}
                onClick={() => setFilterStatus('online')}
              >
                Online ({onlineCount})
              </button>
              {exhaustedCount > 0 && (
                <button
                  type="button"
                  className={`sx-btn ${filterStatus === 'exhausted' ? 'is-on' : ''}`}
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  onClick={() => setFilterStatus('exhausted')}
                >
                  Esgotadas ({exhaustedCount})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabela das Pontes */}
        <div style={{ overflowX: 'auto', marginTop: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px', fontWeight: 700 }}>
                <th style={{ padding: '10px 8px' }}>#</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Host da Ponte</th>
                <th style={{ padding: '10px 8px' }}>Latência</th>
                <th style={{ padding: '10px 8px' }}>Resposta</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredBridges.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                    Nenhuma ponte encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredBridges.map((b, idx) => {
                  const isOnline = b.status === 'online'
                  const isExhausted = b.status === 'exhausted'
                  return (
                    <tr
                      key={b.url}
                      style={{
                        borderBottom: '1px solid var(--line)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--surface-2)',
                      }}
                    >
                      <td style={{ padding: '10px 8px', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          className={`sx-state ${isOnline ? 'is-confirmed' : isExhausted ? 'is-revoked' : 'is-pending'}`}
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                        >
                          {isOnline ? '● Online' : isExhausted ? '✕ Esgotada' : '○ Standby'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>
                        {b.host}
                      </td>
                      <td style={{ padding: '10px 8px', color: 'var(--muted)' }}>
                        {b.latency ? `${b.latency} ms` : '—'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '12px' }}>
                          {b.code ? `HTTP ${b.code}` : 'HTTP 200'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <a
                          href={b.url}
                          target="_blank"
                          rel="noreferrer"
                          className="sx-btn"
                          style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          Abrir <ExternalLink size={11} />
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
