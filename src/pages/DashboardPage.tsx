import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
  RefreshCw,
  CircleCheck,
} from "lucide-react"
import { useAuth } from "../lib/AuthContext"
import { accountRequest, accountSummary, type AccountTrial } from "../lib/account"
import NumberRoller from "../components/ui/number-roller"
import { useInView } from "framer-motion"
import "./dashboard.css"

type Tab = "overview" | "usage" | "keys" | "guides" | "plan" | "help"
type Model = string
type RequestRow = {
  id: string
  date: string
  model: Model
  input: number
  output: number
  duration: number
  success: boolean
}
type KeyRow = {
  id: string
  name: string
  prefix: string
  active: boolean
  created: string
  managed?:boolean
}
const models: Model[] = ["Fable 5.1", "Astra 6", "GLM 5"]
const nav = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "usage", label: "Meu consumo", icon: Activity },
  { id: "keys", label: "Chaves de API", icon: KeyRound },
  { id: "guides", label: "Como conectar", icon: Terminal },
  { id: "plan", label: "Plano e assinatura", icon: CreditCard },
] as const
const n = (v: number) => new Intl.NumberFormat("pt-BR").format(v)
const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v)
const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })

function demoRequests(): RequestRow[] {
  const result: RequestRow[] = []
  for (let d = 29; d >= 0; d--) {
    const count = 6 + ((d * 7) % 13)
    for (let i = 0; i < count; i++) {
      const date = new Date()
      date.setDate(date.getDate() - d)
      date.setHours(8 + (i % 13), (i * 13) % 60, 0, 0)
      if (date.getTime() > Date.now()) date.setTime(Date.now() - i * 60000)
      const model = models[(i + d) % 5 < 3 ? 0 : (i + d) % 5 === 3 ? 1 : 2]
      result.push({
        id: `demo-${d}-${i}`,
        date: date.toISOString(),
        model,
        input: 18000 + ((i * 6329 + d * 4127) % 62000),
        output: 1200 + ((i * 451 + d * 317) % 6200),
        duration: 1.2 + ((i + d) % 28) / 10,
        success: (d * 13 + i) % 43 !== 0,
      })
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date))
}

