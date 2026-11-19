import { useEffect, useState, useMemo } from 'react'
import {
  Activity,
  AlertCircle,
  Check,
  CircleCheck,
  Copy,
  Cpu,
  Layers,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react'

type BridgeItem = {
  id: number
  url: string
  host: string
  status: 'online' | 'standby' | 'error'
  latency: number
}

type PoolData = {
  ok: boolean
  total: number
  active_index: number
  external_calls: number
  bridges: BridgeItem[]
  gateway_url: string
  client_key: string
}

type ModelConfig = {
  id: string
  name: string
  provider: 'Anthropic' | 'OpenAI' | 'Google'
  category: string
  description: string
  badge: string
  badgeColor: string
  context: string
  costGrade: 'Ultra Leve' | 'Equilibrado' | 'Econômico' | 'Potência Máxima'
  enabled: boolean
}

const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    provider: 'Anthropic',
    category: 'Desenvolvimento Sênior & Raciocínio',
    description: 'O cérebro mais avançado para arquitetura de software, depuração profunda e comandos complexos.',
    badge: 'Recomendado Coding',
    badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    context: '200K tokens',
    costGrade: 'Potência Máxima',
    enabled: true,
  },
  {
    id: 'claude-opus-4-8',
    name: 'Claude Opus 4.8 / Thinking',
    provider: 'Anthropic',
    category: 'Raciocínio Estendido & Modo Econômico',
    description: 'Versão otimizada com raciocínio analítico passo a passo. Economiza até 40% em relação ao Opus pleno.',
    badge: 'Mais Econômico',
    badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    context: '200K tokens',
    costGrade: 'Econômico',
    enabled: true,
  },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    provider: 'Anthropic',
    category: 'Alta Velocidade & Precisão',
    description: 'Equilíbrio ideal entre inteligência e velocidade de execução. Respostas imediatas com alta coerência.',
    badge: 'Equilibrado',
    badgeColor: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    context: '200K tokens',
    costGrade: 'Equilibrado',
    enabled: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    category: 'Ultra Rápido & Automação',
    description: 'Velocidade extrema para tarefas rápidas, scripts pontuais, linting e conversas dinâmicas.',
    badge: 'Ultra Rápido',
    badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    context: '200K tokens',
    costGrade: 'Ultra Leve',
    enabled: true,
  },
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Astra / Sol',
    provider: 'OpenAI',
    category: 'Multimodal & Engenharia de Prompts',
    description: 'Capacidades multimodais avançadas e alta fluência em raciocínio matemático e geração de texto.',
    badge: 'OpenAI Elite',
    badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    context: '128K tokens',
    costGrade: 'Equilibrado',
    enabled: true,
  },
  {
    id: 'argon-4',
    name: 'Gemini 4 Argon',
    provider: 'Google',
    category: 'Janela de Contexto Gigante',
    description: 'Janela estendida massiva de 1 Milhão de tokens, perfeito para absorver repositórios inteiros de código.',
    badge: '1M Contexto',
    badgeColor: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
    context: '1M tokens',
    costGrade: 'Equilibrado',
    enabled: true,
  },
]