function CodeBlock({
  code,
  copy,
}: {
  code: string
  copy: (text: string) => void
}) {
  return (
    <div className="six-code">
      <div>
        <span>
          <Terminal size={13} /> Configuração
        </span>
        <button onClick={() => copy(code)}>
          <Copy size={13} /> Copiar
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}


function DashboardNumber({ value, format = "compact" }: { value: number; format?: "compact" | "money" | "percent" | "integer" | "decimal"; replay?: string }) {
  // Explicit dashboard animation preference requested by the user.
  const reducedMotion = false
  const target = useRef<HTMLSpanElement>(null)
  const visible = useInView(target, { amount: 0.3 })
  const divisor = format === "compact" ? (value >= 1000000 ? 1000000 : value >= 1000 ? 1000 : 1) : 1
  const suffix = format === "percent" ? "%" : divisor === 1000000 ? " mi" : divisor === 1000 ? " mil" : ""
  const decimals = format === "money" ? 2 : format === "percent" || format === "decimal" ? 1 : divisor > 1 ? 2 : 0
  const label = format === "money" ? money(value) : format === "percent" ? value.toFixed(1).replace(".", ",") + "%" : format === "integer" ? n(value) : format === "decimal" ? value.toFixed(1).replace(".", ",") : compact(value)
  return <span ref={target} className="six-animated-number" role="img" aria-label={label}><span aria-hidden="true"><NumberRoller key={String(visible)} animateOnMount={!reducedMotion && visible} value={value / divisor} decimals={decimals} prefix={format === "money" ? "R$ " : ""} suffix={suffix} duration={reducedMotion ? 0 : 1.6} /></span></span>
}

export default function DashboardPage() {
  const { user, session, signOut } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem("six-dashboard-theme") || "dark")
  useEffect(() => { localStorage.setItem("six-dashboard-theme", theme) }, [theme])
  const [tab, setTab] = useState<Tab>("overview")
  const allowDemo = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  const [demo, setDemo] = useState(() => allowDemo && new URLSearchParams(window.location.search).get("demo") === "1")
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("six-sidebar-collapsed") === "true")
  useEffect(() => { localStorage.setItem("six-sidebar-collapsed", String(collapsed)) }, [collapsed])
  const [drawer, setDrawer] = useState(false)
  const [period, setPeriod] = useState("30")
  const [from, setFrom] = useState(dayKey(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(dayKey(new Date()))
  const [modelFilter, setModelFilter] = useState("Todos os modelos")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState("")
  const [tool, setTool] = useState("claude")
  const [os, setOs] = useState("powershell")
  const [clientKey, setClientKey] = useState("")
  const [reveal, setReveal] = useState(false)
  const [accountData, setAccountData] = useState<{ owner: string; keys: KeyRow[]; rows: RequestRow[]; trial:AccountTrial|null } | null>(null)
  const keys = accountData?.owner === session?.user.id ? accountData?.keys || [] : []
  const trial = accountData?.owner === session?.user.id ? accountData?.trial : null
  const [accountError, setAccountError] = useState("")
  const [busy, setBusy] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [claimKey, setClaimKey] = useState("")
  const [issuedKey, setIssuedKey] = useState("")
  const [revokeId, setRevokeId] = useState("")
  const [keyState, setKeyState] =
    useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [refresh, setRefresh] = useState(0)
  const [inputRate, setInputRate] = useState(15)
  const [outputRate, setOutputRate] = useState(75)
  const [formula, setFormula] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)
  const demoRows = useMemo(demoRequests, [])
  const rows = demo ? demoRows : accountData?.owner === session?.user.id ? accountData?.rows || [] : []
  const metricsReady = demo || (keyState === "loaded" && accountData?.owner === session?.user.id)
  const name = user?.name || (demo ? "Alysson" : "dev")

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    setPage(1)
  }, [period, from, to, modelFilter, search])
  useEffect(() => {
    setIssuedKey("")
    setClientKey("")
    setClaimKey("")
    setRevokeId("")
  }, [session?.user.id, demo])
  useEffect(() => {
    if (demo || !session?.user.id) { setKeyState("idle"); setAccountData(null); return }
    const controller = new AbortController()
    const owner = session.user.id
    let pending = false
    const now = new Date()
    const first = period === "custom" ? from : dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(period) + 1))
    const last = period === "custom" ? to : dayKey(now)
    setKeyState("loading")
    async function load() {
      if (pending) return
      pending = true
      try {
        const data = await accountSummary(first, last, controller.signal)
        if (controller.signal.aborted) return
        const labels: Record<string,string> = { "claude-fable-5-1": "Fable 5.1", "gpt-6-astra": "Astra 6", "glm-5": "GLM 5" }
        setAccountData({ owner, keys: data.keys, trial:data.trial||null, rows: data.usage.map(r => ({ id: String(r.id), date: r.created_at, model: labels[r.requested_alias] || r.requested_alias, input: r.input_tokens, output: r.output_tokens, duration: r.latency_ms / 1000, success: r.status_code >= 200 && r.status_code < 400 })) })
        setAccountError("")
        setKeyState("loaded")
      } catch (error) {
        if (controller.signal.aborted) return
        setAccountError(error instanceof Error ? error.message : "Não foi possível carregar sua conta.")
        setKeyState("error")
      } finally { pending = false }
    }
    load()
    const timer = setInterval(load, 30000)
    return () => { controller.abort(); clearInterval(timer) }
  }, [demo, session?.user.id, period, from, to, refresh])
  async function mutateAccount(action: "claim" | "keys" | "revoke", payload: Record<string,unknown>) {
    setBusy(true); setAccountError("")
    try {
      const result = await accountRequest<{ key?: string }>(action, payload)
      if (result.key) { setIssuedKey(result.key); setClientKey(result.key); setNewKeyName("") }
      if (action === "claim") setClaimKey("")
      setRevokeId("")
      setRefresh(v => v + 1)
      setToast(action === "keys" ? "Chave criada. Copie e guarde agora." : action === "claim" ? "Chave vinculada à sua conta." : "Chave revogada.")
    } catch (error) { setAccountError(error instanceof Error ? error.message : "Não foi possível concluir.") }
    finally { setBusy(false) }
  }

  const filtered = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    if (period !== "custom")
      cutoff.setDate(cutoff.getDate() - (Number(period) - 1))
    return rows.filter((r) => {
          const day = dayKey(new Date(r.date))
          const within =
            period === "custom"
              ? day >= from && day <= to
              : new Date(r.date) >= cutoff
          return (
            within &&
            (modelFilter === "Todos os modelos" || r.model === modelFilter) &&
            `${r.model} ${r.id}`.toLowerCase().includes(search.toLowerCase())
          )
        })
  }, [rows, demo, period, from, to, modelFilter, search])
  const input = filtered.reduce((sum, row) => sum + row.input, 0)
  const output = filtered.reduce((sum, row) => sum + row.output, 0)
  const success = filtered.length
    ? (filtered.filter((r) => r.success).length / filtered.length) * 100
    : 0
  const average = filtered.length
    ? filtered.reduce((s, r) => s + r.duration, 0) / filtered.length
    : 0
  const byModel = models.map((model) => ({
    model,
    tokens: filtered
      .filter((r) => r.model === model)
      .reduce((sum, r) => sum + r.input + r.output, 0),
  }))
  const chartDays = useMemo(() => {
    const start =
      period === "custom" ? new Date(`${from}T00:00:00`) : new Date()
    if (period !== "custom") {
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - Number(period) + 1)
    }
    const end = period === "custom" ? new Date(`${to}T23:59:59`) : new Date()
    const days: Array<{ date: string; tokens: number }> = []
    const cursor = new Date(start)
    while (cursor <= end && days.length < 366) {
      const date = dayKey(cursor)
      days.push({
        date,
        tokens: filtered
          .filter((r) => dayKey(new Date(r.date)) === date)
          .reduce((s, r) => s + r.input + r.output, 0),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [period, from, to, filtered])
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const maximum = Math.max(...chartDays.map((d) => d.tokens), 1)
  const points = chartDays
    .map(
      (d, i) =>
        `${36 + (i / Math.max(chartDays.length - 1, 1)) * 704},${190 - (d.tokens / maximum) * 155}`,
    )
    .join(" ")
  const numberReplay = `${tab}-${period}-${from}-${to}-${modelFilter}-${demo}`
  const inputCost = input / 1000000 * inputRate
  const outputCost = output / 1000000 * outputRate
  const reference = inputCost + outputCost
  const planCost = demo ? 119 : keys.some(k => k.active) ? 0 : null
  const canEstimate = metricsReady && planCost !== null
  const saving = Math.max(0, reference - (planCost ?? 0))
  const switchTab = (next: Tab) => {
    setTab(next)
    setDrawer(false)
    setSearch("")
    setModelFilter("Todos os modelos")
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setToast("Copiado para a área de transferência")
    } catch {
      setToast(
        "Não foi possível copiar. Selecione o texto e copie manualmente.",
      )
    }
  }
  function exportCsv() {
    const csv =
      "\uFEFF" +
      [
        "demonstracao;data;modelo;tokens_entrada;tokens_saida;duracao_s;resultado",
        ...filtered.map(
          (r) =>
            `${demo ? "sim" : "nao"};${r.date};${r.model};${r.input};${r.output};${r.duration.toFixed(1)};${
              r.success ? "concluida" : "falhou"
            }`,
        ),
      ].join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = demo ? "sixtysix-demonstracao-consumo.csv" : "sixtysix-consumo.csv"
    a.click()
    URL.revokeObjectURL(url)
  }
  const actualKey = clientKey.trim() || "SUA_CHAVE_INDIVIDUAL"
  const shellKey =
    os === "bash"
      ? `'${actualKey.replace(/'/g, `'"'"'`)}'`
      : os === "powershell"
        ? `'${actualKey.replace(/'/g, "''")}'`
        : actualKey
  const claudeCode =
    os === "powershell"
      ? `$env:ANTHROPIC_BASE_URL='https://www.sixtysix.online'\n$env:ANTHROPIC_API_KEY=${shellKey}\n$env:ANTHROPIC_MODEL='claude-fable-5-1'\nclaude --model claude-fable-5-1`
      : os === "cmd"
        ? `set ANTHROPIC_BASE_URL=https://www.sixtysix.online\nset "ANTHROPIC_API_KEY=${actualKey.replace(/[\r\n"]/g, "")}"\nset ANTHROPIC_MODEL=claude-fable-5-1\nclaude --model claude-fable-5-1`
        : `export ANTHROPIC_BASE_URL='https://www.sixtysix.online'\nexport ANTHROPIC_API_KEY=${shellKey}\nexport ANTHROPIC_MODEL='claude-fable-5-1'\nclaude --model claude-fable-5-1`
  const codexConfig = `model = "gpt-6-astra"\nmodel_provider = "sixtysix"\nweb_search = "disabled"\n\n[model_providers.sixtysix]\nname = "Gateway"\nbase_url = "https://www.sixtysix.online/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nenv_http_headers = { "x-api-key" = "SIXTYSIX_GATEWAY_API_KEY" }\nmodel_catalog_url = "https://www.sixtysix.online/api/codex/models"`
  const sectionTitle =
    nav.find((v) => v.id === tab)?.label || "Central de ajuda"
  const empty = (title: string, description: string, action?: ReactNode) => (
    <div className="six-empty">
      <span>
        <Activity size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
  const table = (limit = 8) => (
    <>
      <div className="six-table-scroll">
        <table className="six-table">
          <thead>
            <tr>
              <th>Modelo / solicitação</th>
              <th>Data e hora</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Duração</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice(
                (tab === "usage" ? page - 1 : 0) * limit,
                (tab === "usage" ? page : 1) * limit,
              )
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    <span
                      className={`six-model-icon ${
                        r.model === "Astra 6"
                          ? "astra"
                          : r.model === "GLM 5"
                            ? "glm"
                            : ""
                      }`}
                    >
                      <img
                        src={`/assets/brands/${
                          r.model === "Fable 5.1"
                            ? "claude"
                            : r.model === "Astra 6"
                              ? "openai"
                              : "glm"
                        }.svg`}
                        alt=""
                      />
                    </span>
                    <span>
                      <strong>{r.model}</strong>
                      <small>{r.id}</small>
                    </span>
                  </td>
                  <td>
                    {dateLabel(r.date)}
                    <small>
                      {new Date(r.date).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </td>
                  <td>{<DashboardNumber value={r.input} format="integer" replay={numberReplay} />}</td>
                  <td>{<DashboardNumber value={r.output} format="integer" replay={numberReplay} />}</td>
                  <td><DashboardNumber value={r.duration} format="decimal" replay={numberReplay} /> s</td>
                  <td>
                    <span className={`six-status ${r.success ? "" : "failed"}`}>
                      {r.success ? <Check size={11} /> : <X size={11} />}
                      {r.success ? "Concluída" : "Falhou"}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!filtered.length &&
        empty(
          demo
            ? "Nenhuma solicitação neste filtro"
            : "Seu histórico aparecerá aqui",
          demo
            ? "Experimente outro período ou modelo."
            : "O histórico de consumo ainda precisa ser conectado à sua conta.",
        )}
    </>
  )

  return (
    <div className="six-dashboard" data-theme={theme} data-collapsed={collapsed}>
      {drawer && (
        <button
          className="six-overlay"
          aria-label="Fechar menu"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`six-sidebar ${drawer ? "open" : ""}`}>
        <button className="six-sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"} title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
        <Link to="/" className="six-brand">
          <span className="six-brand-mark"><img src="/assets/sx-crown.png" alt="SixtySix SX com coroa dourada" /></span>
          <span className="six-brand-word">
            SixtySix<span>workspace</span>
          </span>
        </Link>
        <div className="six-workspace">
          <span className="six-workspace-icon">
            {name.charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>Meu workspace</strong>
            <small>Conta individual</small>
          </span>
          <ShieldCheck size={15} />
        </div>
        <div className="six-nav-label">PLATAFORMA</div>
        <nav aria-label="Navegação do dashboard">
          {nav.map((item) => (
            <button
              key={item.id}
              title={item.label}
              aria-label={item.label}
              className={tab === item.id ? "active" : ""}
              onClick={() => switchTab(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "guides" && <span className="six-nav-count">4</span>}
            </button>
          ))}
        </nav>
        <div className="six-sidebar-bottom">
          <div className="six-help-card">
            <span>
              <Sparkles size={17} /> Pronto para criar?
            </span>
            <p>Sua próxima ideia começa com uma boa conexão.</p>
            <button onClick={() => switchTab("guides")}>
              Conectar minha IDE <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="six-help-link" onClick={() => switchTab("help")}>
            <CircleHelp size={18} /> Central de ajuda <ArrowUpRight size={14} />
          </button>
          <div className="six-profile">
            <span className="six-avatar">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" />
              ) : (
                name.charAt(0)
              )}
            </span>
            <span>
              <strong title={name}>{name}</strong>
              <small>
                {demo
                  ? "Workspace de demonstração"
                  : user?.email || "Entre na sua conta"}
              </small>
            </span>
            {session && <Link to="/onboarding?edit=true" className="six-profile-edit" aria-label="Editar nome de exibição" title="Editar meu nome"><Settings2 size={16} /></Link>}
            <button
              aria-label={session ? "Sair da conta" : "Ir para login"}
              onClick={() =>
                session
                  ? signOut().then(() => window.location.assign("/login"))
                  : window.location.assign("/login")
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="six-main-shell">
        <header className="six-topbar">
          <div>
            <button
              className="six-mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setDrawer(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{sectionTitle}</strong>
          </div>
          <div>
            <button className="six-theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title="Alternar aparência">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
            <span className="six-connection">
              <span /> Gateway SixtySix
            </span>
            <a
              href="https://www.sixtysix.online/claude-code#passo-a-passo"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={16} />
              <span>Documentação</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        <main className="six-main">
          <div className="six-demo-bar">
            <span>
              <span className="six-demo-dot" />
              {demo ? "Você está explorando uma demonstração" : "Seu workspace"}
              <small>
                {demo
                  ? "Consumo, valores e plano são ilustrativos."
                  : session ? "Dados vinculados à sua conta autenticada." : "Entre para vincular os dados da sua conta."}
              </small>
            </span>
            {allowDemo && <button
              onClick={() => {
                setDemo(!demo)
                setClientKey("")
              }}
            >
              {demo ? "Ver minha conta" : "Explorar demonstração"}
              <ArrowRight size={14} />
            </button>}
          </div>
          {!demo && <div className="six-account-status" role="status">{!session ? <><span>Entre para acompanhar seu consumo real.</span><Link to="/login">Entrar</Link></> : accountError ? <><span>{accountError}</span><button onClick={() => setRefresh(v => v + 1)}>Tentar novamente</button></> : keyState === "loading" ? "Atualizando sua conta…" : <><span>Consumo real · atualização automática a cada 30 segundos</span><button onClick={() => setRefresh(v => v + 1)}>Atualizar</button></>}</div>}
          <div className="six-heading">
            <div>
              <p className="six-kicker">SEU ESPAÇO PARA CONSTRUIR</p>
              <h1>
                {tab === "overview"
                  ? `Tudo certo por aqui, ${name}.`
                  : sectionTitle}
                <span className="six-heading-dot">
                  {tab === "overview" ? "✳" : ""}
                </span>
              </h1>
              <p>
                {tab === "overview"
                  ? "Mais clareza sobre seu uso. Mais tempo para suas ideias."
                  : tab === "guides"
                    ? "Da sua chave à primeira resposta, sem complicação."
                    : tab === "usage"
                      ? "Cada solicitação, cada token. Tudo em um só lugar."
                      : tab === "keys"
                        ? "O ponto de partida para conectar suas ferramentas."
                        : tab === "plan"
                          ? "Seu acesso, seus benefícios e os próximos passos."
                          : "Vamos colocar suas ferramentas para funcionar."}
              </p>
            </div>
            {tab === "overview" ? (
              <button
                className="six-primary"
                onClick={() => switchTab("guides")}
              >
                <PlusIcon />
                Conectar ferramenta
              </button>
            ) : tab === "usage" ? (
              <button
                className="six-secondary"
                disabled={!metricsReady || !filtered.length}
                onClick={exportCsv}
              >
                <Download size={15} /> Exportar CSV
              </button>
            ) : null}
          </div>

          {(tab === "overview" || tab === "usage") && (
            <>
              <div className="six-filters">
                <div className="six-periods">
                  {[
                    ["1", "Hoje"],
                    ["7", "7 dias"],
                    ["30", "Últimos 30 dias"],
                    ["custom", "Personalizar"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={period === value ? "selected" : ""}
                      onClick={() => setPeriod(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="six-select">
                  <Settings2 size={14} />
                  <select
                    aria-label="Filtrar por modelo"
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                  >
                    {["Todos os modelos", ...models].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
              {period === "custom" && (
                <div className="six-date-range">
                  <label>
                    De{" "}
                    <input
                      type="date"
                      value={from}
                      max={to}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Até{" "}
                    <input
                      type="date"
                      value={to}
                      min={from}
                      max={dayKey(new Date())}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <span>
                    {from > to
                      ? "Selecione um intervalo válido."
                      : "Intervalos de até 366 dias."}
                  </span>
                </div>
              )}
              <div className="six-stats">
                <article className="six-stat">
                  <span>
                    <Zap size={16} />
                    Tokens consumidos
                  </span>
                  <strong>
                    {metricsReady ? <DashboardNumber value={input + output} replay={numberReplay} /> : "—"}
                    <small>tokens</small>
                  </strong>
                  <p>
                    <span className="six-dot emerald" />
                    {metricsReady
                      ? <><DashboardNumber value={filtered.length} format="integer" replay={numberReplay} /> solicitações no período</>
                      : "Aguardando integração do consumo"}
                  </p>
                  <div className="six-mini-bars">
                    {[3, 5, 4, 8, 6, 9, 7, 11, 8, 13, 11, 16].map((h, i) => (
                      <i key={i} style={{ height: metricsReady ? h * 2 : 3 }} />
                    ))}
                  </div>
                </article>
                <article className="six-stat">
                  <span>
                    <ArrowDownLeft size={16} />
                    Tokens de entrada
                  </span>
                  <strong>
                    {metricsReady ? <DashboardNumber value={input} replay={numberReplay} /> : "—"}
                    <small>tokens</small>
                  </strong>
                  <p>Contexto enviado às suas ferramentas</p>
                </article>
                <article className="six-stat">
                  <span>
                    <ArrowUpRight size={16} />
                    Tokens de saída
                  </span>
                  <strong>
                    {metricsReady ? <DashboardNumber value={output} replay={numberReplay} /> : "—"}
                    <small>tokens</small>
                  </strong>
                  <p>Respostas geradas no período</p>
                </article>
                <article className="six-stat">
                  <span>
                    <CircleCheck size={16} />
                    Solicitações concluídas
                  </span>
                  <strong>
                    {metricsReady ? <DashboardNumber value={success} format="percent" replay={numberReplay} /> : "—"}
                  </strong>
                  <p>
                    {metricsReady
                      ? <>Tempo médio de <DashboardNumber value={average} format="decimal" replay={numberReplay} /> s por resposta</>
                      : "Sem métricas disponíveis"}
                  </p>
                </article>
              </div>
              {tab === "overview" && (
                <div className="six-chart-grid">
                  <section className="six-panel six-consumption">
                    <div className="six-panel-head">
                      <div>
                        <h2>
                          <Activity size={16} /> Seu ritmo de criação
                        </h2>
                        <p>Consumo de tokens ao longo do período</p>
                      </div>
                      <span className="six-legend">
                        <i /> Tokens totais
                      </span>
                    </div>
                    {metricsReady && chartDays.length ? (
                      <div className="six-chart">
                        <div className="six-chart-value">
                          {<DashboardNumber value={input + output} replay={numberReplay} />}
                          <span>tokens no período</span>
                        </div>
                        <svg
                          viewBox="0 0 780 220"
                          role="img"
                          aria-label="Gráfico demonstrativo de consumo de tokens por dia"
                          onMouseLeave={() => setHoverDay(null)}
                          onMouseMove={(event) => {
                            const rect =
                              event.currentTarget.getBoundingClientRect()
                            setHoverDay(
                              Math.max(
                                0,
                                Math.min(
                                  chartDays.length - 1,
                                  Math.round(
                                    ((((event.clientX - rect.left) /
                                      rect.width) *
                                      780 -
                                      36) /
                                      704) *
                                      (chartDays.length - 1),
                                  ),
                                ),
                              ),
                            )
                          }}
                        >
                          <defs>
                            <linearGradient
                              id="six-area"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#25a879"
                                stopOpacity=".2"
                              />
                              <stop
                                offset="100%"
                                stopColor="#25a879"
                                stopOpacity="0"
                              />
                            </linearGradient>
                          </defs>
                          {[35, 87, 139, 190].map((y, i) => (
                            <g key={y}>
                              <line
                                x1="36"
                                x2="740"
                                y1={y}
                                y2={y}
                                stroke="#e9eeeb"
                                strokeDasharray="4 5"
                              />
                              <text
                                x="0"
                                y={y + 4}
                                fontSize="10"
                                fill="#8a9992"
                              >
                                {compact((maximum * (3 - i)) / 3)}
                              </text>
                            </g>
                          ))}
                          <polygon
                            points={`36,190 ${points} ${
                              chartDays.length === 1 ? "740,190" : "740,190"
                            }`}
                            fill="url(#six-area)"
                          />
                          <polyline
                            points={points}
                            fill="none"
                            stroke="#249f75"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                          />
                          {chartDays.length === 1 && (
                            <circle
                              cx="36"
                              cy={190 - (chartDays[0].tokens / maximum) * 155}
                              r="4"
                              fill="#249f75"
                            />
                          )}
                          {hoverDay !== null && chartDays[hoverDay] && (
                            <g>
                              <line
                                x1={
                                  36 +
                                  (hoverDay /
                                    Math.max(chartDays.length - 1, 1)) *
                                    704
                                }
                                x2={
                                  36 +
                                  (hoverDay /
                                    Math.max(chartDays.length - 1, 1)) *
                                    704
                                }
                                y1="25"
                                y2="190"
                                stroke="#7fa996"
                                strokeDasharray="3 3"
                              />
                              <circle
                                cx={
                                  36 +
                                  (hoverDay /
                                    Math.max(chartDays.length - 1, 1)) *
                                    704
                                }
                                cy={
                                  190 -
                                  (chartDays[hoverDay].tokens / maximum) * 155
                                }
                                r="4"
                                fill="#fff"
                                stroke="#249f75"
                                strokeWidth="2"
                              />
                            </g>
                          )}
                        </svg>
                        <div className="six-chart-labels">
                          {chartDays
                            .filter(
                              (_, i) =>
                                i %
                                  Math.max(
                                    1,
                                    Math.floor(chartDays.length / 5),
                                  ) ===
                                0,
                            )
                            .slice(0, 6)
                            .map((d) => (
                              <span key={d.date}>
                                {dateLabel(d.date + "T12:00:00")}
                              </span>
                            ))}
                        </div>
                        <p className="six-chart-hover" aria-live="polite">
                          {hoverDay !== null && chartDays[hoverDay]
                            ? `${dateLabel(chartDays[hoverDay].date + "T12:00:00")} · ${n(chartDays[hoverDay].tokens)} tokens`
                            : "Passe pelo gráfico para ver os detalhes de cada dia."}
                        </p>
                      </div>
                    ) : (
                      empty(
                        "Seu consumo, em perspectiva",
                        "Assim que o histórico estiver conectado, você poderá acompanhar seu ritmo por aqui.",
                      )
                    )}
                  </section>
                  <section className="six-panel six-models">
                    <div className="six-panel-head">
                      <div>
                        <h2>Seus modelos</h2>
                        <p>Participação no consumo</p>
                      </div>
                      <span className="six-soft-icon">
                        <Sparkles size={17} />
                      </span>
                    </div>
                    <div
                      className="six-donut"
                      style={{
                        background:
                          metricsReady && input + output > 0
                            ? `conic-gradient(#247e61 0 ${(byModel[0].tokens / (input + output)) * 100}%, #a5d9a3 0 ${((byModel[0].tokens + byModel[1].tokens) / (input + output)) * 100}%, #e2edb2 0 100%)`
                            : "#eef2ef",
                      }}
                    >
                      <div>
                        <strong>{metricsReady ? <DashboardNumber value={input + output} replay={numberReplay} /> : "—"}</strong>
                        <span>tokens totais</span>
                      </div>
                    </div>
                    <div className="six-model-list">
                      {byModel.map((m, i) => (
                        <div key={m.model}>
                          <span>
                            <i
                              style={{
                                background: ["#247e61", "#a5d9a3", "#e2edb2"][
                                  i
                                ],
                              }}
                            />
                            {m.model}
                          </span>
                          <strong>
                            {metricsReady
                              ? <DashboardNumber value={Math.round(input + output ? m.tokens / (input + output) * 100 : 0)} format="percent" replay={numberReplay} />
                              : "—"}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
              {tab === "overview" && (
                <div className="six-bottom-grid">
                  <section className="six-savings">
                    <div>
                      <span className="six-pill">
                        <Sparkles size={12} /> Economia estimada
                      </span>
                      <h2>Mais espaço para criar.<br />Menos custo no mês.</h2>
                      <div className="six-saving-total"><strong>{canEstimate ? <DashboardNumber value={saving} format="money" replay={numberReplay} /> : "—"}<small>de economia estimada no consumo selecionado</small></strong><span>{canEstimate && reference > (planCost ?? 0) ? <>−<DashboardNumber value={Math.round(saving / reference * 100)} format="percent" replay={numberReplay} /></> : "—"}</span></div>
                      <div className="six-cost-comparison">
                        <div><span>Custo de referência por tokens</span><b>{metricsReady ? <DashboardNumber value={reference} format="money" replay={numberReplay} /> : "—"}</b><i><em style={{width:"100%"}} /></i></div>
                        <div><span>{demo ? "SixtySix · mensalidade integral" : "SixtySix · teste sem cobrança"}</span><b>{canEstimate ? <DashboardNumber value={planCost ?? 0} format="money" replay={numberReplay} /> : "—"}</b><i><em style={{width: canEstimate ? `${Math.min(100,(planCost ?? 0) / Math.max(1, reference) * 100)}%` : "0%"}} /></i></div>
                      </div>
                      <div className="six-token-costs"><span>Entrada <b><DashboardNumber value={inputCost} format="money" replay={numberReplay} /></b><small><DashboardNumber value={input} replay={numberReplay} /> tokens</small></span><span>Saída <b><DashboardNumber value={outputCost} format="money" replay={numberReplay} /></b><small><DashboardNumber value={output} replay={numberReplay} /> tokens</small></span></div>
                      <p>{demo ? "Simulação por tokens, com tarifas ilustrativas editáveis. Compara o consumo filtrado com a mensalidade integral de R$ 119, sem rateio." : canEstimate ? "Estimativa com seus tokens reais e preços de referência editáveis. Seu acesso de teste não tem cobrança." : "Vincule sua chave de teste para calcular a estimativa com seu consumo."}</p>
                      <button onClick={() => setFormula(!formula)}>
                        Como calculamos <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <img
                      src="/assets/plan-cash.webp"
                      alt="Ilustração de notas verdes"
                    />
                    {formula && (
                      <div className="six-formula">
                        <div className="six-rate-fields"><label>Entrada · R$ por 1 milhão<input type="number" min="0" max="100000" step="0.01" value={inputRate} onChange={e => setInputRate(Math.min(100000, Math.max(0, Number(e.target.value) || 0)))} /></label><label>Saída · R$ por 1 milhão<input type="number" min="0" max="100000" step="0.01" value={outputRate} onChange={e => setOutputRate(Math.min(100000, Math.max(0, Number(e.target.value) || 0)))} /></label></div>
                        <p>({n(input)} ÷ 1.000.000 × {money(inputRate)}) + ({n(output)} ÷ 1.000.000 × {money(outputRate)}) = {money(reference)}. Economia = máximo entre zero e esse custo menos {money(planCost ?? 0)}. Os preços são hipóteses da simulação, aplicados aos modelos filtrados; não são uma tabela oficial. Mude-os para a referência que deseja comparar.</p>
                      </div>
                    )}
                  </section>
                  <section className="six-panel six-quickstart">
                    <div className="six-panel-head">
                      <div>
                        <h2>Sua próxima conexão</h2>
                        <p>Escolha uma ferramenta e comece a construir.</p>
                      </div>
                      <Terminal size={19} />
                    </div>
                    {[
                      [
                        "claude",
                        "Claude Code",
                        "No seu terminal, do seu jeito.",
                        "claude",
                      ],
                      [
                        "codex",
                        "Codex",
                        "Seu workspace com Astra 6.",
                        "openai",
                      ],
                      ["glm", "ZCode", "Conecte o perfil GLM 5.", "glm"],
                    ].map(([id, title, desc, icon]) => (
                      <button
                        key={id}
                        onClick={() => {
                          setTool(id)
                          switchTab("guides")
                        }}
                      >
                        <span className="six-tool-icon">
                          <img src={`/assets/brands/${icon}.svg`} alt="" />
                        </span>
                        <span>
                          <strong>{title}</strong>
                          <small>{desc}</small>
                        </span>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </section>
                </div>
              )}
              <section className="six-panel six-history">
                <div className="six-panel-head">
                  <div>
                    <h2>
                      Atividade {tab === "overview" ? "recente" : "do período"}
                    </h2>
                    <p>
                      {demo
                        ? "Solicitações ilustrativas do seu workspace de demonstração"
                        : "Acompanhe o uso da sua chave individual"}
                    </p>
                  </div>
                  {tab === "overview" ? (
                    <button
                      className="six-text-button"
                      onClick={() => switchTab("usage")}
                    >
                      Ver todo o consumo <ArrowRight size={14} />
                    </button>
                  ) : (
                    <label className="six-search">
                      <Search size={15} />
                      <input
                        placeholder="Buscar modelo ou solicitação"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                  )}
                </div>
                {table(tab === "overview" ? 4 : 10)}
                {tab === "usage" && filtered.length > 0 && (
                  <div className="six-pagination">
                    <span>
                      {n(filtered.length)} solicitações · página {page} de{" "}
                      {Math.ceil(filtered.length / 10)}
                    </span>
                    <div>
                      <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Anterior
                      </button>
                      <button
                        disabled={page >= Math.ceil(filtered.length / 10)}
                        onClick={() => setPage(page + 1)}
                      >
                        Próxima <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {tab === "keys" && (
            <>
              <section className="six-panel six-key-intro">
                <span className="six-key-large">
                  <KeyRound size={26} />
                </span>
                <div>
                  <h2>Uma chave sua. Todas as suas ferramentas.</h2>
                  <p>
                    Use sua chave individual para configurar os perfis
                    disponíveis no seu acesso.
                  </p>
                </div>
                <button
                  className="six-primary"
                  onClick={() => switchTab("guides")}
                >
                  Configurar ferramenta <ArrowRight size={15} />
                </button>
              </section>
              {!demo && session && <section className="six-panel six-account-key-actions">
                {trial?<><h2>{trial.active?'Seu teste de 7 dias está ativo':'Teste de 7 dias encerrado'}</h2><p>{trial.revoked?'Chave revogada.':`Prazo: ${new Date(trial.expires).toLocaleString('pt-BR')}.`}</p><Link className="six-primary" to={trial.active?'/teste-gratis':'/planos'}>{trial.active?'Consultar minha chave de teste':'Ver planos'}</Link></>:<><h2>Comece seu teste grátis</h2><p>Ative uma chave individual por 7 dias, sem cartão.</p><Link className="six-primary" to="/teste-gratis">Ativar meus 7 dias</Link></>}
                <h2>Já tem uma chave de teste?</h2><p>Vincule sua chave atual para consultar o histórico. A chave continua funcionando nos seus aplicativos.</p>
                <form onSubmit={e => { e.preventDefault(); mutateAccount("claim", { key: claimKey }) }}><input type="password" autoComplete="off" aria-label="Chave de teste existente" placeholder="Cole sua chave individual sk-flg-…" value={claimKey} onChange={e => setClaimKey(e.target.value)} /><button className="six-primary" disabled={busy || !claimKey.trim()}>Vincular chave</button></form>
                <h2>Criar outra chave</h2><p>Acessos anteriores vinculados podem criar até 10 chaves ativas. O teste automático usa uma chave para todas as suas ferramentas.</p>
                <form onSubmit={e => { e.preventDefault(); mutateAccount("keys", { name: newKeyName }) }}><input aria-label="Nome da nova chave" maxLength={80} placeholder="Ex.: meu notebook" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} /><button className="six-secondary" disabled={busy || !newKeyName.trim() || !keys.some(k => k.active&&!k.managed)}>Criar chave</button></form>
                {issuedKey && <div className="six-issued-key"><strong>Copie agora. Esta chave só é exibida nesta sessão.</strong><code>{issuedKey}</code><button onClick={() => copy(issuedKey)}>Copiar chave</button><button onClick={() => setIssuedKey("")}>Já guardei</button></div>}
              </section>}
              <section className="six-panel">
                <div className="six-panel-head">
                  <div>
                    <h2>Minhas chaves</h2>
                    <p>
                      {demo
                        ? "Exemplo visual. Esta chave não autentica solicitações."
                        : "Chaves cadastradas para sua conta"}
                    </p>
                  </div>
                  <button
                    className="six-icon-button"
                    aria-label="Atualizar chaves"
                    onClick={() => setRefresh(refresh + 1)}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                {demo ? (
                  <div className="six-demo-key">
                    <KeyRound size={20} />
                    <div>
                      <strong>Minha chave de desenvolvimento</strong>
                      <code>DEMO •••••••• ••••••••</code>
                    </div>
                    <span className="six-pill">Ilustrativa</span>
                  </div>
                ) : !session ? (
                  empty(
                    "Entre para ver suas chaves",
                    "Seu cadastro e suas chaves ficam associados à sua conta.",
                    <Link className="six-primary" to="/login">
                      Entrar na SixtySix <ArrowRight size={14} />
                    </Link>,
                  )
                ) : keyState === "loading" ? (
                  empty(
                    "Carregando suas chaves",
                    "Consultando os dados da sua conta.",
                  )
                ) : keyState === "error" ? (
                  empty(
                    "Não foi possível carregar as chaves",
                    "Tente novamente. Se persistir, entre em contato com o suporte.",
                    <button
                      className="six-secondary"
                      onClick={() => setRefresh(refresh + 1)}
                    >
                      Tentar novamente
                    </button>,
                  )
                ) : keys.length ? (
                  <div className="six-table-scroll">
                    <table className="six-table">
                      <thead>
                        <tr>
                          <th>Nome</th>
                          <th>Prefixo</th>
                          <th>Criada em</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map((k) => (
                          <tr key={k.id}>
                            <td>
                              <strong>{k.name}</strong>
                            </td>
                            <td>
                              <code>{k.prefix}••••••••</code>
                            </td>
                            <td>{dateLabel(k.created)}</td>
                            <td>
                              <span className="six-status">
                                {k.active ? "Ativa" : "Inativa"}
                              </span>
                            </td>
                            <td>{k.active && (revokeId === k.id ? <span><button disabled={busy} onClick={() => mutateAccount("revoke", { id: k.id })}>Confirmar revogação</button> <button onClick={() => setRevokeId("")}>Cancelar</button></span> : <button onClick={() => setRevokeId(k.id)}>Revogar</button>)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  empty(
                    "Sua chave começa aqui",
                    "Vincule sua chave de teste no formulário acima. Se ainda não recebeu uma, solicite ao suporte.",
                    <a
                      className="six-primary"
                      href="mailto:alisongeneral25@gmail.com?subject=Chave%20individual%20SixtySix"
                    >
                      Solicitar minha chave <ArrowUpRight size={14} />
                    </a>,
                  )
                )}
              </section>
              <div className="six-note">
                <ShieldCheck size={18} />
                <p>
                  O segredo completo de uma chave não pode ser recuperado a
                  partir do prefixo. Use a chave entregue a você e guarde-a em
                  local seguro.
                </p>
              </div>
            </>
          )}

          {tab === "guides" && (
            <>
              <div className="six-guide-choices">
                {[
                  ["claude", "Claude Code", "Terminal", "claude"],
                  ["desktop", "Claude Desktop", "Aplicativo", "claude"],
                  ["codex", "Codex", "Terminal e desktop", "openai"],
                  ["glm", "ZCode", "Perfil GLM 5", "glm"],
                ].map(([id, title, desc, icon]) => (
                  <button
                    key={id}
                    className={tool === id ? "selected" : ""}
                    onClick={() => setTool(id)}
                  >
                    <img src={`/assets/brands/${icon}.svg`} alt="" />
                    <strong>{title}</strong>
                    <span>{desc}</span>
                    {tool === id && <CircleCheck size={15} />}
                  </button>
                ))}
              </div>
              <div className="six-guide-layout">
                <section className="six-panel six-guide">
                  <div className="six-panel-head">
                    <div>
                      <span className="six-kicker">PASSO A PASSO</span>
                      <h2>
                        {tool === "claude"
                          ? "Fable 5.1 no seu terminal"
                          : tool === "codex"
                            ? "Astra 6 no Codex"
                            : tool === "desktop"
                              ? "Fable 5.1 no Claude Desktop"
                              : "GLM 5 no ZCode"}
                      </h2>
                    </div>
                    <span className="six-pill">
                      {tool === "codex" ? "Responses" : "Anthropic"}
                    </span>
                  </div>
                  {(tool === "claude" || tool === "codex") && (
                    <div
                      className="six-os-tabs"
                      aria-label="Sistema ou terminal"
                    >
                      {[
                        ["powershell", "Windows · PowerShell"],
                        ["cmd", "Windows · CMD"],
                        ["bash", "macOS / Linux"],
                      ].map(([id, label]) => (
                        <button
                          className={os === id ? "selected" : ""}
                          key={id}
                          onClick={() => setOs(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  {tool === "claude" && (
                    <>
                      <GuideStep number="01" title="Instale o Claude Code">
                        <p>
                          Com Node.js e npm instalados, abra o terminal e
                          execute:
                        </p>
                        <CodeBlock
                          code="npm install -g @anthropic-ai/claude-code"
                          copy={copy}
                        />
                      </GuideStep>
                      <GuideStep
                        number="02"
                        title="Configure sua chave e inicie"
                      >
                        <p>
                          Os comandos abaixo valem para a janela atual. Use sua
                          chave individual no lugar do campo indicado.
                        </p>
                        <CodeBlock code={claudeCode} copy={copy} />
                      </GuideStep>
                      <GuideStep
                        number="03"
                        title="Faça sua primeira solicitação"
                      >
                        <p>
                          Ao abrir o Claude Code, envie uma mensagem curta. Caso
                          apareça uma tela de login da Anthropic, confira as
                          variáveis na mesma janela e reinicie o comando.
                        </p>
                      </GuideStep>
                    </>
                  )}
                  {tool === "codex" && (
                    <>
                      <GuideStep
                        number="01"
                        title="Salve sua chave no ambiente"
                      >
                        <p>
                          {os === "bash"
                            ? "Configure a variável nesta sessão do terminal."
                            : "Configure a variável e abra o Codex a partir dessa mesma janela."}
                        </p>
                        <CodeBlock
                          code={
                            os === "powershell"
                              ? `$env:SIXTYSIX_GATEWAY_API_KEY=${shellKey}`
                              : os === "cmd"
                                ? `set "SIXTYSIX_GATEWAY_API_KEY=${actualKey.replace(/[\r\n"]/g, "")}"`
                                : `export SIXTYSIX_GATEWAY_API_KEY=${shellKey}`
                          }
                          copy={copy}
                        />
                      </GuideStep>
                      <GuideStep
                        number="02"
                        title="Edite a configuração do Codex"
                      >
                        <p>
                          Abra{" "}
                          <code>
                            {os === "bash"
                              ? "~/.codex/config.toml"
                              : "%USERPROFILE%\\.codex\\config.toml"}
                          </code>
                          . Mescle os campos se o provedor já existir; evite
                          repetir a mesma tabela.
                        </p>
                        <CodeBlock code={codexConfig} copy={copy} />
                      </GuideStep>
                      <GuideStep
                        number="03"
                        title="Abra o Codex e selecione Astra 6"
                      >
                        <p>
                          Reinicie o aplicativo a partir do ambiente
                          configurado. O identificador deste perfil é{" "}
                          <code>gpt-6-astra</code>. GLM 5 usa outra
                          configuração, no ZCode.
                        </p>
                      </GuideStep>
                    </>
                  )}
                  {tool === "desktop" && (
                    <>
                      <GuideStep number="01" title="Confira a opção de gateway">
                        <p>
                          Nas configurações de conexão do Claude Desktop,
                          procure a opção Gateway. Ela precisa estar disponível
                          na sua versão do aplicativo.
                        </p>
                      </GuideStep>
                      <GuideStep number="02" title="Preencha as credenciais">
                        <CodeBlock
                          code={`Tipo: Chave de API estática\nURL base: https://www.sixtysix.online\nChave: ${actualKey}\nAutenticação: x-api-key\nModelo: claude-fable-5-1`}
                          copy={copy}
                        />
                      </GuideStep>
                      <GuideStep number="03" title="Salve, reinicie e teste">
                        <p>
                          Teste a conexão, salve as configurações e reinicie
                          quando solicitado. Se sua versão não oferecer gateway
                          personalizado, use o tutorial do Claude Code no
                          terminal.
                        </p>
                      </GuideStep>
                    </>
                  )}
                  {tool === "glm" && (
                    <>
                      <GuideStep
                        number="01"
                        title="Adicione um provedor personalizado"
                      >
                        <p>
                          No ZCode, abra Model Settings → Add Provider.
                          Selecione o formato compatível com Anthropic.
                        </p>
                      </GuideStep>
                      <GuideStep number="02" title="Configure o perfil GLM 5">
                        <CodeBlock
                          code={`Nome: SixtySix\nTipo: Anthropic personalizado\nBase URL: https://www.sixtysix.online/glm\nAPI Key: ${actualKey}\nModel ID: glm-5`}
                          copy={copy}
                        />
                      </GuideStep>
                      <GuideStep number="03" title="Ative o provedor e teste">
                        <p>
                          Salve, ative o provedor e selecione o perfil GLM 5.
                          Esta configuração é para o ZCode; ela não adiciona GLM
                          ao catálogo atual do Codex.
                        </p>
                      </GuideStep>
                    </>
                  )}
                </section>
                <aside className="six-guide-side">
                  <section className="six-panel">
                    <span className="six-soft-icon">
                      <KeyRound size={20} />
                    </span>
                    <h3>Deixe os comandos prontos</h3>
                    <p>Cole sua chave para preencher os exemplos desta tela.</p>
                    <label className="six-secret-input">
                      <input
                        aria-label="Sua chave individual"
                        type={reveal ? "text" : "password"}
                        autoComplete="off"
                        value={clientKey}
                        placeholder="Cole sua chave individual"
                        onChange={(e) =>
                          setClientKey(e.target.value.replace(/[\r\n]/g, ""))
                        }
                      />
                      <button
                        aria-label={reveal ? "Ocultar chave" : "Mostrar chave"}
                        onClick={() => setReveal(!reveal)}
                      >
                        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </label>
                    <small>
                      O preenchimento fica apenas na memória desta tela. Os
                      comandos copiados conterão sua chave.
                    </small>
                    {clientKey && (
                      <button
                        className="six-text-button"
                        onClick={() => setClientKey("")}
                      >
                        Limpar chave
                      </button>
                    )}
                  </section>
                  <section className="six-panel">
                    <ShieldCheck size={21} />
                    <h3>Não conectou?</h3>
                    <p>
                      Confira a URL, o identificador do modelo e se a chave está
                      completa. Não envie o segredo da chave ao compartilhar um
                      erro.
                    </p>
                    <button
                      className="six-text-button"
                      onClick={() => switchTab("help")}
                    >
                      Abrir central de ajuda <ArrowRight size={14} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}

          {tab === "plan" && (
            <>
              <div className="six-plan-grid">
                <section className="six-panel six-plan-main">
                  <span className="six-pill">
                    {demo ? "Plano ilustrativo" : "Minha assinatura"}
                  </span>
                  <h2>{demo ? "Pro" : trial?.active ? "Teste grátis · 7 dias" : keys.some(k => k.active) ? "Acesso de teste ativo" : trial ? "Teste encerrado" : "Sem acesso vinculado"}</h2>
                  {trial&&<p>{trial.revoked?'Chave do teste revogada.':`Fim do teste: ${new Date(trial.expires).toLocaleString('pt-BR')}.`}</p>}
                  <p>
                    Seu espaço para construir com Fable 5.1, Astra 6 e GLM 5.
                  </p>
                  <div className="six-plan-price">
                    {demo ? <DashboardNumber value={119} format="money" replay={numberReplay} /> : "—"}
                    <span>
                      {demo
                        ? "/ mês · exemplo"
                        : "Sem cobrança ativa · pagamentos ainda não conectados"}
                    </span>
                  </div>
                  <div className="six-plan-benefits">
                    {[
                      "Chave individual de acesso",
                      "Configuração nas ferramentas compatíveis",
                      "Histórico e consumo por perfil",
                      "Tutoriais organizados em um só lugar",
                    ].map((t) => (
                      <span key={t}>
                        <CircleCheck size={16} />
                        {t}
                      </span>
                    ))}
                  </div>
                  <Link className="six-primary" to="/planos">
                    Ver planos disponíveis <ArrowUpRight size={15} />
                  </Link>
                </section>
                <section className="six-plan-note">
                  <img
                    src="/assets/plan-trial.webp"
                    alt="Ilustração de presente"
                  />
                  <h2>
                    Uma boa ideia
                    <br />
                    merece um começo.
                  </h2>
                  <p>
                    Os acessos, valores e limites devem ser confirmados no seu
                    plano contratado.
                  </p>
                  <button
                    className="six-secondary"
                    onClick={() => switchTab("guides")}
                  >
                    Preparar minha ferramenta <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <section className="six-panel">
                <div className="six-panel-head">
                  <div>
                    <h2>Cobranças e recibos</h2>
                    <p>Seu histórico de assinatura</p>
                  </div>
                  <CreditCard size={18} />
                </div>
                {empty(
                  "Nenhuma cobrança disponível",
                  "Quando a integração de cobrança estiver conectada, seus pagamentos e recibos aparecerão aqui.",
                )}
              </section>
            </>
          )}

          {tab === "help" && (
            <div className="six-help-layout">
              <section className="six-panel six-faq">
                <div className="six-panel-head">
                  <div>
                    <h2>Respostas para continuar criando</h2>
                    <p>O essencial sobre sua conexão</p>
                  </div>
                  <CircleHelp size={21} />
                </div>
                {[
                  [
                    "Onde consigo minha chave?",
                    "Sua chave individual é fornecida pelo administrador da SixtySix. O login no site não emite automaticamente uma chave do gateway. Use a seção Chaves de API para consultar o cadastro ou solicitar acesso.",
                  ],
                  [
                    "Deu erro 401. O que confiro?",
                    "Confira se a chave está completa, sem espaços, se continua ativa e se o aplicativo usa a URL correta. Uma credencial de login Google ou Discord não substitui sua chave individual do gateway.",
                  ],
                  [
                    "Posso usar GLM 5 no Codex?",
                    "O catálogo atual do gateway no Codex usa gpt-6-astra. O tutorial de GLM 5 é para ZCode, com a URL base terminando em /glm.",
                  ],
                  [
                    "O Claude Desktop não salva a conexão.",
                    "Confira se sua versão oferece gateway personalizado, use autenticação x-api-key e salve e reinicie. Se o erro persistir, informe o aplicativo, a versão e a mensagem ao suporte, sem enviar sua chave.",
                  ],
                  [
                    "Como funciona a economia exibida?",
                    "Na demonstração, multiplicamos os tokens de entrada e saída do filtro por tarifas editáveis por milhão e subtraímos R$ 119 de mensalidade integral, sem rateio. Os preços iniciais são ilustrativos. A economia mínima exibida é zero.",
                  ],
                ].map(([q, a], i) => (
                  <div className="six-faq-row" key={q}>
                    <button
                      aria-expanded={faq === i}
                      onClick={() => setFaq(faq === i ? null : i)}
                    >
                      {q}
                      <ChevronDown size={16} />
                    </button>
                    {faq === i && <p>{a}</p>}
                  </div>
                ))}
              </section>
              <section className="six-panel six-support">
                <span className="six-soft-icon">
                  <CircleHelp size={24} />
                </span>
                <h2>Vamos resolver juntos.</h2>
                <p>
                  Envie o nome da ferramenta, seu sistema e a mensagem de erro.
                  Assim conseguimos entender o problema mais rápido.
                </p>
                <a
                  className="six-primary"
                  href="mailto:alisongeneral25@gmail.com?subject=Suporte%20SixtySix"
                >
                  Falar com o suporte <ArrowUpRight size={15} />
                </a>
                <button
                  className="six-text-button"
                  onClick={() => switchTab("guides")}
                >
                  Revisar configuração <ArrowRight size={14} />
                </button>
              </section>
            </div>
          )}
          <footer className="six-dashboard-footer">
            <span>Feito para suas próximas grandes ideias.</span>
            <span>
              <span className="six-dot emerald" /> SixtySix workspace{" "}
              <span className="six-footer-separator">/</span>
              <a href="/privacidade.html">Privacidade</a>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="six-toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  )
}

function PlusIcon() {
  return <span className="six-plus">+</span>
}
function GuideStep({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="six-guide-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