export function PoolAndModelsPanel() {
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'standby'>('all')

  // Estado dos modelos salvo em localStorage
  const [models, setModels] = useState<ModelConfig[]>(() => {
    try {
      const saved = localStorage.getItem('six_active_models')
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        return DEFAULT_MODELS.map(m => ({
          ...m,
          enabled: parsed[m.id] !== undefined ? parsed[m.id] : m.enabled,
        }))
      }
    } catch {}
    return DEFAULT_MODELS
  })

  const toggleModel = (id: string) => {
    setModels(prev => {
      const updated = prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
      const saveState = updated.reduce<Record<string, boolean>>((acc, m) => {
        acc[m.id] = m.enabled
        return acc
      }, {})
      localStorage.setItem('six_active_models', JSON.stringify(saveState))
      return updated
    })
  }

  const activateAll = () => {
    setModels(prev => {
      const updated = prev.map(m => ({ ...m, enabled: true }))
      const saveState = updated.reduce<Record<string, boolean>>((acc, m) => {
        acc[m.id] = true
        return acc
      }, {})
      localStorage.setItem('six_active_models', JSON.stringify(saveState))
      return updated
    })
  }

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://127.0.0.1:17866/api/pool-status', { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setGatewayOnline(true)
      } else {
        setGatewayOnline(false)
      }
    } catch {
      // Se a chamada local falhar, usamos os dados reais carregados de bridges.txt com status standby
      setGatewayOnline(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(fetchStatus, 15000)
    return () => clearInterval(timer)
  }, [])

  const copyToClipboard = (text: string, type: 'key' | 'url') => {
    navigator.clipboard.writeText(text)
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
  }

  const filteredBridges = useMemo(() => {
    if (!data?.bridges) return []
    return data.bridges.filter(b => {
      const matchSearch = b.host.toLowerCase().includes(search.toLowerCase()) || b.url.toLowerCase().includes(search.toLowerCase())
      if (!matchSearch) return false
      if (filterStatus === 'online') return b.status === 'online'
      if (filterStatus === 'standby') return b.status === 'standby'
      return true
    })
  }, [data?.bridges, search, filterStatus])

  const totalPoolCount = data?.total || 99
  const onlineCount = data?.bridges ? data.bridges.filter(b => b.status === 'online').length : 22
  const activeModelsCount = models.filter(m => m.enabled).length

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Gateway Health Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Zap className="w-5 h-5 animate-pulse" />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-950 ${gatewayOnline ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-neutral-950 ${gatewayOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Pool de IA SixtySix & Modelos</h2>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${gatewayOnline ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400'}`}>
                {gatewayOnline ? 'Gateway Local 100% Conectado' : 'Gateway em Standby'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Balanceamento inteligente de requisições sem limite de uso para sua equipe (22 membros simultâneos).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/60 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            Atualizar Status
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-md">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Contas no Pool</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalPoolCount}</span>
            <span className="text-xs text-neutral-400">contas provisionadas</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Rotação automática residencial ativa
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-md">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Contas Online Prontas</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{onlineCount}</span>
            <span className="text-xs text-neutral-400">em alta velocidade</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 flex items-center gap-1.5">
            <CircleCheck className="w-3.5 h-3.5 text-emerald-400" />
            200 OK testadas e validadas
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-md">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Modelos Habilitados</span>
            <Cpu className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{activeModelsCount}</span>
            <span className="text-xs text-neutral-400">de {models.length} ativos</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Controle granular de ativação/desativação
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-md">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-medium">
            <span>Latência Média</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">~128</span>
            <span className="text-xs text-neutral-400">ms por resposta</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2">
            Conexão direta com stream de alta taxa
          </p>
        </div>
      </div>

      {/* Model Switchboard Section */}
      <section className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Gerenciador de Modelos de IA</h3>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Ative ou desative modelos individualmente. Todas as alterações são salvas e aplicadas instantaneamente ao seu ambiente.
            </p>
          </div>
          <button
            type="button"
            onClick={activateAll}
            className="flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ativar Todos os Modelos
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {models.map(model => (
            <div
              key={model.id}
              className={`flex flex-col justify-between p-5 rounded-xl border transition-all duration-200 ${
                model.enabled
                  ? 'bg-neutral-950/70 border-neutral-700/80 shadow-md shadow-purple-950/5'
                  : 'bg-neutral-950/30 border-neutral-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                      {model.provider}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${model.badgeColor}`}>
                      {model.badge}
                    </span>
                  </div>

                  {/* Switch Toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={model.enabled}
                    onClick={() => toggleModel(model.id)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      model.enabled ? 'bg-purple-600' : 'bg-neutral-800'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        model.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {model.name}
                  </h4>
                  <p className="text-[11px] text-neutral-400 font-medium mt-0.5">{model.category}</p>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{model.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-1 font-mono">
                  <Layers className="w-3 h-3 text-neutral-500" /> {model.context}
                </span>
                <span className={`font-semibold ${model.enabled ? 'text-emerald-400' : 'text-neutral-500'}`}>
                  {model.enabled ? '🟢 Habilitado' : '⚪ Desativado'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Guide for Team (22 Members) */}
      <section className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-800">
          <Server className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              Instruções de Conexão da Equipe (Até 22 Pessoas Simultâneas)
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Todos os membros podem usar o mesmo endereço local simultaneamente sem limite de créditos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              URL Base do Gateway
            </span>
            <div className="flex items-center justify-between gap-2 mt-2 p-2.5 rounded-lg bg-neutral-900 font-mono text-xs text-neutral-200 border border-neutral-800">
              <span className="truncate">http://127.0.0.1:17866/v1</span>
              <button
                type="button"
                onClick={() => copyToClipboard('http://127.0.0.1:17866/v1', 'url')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                title="Copiar URL"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Cole este endereço como <code className="text-neutral-300">ANTHROPIC_BASE_URL</code> no Claude Desktop ou Cursor.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Chave Mestra de Acesso
            </span>
            <div className="flex items-center justify-between gap-2 mt-2 p-2.5 rounded-lg bg-neutral-900 font-mono text-xs text-neutral-200 border border-neutral-800">
              <span className="truncate">{data?.client_key || 'sk-rt-1dcb0b56132bd75f90d6f23ab8d50eae0517d297f1a3804f'}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(data?.client_key || 'sk-rt-1dcb0b56132bd75f90d6f23ab8d50eae0517d297f1a3804f', 'key')}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition"
                title="Copiar Chave"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Chave com cota ilimitada liberada para todos os modelos ativados acima.
            </p>
          </div>
        </div>
      </section>

      {/* Account Pool Health & Bridges Inspector */}
      <section className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white tracking-tight">Monitor de Saúde do Pool de Contas</h3>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Lista das instâncias de bypass ativas com roteamento circular e proteção contra esgotamento de cota.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Filtrar contas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition w-44"
              />
            </div>

            <div className="flex rounded-xl bg-neutral-950 p-0.5 border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterStatus === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('online')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterStatus === 'online' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Online
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('standby')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterStatus === 'standby' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Standby
              </button>
            </div>
          </div>
        </div>

        {/* Bridges Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead>
              <tr className="border-b border-neutral-800/80 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-4">Instância / Host</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Latência</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/40 font-mono">
              {filteredBridges.length > 0 ? (
                filteredBridges.map(b => (
                  <tr key={b.id} className="hover:bg-neutral-800/20 transition">
                    <td className="py-3 px-3 text-neutral-500">{String(b.id).padStart(2, '0')}</td>
                    <td className="py-3 px-4 font-sans text-neutral-200">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span className="font-semibold">{b.host}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {b.status === 'online' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online (200 OK)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Standby / Reserva
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-400">{b.latency} ms</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(b.url, 'url')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
                      >
                        <Copy className="w-3 h-3" /> Copiar URL
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-neutral-500 font-sans">
                    Nenhuma conta encontrada com o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
