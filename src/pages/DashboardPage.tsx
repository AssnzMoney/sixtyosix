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
  CircleAlert,
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
  Terminal,
  X,
  Zap,
  RefreshCw,
  CircleCheck,
  Info,
  MessageSquare,
} from "lucide-react"
import { motion, useInView } from "framer-motion"
import { useAuth } from "../lib/AuthContext"
import {
  accountRequest,
  accountSummary,
  accountCredentials,
  confirmCredential,
  type AccountTrial,
  type AccountSubscription,
  type AccountCredential,
} from "../lib/account"
import { purchaseMessage, supportWhatsappLink } from "../lib/whatsapp"
import { STATE_LABELS, credentialTitle, deliveryConfirmationText, type DeliveryProduct } from "../lib/deliveries"
import SiteChat from "../components/SiteChat"
import NumberRoller from "../components/ui/number-roller"
import { PRO_BASE_MODELS, ROUTER_MODEL_NAMES } from "../lib/routerModels"
import "./dashboard.css"
import "./billing.css"

type Tab = "overview" | "usage" | "keys" | "guides" | "plan" | "help" | "chat"
type RequestRow = {
  id: string
  date: string
  model: string
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
  managed?: boolean
  expires?: string | null
}
type GatewayStatus = "checking" | "ready" | "down" | "unknown"

// Nomes de exibição dos perfis já usados pelo gateway e pelos guias.
const MODEL_LABELS: Record<string, string> = {
  "claude-fable-5-1": "Fable 5.1",
  "argon-4": "Argon 4",
  "gpt-6-astra": "Astra 6",
  "glm-5": "GLM 5",
  ...ROUTER_MODEL_NAMES,
}
const KNOWN_MODELS = Object.values(MODEL_LABELS)
const ALL_MODELS = "Todos os modelos"
const supportLink = (message: string) => supportWhatsappLink(message)

// Planos e preços como publicados na página inicial (#planos). A contratação é feita pelo WhatsApp.
const PLANS: Array<{
  name: string
  price: string
  period: string
  desc: string
  note: string
  cta: string
  message: string
  icon: string
  code?: "dev" | "pro"
}> = [
  {
    name: "Dev",
    price: "79,99",
    period: "/mês",
    desc: "Para desenvolvedores que criam e entregam software no dia a dia.",
    note: "Chave de API: + R$ 15/mês",
    cta: "Contratar o Dev",
    message: "Olá! Quero contratar o plano Dev da SixtySix.",
    code: "dev",
    icon: "/assets/plan-cash.webp",
  },
  {
    name: "Pro Ilimitado",
    price: "119,99",
    period: "/mês",
    desc: "Acesso irrestrito aos modelos de ponta para quem constrói sem parar.",
    note: "Acesso à API incluso",
    cta: "Contratar o Pro",
    message: "Olá! Quero contratar o plano Pro Ilimitado da SixtySix.",
    code: "pro",
    icon: "/assets/plan-cash.webp",
  },
]

const nav = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "usage", label: "Meu consumo", icon: Activity },
  { id: "chat", label: "Conversar no site", icon: MessageSquare },
  { id: "keys", label: "Chaves de API", icon: KeyRound },
  { id: "guides", label: "Como conectar", icon: Terminal },
  { id: "plan", label: "Plano e assinatura", icon: CreditCard },
] as const

const headings: Record<Tab, { eyebrow: string; title: string; accent: string; description: string }> = {
  overview: {
    eyebrow: "painel do cliente",
    title: "",
    accent: "Bom te ver por aqui.",
    description: "Seu consumo, suas chaves e o passo a passo para conectar suas ferramentas, em um só lugar.",
  },
  usage: {
    eyebrow: "consumo",
    title: "Meu",
    accent: "consumo.",
    description: "Cada solicitação registrada pelo gateway nas chaves da sua conta.",
  },
  chat: {
    eyebrow: "conversar no site",
    title: "Converse",
    accent: "direto no site.",
    description: "Suas ideias, seu código e suas conversas em um só lugar.",
  },
  keys: {
    eyebrow: "integração",
    title: "Chaves",
    accent: "de API.",
    description: "O ponto de partida para conectar suas ferramentas. Não compartilhe sua chave.",
  },
  guides: {
    eyebrow: "integração nativa",
    title: "Como",
    accent: "conectar.",
    description: "Da sua chave à primeira resposta, sem complicação.",
  },
  plan: {
    eyebrow: "assinatura",
    title: "Plano e",
    accent: "assinatura.",
    description: "Seu acesso, seus pagamentos e os próximos passos.",
  },
  help: {
    eyebrow: "central de ajuda",
    title: "Respostas para",
    accent: "continuar criando.",
    description: "O essencial sobre a sua conexão.",
  },
}

const n = (v: number) => new Intl.NumberFormat("pt-BR").format(v)
const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v)
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
const dateLabel = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
const fullDate = (date: string) => new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
const fullDateTime = (date: string) =>
  new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
const modelIcon = (model: string) =>
  model.startsWith("Fable") ? "claude" : model === "Astra 6" ? "openai" : model.startsWith("GLM") ? "glm" : ""

function niceCeil(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = value / magnitude
  return (step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10) * magnitude
}

/** Status real do gateway pelo endpoint público `/api/health` (rewrite em vercel.json). */
async function fetchGatewayStatus(): Promise<GatewayStatus> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" })
    if (!response.headers.get("content-type")?.includes("application/json")) return "unknown"
    const body = await response.json()
    return response.ok && body?.status === "ready" ? "ready" : "down"
  } catch {
    return "unknown"
  }
}

function CodeBlock({ code, copy, label = "Configuração" }: { code: string; copy: (text: string) => void; label?: string }) {
  return (
    <div className="six-code">
      <div className="six-code-head">
        <span>
          <Terminal size={13} /> {label}
        </span>
        <button type="button" onClick={() => copy(code)}>
          <Copy size={13} /> Copiar
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

function DashboardNumber({
  value,
  format = "compact",
}: {
  value: number
  format?: "compact" | "money" | "percent" | "integer" | "decimal"
}) {
  // Preferência explícita de animação pedida para o painel.
  const reducedMotion = false
  const target = useRef<HTMLSpanElement>(null)
  const visible = useInView(target, { amount: 0.3 })
  const divisor = format === "compact" ? (value >= 1000000 ? 1000000 : value >= 1000 ? 1000 : 1) : 1
  const suffix = format === "percent" ? "%" : divisor === 1000000 ? " mi" : divisor === 1000 ? " mil" : ""
  const decimals = format === "money" ? 2 : format === "percent" || format === "decimal" ? 1 : divisor > 1 ? 2 : 0
  const label =
    format === "money"
      ? money(value)
      : format === "percent"
        ? value.toFixed(1).replace(".", ",") + "%"
        : format === "integer"
          ? n(value)
          : format === "decimal"
            ? value.toFixed(1).replace(".", ",")
            : compact(value)
  return (
    <span ref={target} className="six-animated-number" role="img" aria-label={label}>
      <span aria-hidden="true">
        <NumberRoller
          key={String(visible)}
          animateOnMount={!reducedMotion && visible}
          value={value / divisor}
          decimals={decimals}
          prefix={format === "money" ? "R$ " : ""}
          suffix={suffix}
          duration={reducedMotion ? 0 : 1.6}
        />
      </span>
    </span>
  )
}

function DailyChart({ days }: { days: Array<{ date: string; tokens: number; requests: number }> }) {
  const top = niceCeil(Math.max(0, ...days.map((d) => d.tokens)))
  const labelIndexes = new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])
  const label = (date: string) => dateLabel(`${date}T12:00:00`)
  return (
    <div className="six-chart" role="group" aria-label="Tokens por dia no período">
      <div className="six-chart-yaxis" aria-hidden="true">
        {[top, top / 2, 0].map((t) => (
          <span key={t}>{compact(t)}</span>
        ))}
      </div>
      <div className="six-chart-area">
        <div className="six-chart-plot">
          <div className="six-chart-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="six-chart-bars">
            {days.map((d, i) => (
              <div
                key={d.date}
                className={`six-chart-col ${i < 3 ? "is-start" : i > days.length - 4 ? "is-end" : ""}`}
                tabIndex={0}
                aria-label={`${label(d.date)}: ${n(d.tokens)} tokens em ${n(d.requests)} solicitações`}
              >
                <span
                  className={`six-chart-bar ${d.tokens > 0 ? "has-value" : ""}`}
                  style={{ height: `${(d.tokens / top) * 100}%` }}
                />
                <span className="six-chart-tip" role="tooltip">
                  <strong>{label(d.date)}</strong>
                  <span>{n(d.tokens)} tokens</span>
                  <span>{n(d.requests)} solicitações</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="six-chart-xaxis" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.date}>{labelIndexes.has(i) ? label(d.date) : ""}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, session, signOut } = useAuth()
  const [theme, setTheme] = useState(() => localStorage.getItem("six-dashboard-theme-v2") || "light")
  useEffect(() => {
    localStorage.setItem("six-dashboard-theme-v2", theme)
  }, [theme])
  const [tab, setTab] = useState<Tab>("overview")
  // Sem sessão, a rota só abre no localhost (`?demo=1`) para revisar o layout. Nenhum dado é simulado.
  const preview = !session
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("six-sidebar-collapsed") === "true")
  useEffect(() => {
    localStorage.setItem("six-sidebar-collapsed", String(collapsed))
  }, [collapsed])
  const [drawer, setDrawer] = useState(false)
  const [period, setPeriod] = useState("30")
  const [from, setFrom] = useState(dayKey(new Date(Date.now() - 29 * 86400000)))
  const [to, setTo] = useState(dayKey(new Date()))
  const [modelFilter, setModelFilter] = useState(ALL_MODELS)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState("")
  const [tool, setTool] = useState("claude")
  const [os, setOs] = useState("powershell")
  const [clientKey, setClientKey] = useState("")
  const [reveal, setReveal] = useState(false)
  const [accountData, setAccountData] = useState<{
    owner: string
    keys: KeyRow[]
    rows: RequestRow[]
    trial: AccountTrial | null
    subscription: AccountSubscription | null
  } | null>(null)
  const ownData = accountData?.owner === session?.user.id ? accountData : null
  const keys = ownData?.keys || []
  const trial = ownData?.trial ?? null
  const subscription = ownData?.subscription ?? null
  const [devWithApi, setDevWithApi] = useState(false)
  const [accountError, setAccountError] = useState("")
  const [busy, setBusy] = useState(false)
  const [revokeId, setRevokeId] = useState("")
  const [keyState, setKeyState] = useState<"idle" | "loading" | "loaded" | "error">("idle")
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [gateway, setGateway] = useState<GatewayStatus>("checking")
  const [credentials, setCredentials] = useState<{
    status: "idle" | "loading" | "ready" | "unavailable" | "error"
    items: AccountCredential[]
  }>({ status: "idle", items: [] })
  const [acceptedId, setAcceptedId] = useState("")
  const [confirmingId, setConfirmingId] = useState("")
  const [faq, setFaq] = useState<number | null>(0)
  const rows = ownData?.rows || []
  const metricsReady = !preview && keyState === "loaded" && Boolean(ownData)
  const name = user?.name || "dev"

  useEffect(() => {
    const previous = document.body.style.backgroundColor
    document.body.style.backgroundColor = theme === "dark" ? "#102b2c" : "#fbf9f4"
    return () => {
      document.body.style.backgroundColor = previous
    }
  }, [theme])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 3000)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    setPage(1)
  }, [period, from, to, modelFilter, search])
  useEffect(() => {
    setClientKey("")
    setRevokeId("")
  }, [session?.user.id])
  useEffect(() => {
    fetchGatewayStatus().then(setGateway)
  }, [refresh])
  useEffect(() => {
    if (!session?.user.id) {
      setKeyState("idle")
      setAccountData(null)
      return
    }
    const controller = new AbortController()
    const owner = session.user.id
    let pending = false
    const now = new Date()
    const first =
      period === "custom" ? from : dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(period) + 1))
    const last = period === "custom" ? to : dayKey(now)
    setKeyState("loading")
    async function load() {
      if (pending) return
      pending = true
      try {
        const data = await accountSummary(first, last, controller.signal)
        if (controller.signal.aborted) return
        setAccountData({
          owner,
          keys: data.keys,
          trial: data.trial || null,
          subscription: data.subscription,
          rows: data.usage.map((r) => ({
            id: String(r.id),
            date: r.created_at,
            model: MODEL_LABELS[r.requested_alias] || r.requested_alias,
            input: r.input_tokens,
            output: r.output_tokens,
            duration: r.latency_ms / 1000,
            success: r.status_code >= 200 && r.status_code < 400,
          })),
        })
        setAccountError("")
        setKeyState("loaded")
        setUpdatedAt(new Date())
      } catch (error) {
        if (controller.signal.aborted) return
        setAccountError(error instanceof Error ? error.message : "Não foi possível carregar sua conta.")
        setKeyState("error")
      } finally {
        pending = false
      }
    }
    load()
    const timer = setInterval(load, 30000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [session?.user.id, period, from, to, refresh])

  async function mutateAccount(action: "revoke", payload: Record<string, unknown>) {
    setBusy(true)
    setAccountError("")
    try {
      await accountRequest<{ ok?: boolean }>(action, payload)
      setRevokeId("")
      setRefresh((v) => v + 1)
      setToast("Chave revogada.")
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível concluir.")
    } finally {
      setBusy(false)
    }
  }

  // Credenciais do fornecedor entregues pelo WhatsApp: o cliente confirma o recebimento aqui.
  useEffect(() => {
    if (!session?.user.id) {
      setCredentials({ status: "idle", items: [] })
      return
    }
    const controller = new AbortController()
    setCredentials((current) => ({ status: current.items.length ? current.status : "loading", items: current.items }))
    accountCredentials(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCredentials({ status: result.available ? "ready" : "unavailable", items: result.credentials })
      })
      .catch(() => {
        if (!controller.signal.aborted) setCredentials((current) => ({ status: "error", items: current.items }))
      })
    return () => controller.abort()
  }, [session?.user.id, refresh])

  async function confirmReceipt(id: string) {
    setConfirmingId(id)
    setAccountError("")
    try {
      const { confirmed_at } = await confirmCredential(id)
      setCredentials((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === id ? { ...item, confirmed_at, state: "confirmed" } : item)),
      }))
      setAcceptedId("")
      setToast("Recebimento confirmado. Obrigado!")
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "Não foi possível confirmar o recebimento.")
      setRefresh((v) => v + 1)
    } finally {
      setConfirmingId("")
    }
  }

  const activeCredentials = credentials.items.filter((c) => c.state === "pending" || c.state === "confirmed")
  const pendingCredentials = credentials.items.filter((c) => c.state === "pending")
  const pastCredentials = credentials.items.filter((c) => c.state !== "pending" && c.state !== "confirmed")
  const credentialFor = (product: DeliveryProduct) => activeCredentials.find((c) => c.product === product)
  const claudeCredential = credentialFor("claude")
  const glmCredential = credentialFor("glm")
  const gptCredential = credentialFor("gpt")

  const modelOptions = useMemo(
    () => [ALL_MODELS, ...new Set([...KNOWN_MODELS, ...rows.map((r) => r.model)])],
    [rows],
  )
  const filtered = useMemo(() => {
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    if (period !== "custom") cutoff.setDate(cutoff.getDate() - (Number(period) - 1))
    return rows.filter((r) => {
      const day = dayKey(new Date(r.date))
      const within = period === "custom" ? day >= from && day <= to : new Date(r.date) >= cutoff
      return (
        within &&
        (modelFilter === ALL_MODELS || r.model === modelFilter) &&
        `${r.model} ${r.id}`.toLowerCase().includes(search.toLowerCase())
      )
    })
  }, [rows, period, from, to, modelFilter, search])
  const input = filtered.reduce((sum, row) => sum + row.input, 0)
  const output = filtered.reduce((sum, row) => sum + row.output, 0)
  const total = input + output
  const success = filtered.length ? (filtered.filter((r) => r.success).length / filtered.length) * 100 : 0
  const average = filtered.length ? filtered.reduce((s, r) => s + r.duration, 0) / filtered.length : 0
  const byModel = useMemo(() => {
    const totals = new Map<string, { tokens: number; requests: number }>()
    for (const r of filtered) {
      const entry = totals.get(r.model) ?? { tokens: 0, requests: 0 }
      entry.tokens += r.input + r.output
      entry.requests += 1
      totals.set(r.model, entry)
    }
    return [...totals.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.tokens - a.tokens)
  }, [filtered])
  const chartDays = useMemo(() => {
    const start = period === "custom" ? new Date(`${from}T00:00:00`) : new Date()
    if (period !== "custom") {
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - Number(period) + 1)
    }
    const end = period === "custom" ? new Date(`${to}T23:59:59`) : new Date()
    const perDay = new Map<string, { tokens: number; requests: number }>()
    for (const r of filtered) {
      const key = dayKey(new Date(r.date))
      const entry = perDay.get(key) ?? { tokens: 0, requests: 0 }
      entry.tokens += r.input + r.output
      entry.requests += 1
      perDay.set(key, entry)
    }
    const days: Array<{ date: string; tokens: number; requests: number }> = []
    const cursor = new Date(start)
    while (cursor <= end && days.length < 366) {
      const date = dayKey(cursor)
      days.push({ date, ...(perDay.get(date) ?? { tokens: 0, requests: 0 }) })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [period, from, to, filtered])

  const switchTab = (next: Tab) => {
    setTab(next)
    setDrawer(false)
    setSearch("")
    setModelFilter(ALL_MODELS)
    window.scrollTo({ top: 0 })
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setToast("Copiado para a área de transferência")
    } catch {
      setToast("Não foi possível copiar. Selecione o texto e copie manualmente.")
    }
  }
  function exportCsv() {
    const csv =
      String.fromCharCode(0xfeff) +
      [
        "data;modelo;tokens_entrada;tokens_saida;duracao_s;resultado",
        ...filtered.map(
          (r) =>
            `${r.date};${r.model};${r.input};${r.output};${r.duration.toFixed(1)};${r.success ? "concluida" : "falhou"}`,
        ),
      ].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "sixtysix-consumo.csv"
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
  // Com credencial entregue, os comandos usam a URL e o modelo enviados pelo WhatsApp.
  const anthropicCommands = (baseUrl: string, model: string) =>
    os === "powershell"
      ? `$env:ANTHROPIC_BASE_URL='${baseUrl}'\n$env:ANTHROPIC_API_KEY=${shellKey}\n$env:ANTHROPIC_MODEL='${model}'\nclaude --model ${model}`
      : os === "cmd"
        ? `set ANTHROPIC_BASE_URL=${baseUrl}\nset "ANTHROPIC_API_KEY=${actualKey.replace(/[\r\n"]/g, "")}"\nset ANTHROPIC_MODEL=${model}\nclaude --model ${model}`
        : `export ANTHROPIC_BASE_URL='${baseUrl}'\nexport ANTHROPIC_API_KEY=${shellKey}\nexport ANTHROPIC_MODEL='${model}'\nclaude --model ${model}`
  const claudeBase = claudeCredential?.base_url || "https://www.sixtysix.online"
  const claudeModel = claudeCredential?.model_id || "claude-fable-5-1"
  const glmBase = glmCredential?.base_url || "https://www.sixtysix.online"
  const glmModel = glmCredential?.model_id || "glm-5"
  const claudeCode = anthropicCommands(claudeBase, claudeModel)
  const glmCode = anthropicCommands(glmBase, glmModel)
  const codexConfig = `model = "gpt-6-astra"\nmodel_provider = "sixtysix"\nweb_search = "disabled"\n\n[model_providers.sixtysix]\nname = "Gateway"\nbase_url = "https://www.sixtysix.online/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nenv_http_headers = { "x-api-key" = "SIXTYSIX_GATEWAY_API_KEY" }\nmodel_catalog_url = "https://www.sixtysix.online/api/codex/models"`
  const osLabel = os === "powershell" ? "PowerShell" : os === "cmd" ? "CMD" : "Terminal"
  const sectionTitle = nav.find((v) => v.id === tab)?.label || "Central de ajuda"
  const heading = headings[tab]

  const empty = (title: string, description: string, action?: ReactNode) => (
    <div className="six-empty">
      <span>
        <Activity size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
  const metricHint = preview
    ? "Entre na sua conta para ver"
    : keyState === "error"
      ? "Indisponível no momento"
      : "Carregando…"
  const noDataTitle = preview ? "Entre para ver seu consumo" : "Nenhuma solicitação no período"
  const noDataText = preview
    ? "Esta é uma pré-visualização local, sem conta conectada. Nenhum dado é simulado."
    : metricsReady
      ? "Use sua chave em uma ferramenta ou mude o período e o modelo do filtro."
      : keyState === "error"
        ? "Não foi possível carregar seus dados agora. Tente atualizar."
        : "Consultando os dados da sua conta."

  const table = (limit = 8) => (
    <>
      {filtered.length > 0 && (
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
                .slice((tab === "usage" ? page - 1 : 0) * limit, (tab === "usage" ? page : 1) * limit)
                .map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="six-model-cell">
                        <span className="six-model-icon">
                          {modelIcon(r.model) ? (
                            <img src={`/assets/brands/${modelIcon(r.model)}.svg`} alt="" />
                          ) : (
                            <Zap size={14} />
                          )}
                        </span>
                        <span>
                          <strong>{r.model}</strong>
                          <small>{r.id}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      {dateLabel(r.date)}
                      <small>{new Date(r.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
                    </td>
                    <td>
                      <DashboardNumber value={r.input} format="integer" />
                    </td>
                    <td>
                      <DashboardNumber value={r.output} format="integer" />
                    </td>
                    <td>
                      <DashboardNumber value={r.duration} format="decimal" /> s
                    </td>
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
      )}
      {!filtered.length && empty(noDataTitle, noDataText)}
    </>
  )

  const filters = (
    <>
      <div className="six-filters">
        <div className="six-segmented" role="tablist" aria-label="Período">
          {[
            ["1", "Hoje"],
            ["7", "7 dias"],
            ["30", "Últimos 30 dias"],
            ["custom", "Personalizar"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={period === value}
              className={period === value ? "selected" : ""}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="six-select">
          <Settings2 size={14} />
          <select aria-label="Filtrar por modelo" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
            {modelOptions.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      {period === "custom" && (
        <div className="six-date-range">
          <label>
            De <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Até{" "}
            <input type="date" value={to} min={from} max={dayKey(new Date())} onChange={(e) => setTo(e.target.value)} />
          </label>
          <span>{from > to ? "Selecione um intervalo válido." : "Intervalos de até 366 dias."}</span>
        </div>
      )}
    </>
  )

  const stats = (
    <div className="six-stats">
      <article className="six-stat">
        <span className="six-stat-label">
          <Zap size={15} /> Tokens consumidos
        </span>
        <strong className="six-stat-value">
          {metricsReady ? <DashboardNumber value={total} /> : "—"}
          <small>tokens</small>
        </strong>
        <p>
          {metricsReady ? (
            <>
              <DashboardNumber value={filtered.length} format="integer" /> solicitações no período
            </>
          ) : (
            metricHint
          )}
        </p>
      </article>
      <article className="six-stat">
        <span className="six-stat-label">
          <ArrowDownLeft size={15} /> Tokens de entrada
        </span>
        <strong className="six-stat-value">
          {metricsReady ? <DashboardNumber value={input} /> : "—"}
          <small>tokens</small>
        </strong>
        <p>Contexto enviado pelas suas ferramentas</p>
      </article>
      <article className="six-stat">
        <span className="six-stat-label">
          <ArrowUpRight size={15} /> Tokens de saída
        </span>
        <strong className="six-stat-value">
          {metricsReady ? <DashboardNumber value={output} /> : "—"}
          <small>tokens</small>
        </strong>
        <p>Respostas geradas no período</p>
      </article>
      <article className="six-stat">
        <span className="six-stat-label">
          <CircleCheck size={15} /> Solicitações concluídas
        </span>
        <strong className="six-stat-value">
          {metricsReady && filtered.length ? <DashboardNumber value={success} format="percent" /> : "—"}
        </strong>
        <p>
          {metricsReady && filtered.length ? (
            <>
              Tempo médio de <DashboardNumber value={average} format="decimal" /> s por resposta
            </>
          ) : metricsReady ? (
            "Sem solicitações no período"
          ) : (
            metricHint
          )}
        </p>
      </article>
    </div>
  )

  const planTitle = subscription
    ? `${subscription.name}${subscription.active ? "" : subscription.status === "pending" ? " · aguardando pagamento" : " · período encerrado"}`
    : trial?.active
      ? "Teste grátis · 3 horas"
      : keys.some((k) => k.active)
        ? "Acesso de teste ativo"
        : trial
          ? "Teste encerrado"
          : "Sem acesso vinculado"

  const credentialsKnown = preview || credentials.status === "ready" || credentials.status === "unavailable"
  const needsSetup =
    activeCredentials.length === 0 && !keys.some((k) => k.active) && (preview || (keyState === "loaded" && credentialsKnown))
  const paidWithoutCredential = Boolean(subscription?.active) && credentials.status === "ready" && activeCredentials.length === 0
  const paidMessage = purchaseMessage({ name: user?.name, plan: subscription?.name, order: subscription?.id, email: user?.email })

  const credentialCard = (c: AccountCredential) => (
    <article key={c.id} className={`six-credential is-${c.state}`}>
      <div className="six-credential-head">
        <span className="six-step-badge">{credentialTitle(c)}</span>
        <span className={`six-status ${c.state === "pending" ? "is-pending" : ""}`}>
          {c.state === "confirmed" ? <Check size={11} /> : <CircleAlert size={11} />}
          {STATE_LABELS[c.state]}
        </span>
      </div>
      <dl className="six-credential-data">
        <div>
          <dt>Chave</dt>
          <dd>
            <code>••••••••{c.key_hint}</code>
          </dd>
        </div>
        {c.model_id && (
          <div>
            <dt>Modelo</dt>
            <dd>
              <code>{c.model_id}</code>
            </dd>
          </div>
        )}
        <div className="is-wide">
          <dt>URL base</dt>
          <dd>
            <code>{c.base_url}</code>
            <button type="button" className="six-copy-inline" onClick={() => copy(c.base_url)}>
              <Copy size={13} /> Copiar
            </button>
          </dd>
        </div>
        <div>
          <dt>Enviada em</dt>
          <dd>{fullDate(c.delivered_at)}</dd>
        </div>
        {c.expires_at && (
          <div>
            <dt>Válida até</dt>
            <dd>{fullDate(c.expires_at)}</dd>
          </div>
        )}
      </dl>
      {c.state === "pending" ? (
        <div className="six-credential-confirm">
          <label>
            <input
              type="checkbox"
              checked={acceptedId === c.id}
              onChange={(e) => setAcceptedId(e.target.checked ? c.id : "")}
            />
            <span>{deliveryConfirmationText(c.key_hint, c.base_url)}</span>
          </label>
          <button
            type="button"
            className="six-primary"
            disabled={!session || acceptedId !== c.id || confirmingId === c.id}
            onClick={() => void confirmReceipt(c.id)}
          >
            {confirmingId === c.id ? "Confirmando…" : "Confirmar recebimento"}
          </button>
          <a
            className="six-text-button"
            href={supportLink(`Olá! Não recebi minha chave SixtySix terminada em …${c.key_hint}. Pode me reenviar?`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Não recebi
          </a>
        </div>
      ) : c.state === "confirmed" && c.confirmed_at ? (
        <p className="six-credential-ok">
          <CircleCheck size={15} /> Recebimento confirmado em {fullDateTime(c.confirmed_at)}.
        </p>
      ) : null}
    </article>
  )

  // Bloco que explica de onde vem a chave e mostra a configuração entregue para a ferramenta escolhida.
  const guideCredential = tool === "codex" ? gptCredential : tool === "glm" ? glmCredential : claudeCredential


  return (
    <div className="six-dashboard" data-theme={theme} data-collapsed={collapsed}>
      {drawer && <button type="button" className="six-overlay" aria-label="Fechar menu" onClick={() => setDrawer(false)} />}

      <aside className={`six-sidebar ${drawer ? "open" : ""}`} aria-label="Menu do painel">
        <div className="six-sidebar-top">
          <Link to="/" className="six-brand" aria-label="SixtySix, página inicial">
            <img src="/assets/sidebar-logo.png" alt="SixtySix" />
          </Link>
          <button
            type="button"
            className="six-sidebar-toggle"
            onClick={() => (drawer ? setDrawer(false) : setCollapsed(!collapsed))}
            aria-label={drawer ? "Fechar menu" : collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            {drawer ? <X size={17} /> : collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <div className="six-nav-label">Plataforma</div>
        <nav aria-label="Navegação do painel">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={tab === item.id ? "page" : undefined}
              className={tab === item.id ? "active" : ""}
              onClick={() => switchTab(item.id)}
            >
              {tab === item.id && (
                <motion.span
                  layoutId="six-nav-indicator"
                  className="six-nav-indicator"
                  transition={{ type: "spring", stiffness: 450, damping: 34 }}
                />
              )}
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "keys" && keys.length > 0 && <span className="six-nav-count">{keys.length}</span>}
            </button>
          ))}
        </nav>

        <div className="six-sidebar-bottom">
          <div className="six-help-card">
            <strong>Pronto para criar?</strong>
            <p>Sua próxima ideia começa com uma boa conexão.</p>
            <button type="button" onClick={() => switchTab("guides")}>
              Conectar minha IDE <ArrowUpRight size={15} />
            </button>
          </div>
          <button type="button" className="six-help-link" onClick={() => switchTab("help")} title="Central de ajuda">
            <CircleHelp size={18} />
            <span>Central de ajuda</span>
          </button>
          <div className="six-profile">
            <span className="six-avatar">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : name.charAt(0).toUpperCase()}
            </span>
            <span className="six-profile-text">
              <strong title={name}>{name}</strong>
              <small>{preview ? "Pré-visualização local" : user?.email}</small>
            </span>
            {session && (
              <Link
                to="/onboarding?edit=true"
                className="six-profile-action"
                aria-label="Editar nome e WhatsApp"
                title="Editar nome e WhatsApp"
              >
                <Settings2 size={16} />
              </Link>
            )}
            <button
              type="button"
              className="six-profile-action"
              aria-label={session ? "Sair da conta" : "Ir para login"}
              title={session ? "Sair da conta" : "Entrar"}
              onClick={() =>
                session ? signOut().then(() => window.location.assign("/login")) : window.location.assign("/login")
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="six-main-shell">
        <header className="six-topbar">
          <div className="six-topbar-left">
            <button type="button" className="six-mobile-menu" aria-label="Abrir menu" onClick={() => setDrawer(true)}>
              <Menu size={20} />
            </button>
            <Link to="/" className="six-mobile-brand" aria-label="SixtySix, página inicial">
              <img src="/assets/sidebar-logo.png" alt="SixtySix" />
            </Link>
            <span className="six-crumb">
              Workspace <ChevronRight size={13} /> <strong>{sectionTitle}</strong>
            </span>
          </div>
          <div className="six-topbar-right">
            {gateway === "ready" && (
              <span className="six-connection" title="Verificado em /api/health">
                <span className="six-connection-dot" /> Gateway disponível
              </span>
            )}
            {gateway === "down" && (
              <span className="six-connection is-down" title="Verificado em /api/health">
                <CircleAlert size={14} /> Gateway indisponível
              </span>
            )}
            <button
              type="button"
              className="six-icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              title="Alternar aparência"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/claude-code#passo-a-passo" className="six-doc-link">
              <BookOpen size={16} />
              <span>Documentação</span>
            </Link>
          </div>
        </header>

        <main className="six-main">
          {preview ? (
            <div className="six-account-status is-preview" role="status">
              <span>
                <CircleAlert size={15} /> Pré-visualização local, sem conta conectada. Nenhum dado de consumo, chave ou plano
                é simulado.
              </span>
              <Link to="/login">Entrar</Link>
            </div>
          ) : (
            <div className={`six-account-status ${keyState === "error" ? "is-error" : ""}`} role="status">
              {accountError ? (
                <>
                  <span>
                    <CircleAlert size={15} /> {accountError}
                  </span>
                  <button type="button" onClick={() => setRefresh((v) => v + 1)}>
                    Tentar novamente
                  </button>
                </>
              ) : keyState === "loading" && !updatedAt ? (
                <span>
                  <RefreshCw size={14} className="six-spin" /> Carregando sua conta…
                </span>
              ) : (
                <>
                  <span>
                    <span className="six-live-dot" />
                    <span>
                      Dados reais da sua conta
                      <span className="six-hide-mobile"> · atualização automática a cada 30 segundos</span>
                      {updatedAt &&
                        ` · atualizado às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                    </span>
                  </span>
                  <button type="button" onClick={() => setRefresh((v) => v + 1)}>
                    <RefreshCw size={14} /> Atualizar
                  </button>
                </>
              )}
            </div>
          )}

          <div className="six-heading">
            <div>
              <span className="six-eyebrow">{heading.eyebrow}</span>
              <h1>
                {tab === "overview" ? `Olá, ${name}.` : heading.title} <em>{heading.accent}</em>
              </h1>
              <p>{heading.description}</p>
            </div>
            {tab === "overview" ? (
              <button type="button" className="six-primary" onClick={() => switchTab("guides")}>
                <Terminal size={16} /> Conectar ferramenta
              </button>
            ) : tab === "usage" ? (
              <button type="button" className="six-secondary" disabled={!metricsReady || !filtered.length} onClick={exportCsv}>
                <Download size={15} /> Exportar CSV
              </button>
            ) : null}
          </div>

          {tab === "overview" && pendingCredentials.length > 0 && (
            <section className="six-panel six-credentials-panel" aria-labelledby="six-cred-title">
              <div className="six-panel-head">
                <div>
                  <h2 id="six-cred-title">Você recebeu sua chave pelo WhatsApp?</h2>
                  <p>Confira os dados e confirme o recebimento. Isso registra a entrega na sua conta.</p>
                </div>
              </div>
              <div className="six-credential-list">{pendingCredentials.map(credentialCard)}</div>
            </section>
          )}

          {tab === "overview" && paidWithoutCredential && (
            <div className="six-paid-banner" role="status">
              <span className="six-paid-banner-text">
                <CircleCheck size={20} aria-hidden="true" />
                <span>
                  <strong>Pagamento confirmado.</strong> Fale com a gente no WhatsApp para receber sua chave e a URL de
                  configuração.
                </span>
              </span>
              <a className="six-primary" href={supportLink(paidMessage)} target="_blank" rel="noopener noreferrer">
                <MessageSquare size={16} /> Receber no WhatsApp
              </a>
            </div>
          )}

          {tab === "overview" && needsSetup && !paidWithoutCredential && (
            <section className="six-panel six-onboarding" aria-labelledby="six-onboarding-title">
              <div className="six-panel-head">
                <div>
                  <h2 id="six-onboarding-title">Primeiros passos</h2>
                  <p>Tudo acontece pelo WhatsApp: você contrata e recebe sua chave e a URL de configuração.</p>
                </div>
              </div>
              <ol className="six-onboarding-steps">
                <li>
                  <span className="six-onboarding-number">01</span>
                  <h3>Escolha seu plano</h3>
                  <p>Contrate aqui no painel, por Pix ou cartão.</p>
                  <button type="button" className="six-primary" onClick={() => switchTab("plan")}>
                    <CreditCard size={16} /> Ver planos
                  </button>
                </li>
                <li>
                  <span className="six-onboarding-number">02</span>
                  <h3>Receba a chave e a URL</h3>
                  <p>Enviamos tudo pelo WhatsApp: sua chave, a URL de configuração e o modelo.</p>
                </li>
                <li>
                  <span className="six-onboarding-number">03</span>
                  <h3>Confirme o recebimento aqui</h3>
                  <p>Quando a credencial chegar, ela aparece neste painel para você confirmar.</p>
                </li>
                <li>
                  <span className="six-onboarding-number">04</span>
                  <h3>Configure sua ferramenta</h3>
                  <p>Use a URL e a chave no Claude Code, no Codex ou no Claude Desktop.</p>
                  <button type="button" className="six-secondary" onClick={() => switchTab("guides")}>
                    Ver passo a passo <ArrowRight size={15} />
                  </button>
                </li>
              </ol>
            </section>
          )}

          {(tab === "overview" || tab === "usage") && (
            <>
              {filters}
              {stats}

              {tab === "overview" && (
                <div className="six-chart-grid">
                  <section className="six-panel">
                    <div className="six-panel-head">
                      <div>
                        <h2>Seu ritmo de criação</h2>
                        <p>Tokens por dia no período</p>
                      </div>
                    </div>
                    {metricsReady && filtered.length ? <DailyChart days={chartDays} /> : empty(noDataTitle, noDataText)}
                  </section>
                  <section className="six-panel">
                    <div className="six-panel-head">
                      <div>
                        <h2>Seus modelos</h2>
                        <p>Participação nos tokens</p>
                      </div>
                    </div>
                    {metricsReady && total > 0 ? (
                      <ul className="six-meter-list">
                        {byModel.map((m) => {
                          const share = (m.tokens / total) * 100
                          return (
                            <li key={m.model}>
                              <div className="six-meter-head">
                                <span className="six-meter-name">
                                  {modelIcon(m.model) && <img src={`/assets/brands/${modelIcon(m.model)}.svg`} alt="" />}
                                  {m.model}
                                </span>
                                <span className="six-meter-figure">
                                  {compact(m.tokens)} · {share.toFixed(1).replace(".", ",")}%
                                </span>
                              </div>
                              <div
                                className="six-meter-track"
                                role="img"
                                aria-label={`${m.model}: ${n(m.tokens)} tokens, ${share.toFixed(1).replace(".", ",")}% do total, ${n(m.requests)} solicitações`}
                                title={`${n(m.tokens)} tokens · ${n(m.requests)} solicitações`}
                              >
                                <span style={{ width: `${Math.max(share, 1.5)}%` }} />
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      empty(
                        preview ? "Entre para ver seus modelos" : "Sem consumo por modelo",
                        preview
                          ? "A divisão por modelo usa os registros reais da sua conta."
                          : "A divisão aparece quando houver tokens no período.",
                      )
                    )}
                  </section>
                </div>
              )}

              {tab === "overview" && (
                <section className="six-feature" aria-labelledby="six-feature-title">
                  <svg className="six-feature-waves" viewBox="0 0 800 320" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M-10 210 C 160 140, 330 290, 520 210 S 760 150, 820 190" />
                    <path d="M-10 250 C 180 190, 320 330, 540 250 S 760 200, 820 235" />
                    <path d="M-10 290 C 200 240, 340 360, 560 290 S 770 250, 820 280" />
                  </svg>
                  <div className="six-feature-copy">
                    <span className="six-eyebrow is-light">integração nativa</span>
                    <h2 id="six-feature-title">
                      Sua próxima conexão <em>em poucos minutos.</em>
                    </h2>
                    <p>Escolha uma ferramenta e siga o passo a passo com a URL oficial e a sua chave individual.</p>
                    <button type="button" className="six-primary" onClick={() => switchTab("guides")}>
                      Ver todos os guias <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="six-feature-tools">
                    {[
                      ["claude", "Claude Code", "Fable 5.1 no seu terminal", "claude"],
                      ["codex", "Codex", "Astra 6 no seu workspace", "openai"],
                      ["glm", "Claude Code", "Perfil GLM 5", "glm"],
                    ].map(([id, title, desc, icon]) => (
                      <button
                        key={id}
                        type="button"
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
                  </div>
                </section>
              )}

              <section className="six-panel">
                <div className="six-panel-head">
                  <div>
                    <h2>Atividade {tab === "overview" ? "recente" : "do período"}</h2>
                    <p>Solicitações feitas com as chaves da sua conta</p>
                  </div>
                  {tab === "overview" ? (
                    <button type="button" className="six-text-button" onClick={() => switchTab("usage")}>
                      Ver todo o consumo <ArrowRight size={14} />
                    </button>
                  ) : (
                    <label className="six-search">
                      <Search size={15} />
                      <input
                        placeholder="Buscar modelo ou solicitação"
                        aria-label="Buscar modelo ou solicitação"
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
                      {n(filtered.length)} solicitações · página {page} de {Math.ceil(filtered.length / 10)}
                    </span>
                    <div>
                      <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                        Anterior
                      </button>
                      <button
                        type="button"
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
              <section className="six-panel" aria-labelledby="six-creds-title">
                <div className="six-panel-head">
                  <div>
                    <h2 id="six-creds-title">Suas credenciais</h2>
                    <p>Chaves e URLs que enviamos pelo WhatsApp. Por segurança, mostramos só o final da chave.</p>
                  </div>
                  <a
                    className="six-secondary"
                    href={supportLink("Olá! Preciso de ajuda com a minha chave SixtySix.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageSquare size={15} /> Falar no WhatsApp
                  </a>
                </div>
                {!session ? (
                  empty(
                    "Entre para ver suas credenciais",
                    "As chaves enviadas pelo WhatsApp ficam associadas à sua conta.",
                    <Link className="six-primary" to="/login">
                      Entrar na SixtySix <ArrowRight size={14} />
                    </Link>,
                  )
                ) : credentials.status === "idle" || credentials.status === "loading" ? (
                  empty("Carregando suas credenciais", "Consultando os dados da sua conta.")
                ) : credentials.status !== "ready" ? (
                  <p className="six-inline-notice is-info">
                    <Info size={15} aria-hidden="true" /> As credenciais enviadas pelo WhatsApp ainda não aparecem aqui. Se
                    precisar de algo, fale com a gente.
                  </p>
                ) : activeCredentials.length ? (
                  <div className="six-credential-list">{activeCredentials.map(credentialCard)}</div>
                ) : (
                  empty(
                    "Nenhuma credencial registrada ainda",
                    "Depois da contratação, você recebe a chave e a URL pelo WhatsApp e confirma o recebimento aqui.",
                    <a
                      className="six-primary"
                      href={supportLink(subscription?.active ? paidMessage : "Olá! Quero contratar a SixtySix.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare size={15} /> Falar no WhatsApp
                    </a>,
                  )
                )}
                {pastCredentials.length > 0 && (
                  <details className="six-credential-history">
                    <summary>Histórico de credenciais ({pastCredentials.length})</summary>
                    <ul>
                      {pastCredentials.map((c) => (
                        <li key={c.id}>
                          <span>
                            {credentialTitle(c)} · ••••{c.key_hint}
                          </span>
                          <span className="six-status is-muted">{STATE_LABELS[c.state]}</span>
                          <small>
                            Enviada em {fullDate(c.delivered_at)}
                            {c.confirmed_at ? ` · confirmada em ${fullDateTime(c.confirmed_at)}` : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <p className="six-card-footnote">
                  <Info size={14} aria-hidden="true" /> O consumo das chaves enviadas pelo WhatsApp é medido pelo fornecedor e
                  não aparece neste painel.
                </p>
              </section>

              {accountError && session && (
                <p className="six-inline-notice is-error" role="alert">
                  <CircleAlert size={15} /> {accountError}
                </p>
              )}

              {(!session || keys.length > 0 || keyState === "error") && (
              <section className="six-panel">
                <div className="six-panel-head">
                  <div>
                    <h2>Chaves do gateway SixtySix</h2>
                    <p>Chaves do SixtySix vinculadas à sua conta</p>
                  </div>
                  {session && (
                    <button
                      type="button"
                      className="six-icon-button"
                      aria-label="Atualizar chaves"
                      title="Atualizar chaves"
                      onClick={() => setRefresh(refresh + 1)}
                    >
                      <RefreshCw size={16} />
                    </button>
                  )}
                </div>
                {!session ? (
                  empty(
                    "Entre para ver suas chaves",
                    "Seu cadastro e suas chaves ficam associados à sua conta.",
                    <Link className="six-primary" to="/login">
                      Entrar na SixtySix <ArrowRight size={14} />
                    </Link>,
                  )
                ) : keyState === "loading" && !ownData ? (
                  empty("Carregando suas chaves", "Consultando os dados da sua conta.")
                ) : keyState === "error" && !ownData ? (
                  empty(
                    "Não foi possível carregar as chaves",
                    "Tente novamente. Se persistir, entre em contato com o suporte.",
                    <button type="button" className="six-secondary" onClick={() => setRefresh(refresh + 1)}>
                      Tentar novamente
                    </button>,
                  )
                ) : keys.length ? (
                  <ul className="six-key-list">
                    {keys.map((k) => (
                      <li key={k.id} className="six-key-row">
                        <div className="six-key-main">
                          <strong>{k.name}</strong>
                          <code>{k.prefix.startsWith("sk-") ? `${k.prefix}••••••••` : k.prefix}</code>
                        </div>
                        <div className="six-key-meta">
                          <span>{k.expires ? "Válida até" : "Criada em"}</span>
                          <strong>{k.expires ? fullDate(k.expires) : dateLabel(k.created)}</strong>
                        </div>
                        <span className={`six-status ${k.active ? "" : "muted"}`}>
                          {k.active ? <Check size={11} /> : <X size={11} />}
                          {k.active ? "Ativa" : "Inativa"}
                        </span>
                        <div className="six-key-row-actions">
                          {k.active &&
                            !k.managed &&
                            (revokeId === k.id ? (
                              <>
                                <button
                                  type="button"
                                  className="six-danger"
                                  disabled={busy}
                                  onClick={() => mutateAccount("revoke", { id: k.id })}
                                >
                                  Confirmar revogação
                                </button>
                                <button type="button" className="six-text-button" onClick={() => setRevokeId("")}>
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button type="button" className="six-text-button is-danger" onClick={() => setRevokeId(k.id)}>
                                Revogar
                              </button>
                            ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  empty(
                    "Sua chave começa aqui",
                    "Vincule no formulário acima a chave que você recebeu pelo WhatsApp. Se ainda não recebeu, peça para a gente.",
                    <a
                      className="six-primary"
                      href={supportLink("Olá! Quero solicitar minha chave individual SixtySix.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Solicitar minha chave <ArrowUpRight size={14} />
                    </a>,
                  )
                )}
              </section>

              )}

              <div className="six-note">
                <ShieldCheck size={18} />
                <p>
                  O segredo completo de uma chave não pode ser recuperado a partir do prefixo. Use a chave entregue a você e
                  guarde-a em local seguro. Precisa de outra chave ou quer trocar a atual?{" "}
                  <a
                    href={supportLink("Olá! Preciso de uma nova chave da SixtySix.")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Fale no WhatsApp
                  </a>
                  .
                </p>
              </div>
            </>
          )}

          {tab === "guides" && (
            <>
              {guideCredential ? (
                <section className="six-panel six-guide-config" aria-labelledby="six-guide-config-title">
                  <div>
                    <span className="six-step-badge">Sua configuração</span>
                    <h2 id="six-guide-config-title">URL e modelo que enviamos para você</h2>
                    <p>
                      {tool === "codex"
                        ? "Use esta URL e este modelo no Codex, conforme as instruções que enviamos pelo WhatsApp."
                        : "Os comandos abaixo já usam esta URL e este modelo. Cole sua chave em “Deixe os comandos prontos”."}
                    </p>
                  </div>
                  <dl className="six-credential-data">
                    <div className="is-wide">
                      <dt>URL base</dt>
                      <dd>
                        <code>{guideCredential.base_url}</code>
                        <button type="button" className="six-copy-inline" onClick={() => copy(guideCredential.base_url)}>
                          <Copy size={13} /> Copiar
                        </button>
                      </dd>
                    </div>
                    {guideCredential.model_id && (
                      <div>
                        <dt>Modelo</dt>
                        <dd>
                          <code>{guideCredential.model_id}</code>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt>Chave</dt>
                      <dd>
                        <code>••••••••{guideCredential.key_hint}</code>
                      </dd>
                    </div>
                  </dl>
                </section>
              ) : (
                <p className="six-inline-notice is-info">
                  <MessageSquare size={15} aria-hidden="true" /> A URL e a sua chave chegam pelo WhatsApp depois da
                  contratação. Cole a chave em “Deixe os comandos prontos” para preencher os comandos.
                </p>
              )}
              <div className="six-guide-choices">
                {[
                  ["claude", "Claude Code", "Terminal", "claude"],
                  ["desktop", "Claude Desktop", "Aplicativo", "claude"],
                  ["codex", "Codex", "Terminal e desktop", "openai"],
                  ["glm", "Claude Code", "Perfil GLM 5", "glm"],
                ].map(([id, title, desc, icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={tool === id}
                    className={tool === id ? "selected" : ""}
                    onClick={() => setTool(id)}
                  >
                    <img src={`/assets/brands/${icon}.svg`} alt="" />
                    <strong>{title}</strong>
                    <span>{desc}</span>
                    {tool === id && <CircleCheck size={16} className="six-choice-check" />}
                  </button>
                ))}
              </div>
              <div className="six-guide-layout">
                <section className="six-panel six-guide">
                  <div className="six-panel-head">
                    <div>
                      <span className="six-step-badge">Passo a passo</span>
                      <h2>
                        {tool === "claude"
                          ? "Fable 5.1 no seu terminal"
                          : tool === "codex"
                            ? "Astra 6 no Codex"
                            : tool === "desktop"
                              ? "Fable 5.1 no Claude Desktop"
                              : "GLM 5 no Claude Code"}
                      </h2>
                    </div>
                    <span className="six-pill">{tool === "codex" ? "Responses" : "Anthropic"}</span>
                  </div>
                  {(tool === "claude" || tool === "codex" || tool === "glm") && (
                    <div className="six-segmented is-compact" role="tablist" aria-label="Sistema ou terminal">
                      {[
                        ["powershell", "Windows · PowerShell"],
                        ["cmd", "Windows · CMD"],
                        ["bash", "macOS / Linux"],
                      ].map(([id, label]) => (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={os === id}
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
                        <p>Com Node.js e npm instalados, abra o terminal e execute:</p>
                        <CodeBlock code="npm install -g @anthropic-ai/claude-code" copy={copy} label="Terminal" />
                      </GuideStep>
                      <GuideStep number="02" title="Configure sua chave e inicie">
                        <p>
                          Os comandos abaixo valem para a janela atual. Use sua chave individual no lugar do campo indicado.
                        </p>
                        <CodeBlock code={claudeCode} copy={copy} label={osLabel} />
                      </GuideStep>
                      <GuideStep number="03" title="Faça sua primeira solicitação">
                        <p>
                          Ao abrir o Claude Code, envie uma mensagem curta. Caso apareça uma tela de login da Anthropic, confira
                          as variáveis na mesma janela e reinicie o comando.
                        </p>
                      </GuideStep>
                    </>
                  )}
                  {tool === "codex" && (
                    <>
                      <GuideStep number="01" title="Salve sua chave no ambiente">
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
                          label={osLabel}
                        />
                      </GuideStep>
                      <GuideStep number="02" title="Edite a configuração do Codex">
                        <p>
                          Abra <code>{os === "bash" ? "~/.codex/config.toml" : "%USERPROFILE%\\.codex\\config.toml"}</code>.
                          Mescle os campos se o provedor já existir; evite repetir a mesma tabela.
                        </p>
                        <CodeBlock code={codexConfig} copy={copy} label="config.toml" />
                      </GuideStep>
                      <GuideStep number="03" title="Abra o Codex e selecione Astra 6">
                        <p>
                          Reinicie o aplicativo a partir do ambiente configurado. O identificador deste perfil é{" "}
                          <code>gpt-6-astra</code>. GLM 5 usa outra configuração, no Claude Code.
                        </p>
                      </GuideStep>
                    </>
                  )}
                  {tool === "desktop" && (
                    <>
                      <GuideStep number="01" title="Ative a conexão com terceiros">
                        <p>
                          Abra o Claude Desktop atualizado e clique na engrenagem de Configurações. Procure Conexão ou
                          Inferência de terceiros. Ative a opção de usar um provedor de terceiros, se ela aparecer, e escolha
                          Gateway no campo Conexão. Os nomes podem variar conforme a versão. Esta configuração precisa ser feita
                          no aplicativo: colar a chave no chat ou configurar um conector MCP não conecta o gateway de modelos.
                        </p>
                      </GuideStep>
                      <GuideStep number="02" title="Preencha as credenciais">
                        <p>
                          Em Credenciais de gateway, escolha Chave de API estática. Use a chave que você recebeu pelo
                          WhatsApp e cole no campo Chave de API do gateway. Use a URL inteira abaixo, sem acrescentar
                          /v1/messages. Em Esquema de autenticação, selecione x-api-key. O campo Origem do iframe de
                          visualização de artefato é separado da conexão; deixe vazio se você não configurou uma origem de
                          artefatos.
                        </p>
                        <CodeBlock
                          code={`Tipo: Chave de API estática\nURL base: ${claudeBase}\nChave: ${actualKey}\nAutenticação: x-api-key\nModelo: ${claudeModel}`}
                          copy={copy}
                          label="Claude Desktop"
                        />
                      </GuideStep>
                      <GuideStep number="03" title="Salve, reinicie e teste">
                        <p>
                          Clique em Testar conexão. Depois clique em Salvar e Reiniciar e aguarde o aplicativo abrir novamente.
                          Crie uma conversa nova na área Code e escolha Fable 5.1 no seletor de modelos. Conversas
                          antigas podem manter o modelo anterior. Se o teste ficar vermelho, confira a chave completa, a URL e
                          x-api-key. Se aparecer Não foi possível atualizar as configurações salvas, o aplicativo ainda não
                          salvou a conexão: feche e abra o Claude e tente salvar novamente. Se a opção de terceiros não existir
                          na sua versão, use Claude Code no terminal, conforme a outra aba deste guia.
                        </p>
                      </GuideStep>
                      <GuideStep number="04" title="Usar GLM 5 pelo Claude">
                        <p>
                          Para o perfil GLM 5, use a conexão compatível com Anthropic abaixo. No Claude Code do terminal,
                          configure ANTHROPIC_BASE_URL com a URL terminando em /glm e inicie com claude --model glm-5. No
                          Desktop, isso depende de sua versão aceitar um identificador de modelo personalizado: selecione ou
                          cadastre glm-5. Trocar somente o nome exibido ou deixar Fable selecionado não troca o perfil para GLM.
                          Se o Desktop não permitir esse modelo, use o Claude Code no terminal.
                        </p>
                        <CodeBlock
                          code={`URL base: ${glmBase}\nModelo: ${glmModel}\nChave: ${actualKey}\nAutenticação: x-api-key`}
                          copy={copy}
                          label="Perfil GLM 5"
                        />
                      </GuideStep>
                    </>
                  )}
                  {tool === "glm" && (
                    <>
                      <GuideStep number="01" title="Adicione um provedor personalizado">
                        <p>
                          Abra o terminal e instale com npm install -g @anthropic-ai/claude-code. Execute os comandos abaixo na
                          mesma janela. Eles já usam a opção de sistema selecionada neste guia e sua chave individual.
                        </p>
                      </GuideStep>
                      <GuideStep number="02" title="Configure o perfil GLM 5">
                        <CodeBlock
                          code={glmCode}
                          copy={copy}
                          label={osLabel}
                        />
                      </GuideStep>
                      <GuideStep number="03" title="Ative o provedor e teste">
                        <p>
                          Inicie com claude --model glm-5 na mesma janela e envie uma mensagem curta. Esta configuração é para
                          o Claude Code; ela não adiciona GLM ao catálogo atual do Codex.
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
                        onChange={(e) => setClientKey(e.target.value.replace(/[\r\n]/g, ""))}
                      />
                      <button type="button" aria-label={reveal ? "Ocultar chave" : "Mostrar chave"} onClick={() => setReveal(!reveal)}>
                        {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </label>
                    <small>O preenchimento fica apenas na memória desta tela. Os comandos copiados conterão sua chave.</small>
                    {clientKey && (
                      <button type="button" className="six-text-button" onClick={() => setClientKey("")}>
                        Limpar chave
                      </button>
                    )}
                  </section>
                  <section className="six-panel">
                    <span className="six-soft-icon">
                      <ShieldCheck size={20} />
                    </span>
                    <h3>Não conectou?</h3>
                    <p>
                      Confira a URL, o identificador do modelo e se a chave está completa. Não envie o segredo da chave ao
                      compartilhar um erro.
                    </p>
                    <button type="button" className="six-text-button" onClick={() => switchTab("help")}>
                      Abrir central de ajuda <ArrowRight size={14} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}

          {tab === "chat" && (
            <SiteChat
              key={session?.user.id || "guest"}
              models={
                subscription?.active
                  ? subscription.models
                  : trial?.active
                    ? trial.models || PRO_BASE_MODELS
                    : []
              }
            />
          )}

          {tab === "plan" && (
            <>
              <div className="six-plan-grid">
                <section className="six-panel six-plan-main">
                  <span className="six-step-badge">Minha assinatura</span>
                  <h2>{preview ? "Entre para ver seu plano" : planTitle}</h2>
                  {subscription && (
                    <p>
                      {subscription.expires
                        ? `Período pago até ${new Date(subscription.expires).toLocaleString("pt-BR")}.`
                        : "Aguardando confirmação do pagamento."}{" "}
                      {subscription.status === "cancelled" ? "Renovação cancelada." : ""}
                    </p>
                  )}
                  {trial && (
                    <p>{trial.revoked ? "Chave do teste revogada." : `Fim do teste: ${new Date(trial.expires).toLocaleString("pt-BR")}.`}</p>
                  )}
                  {!preview && (
                    <p>
                      {trial?.active && !subscription?.active
                        ? "Modelos liberados no teste: Fable 5.1, Argon 4, Astra 6 e GLM 5. Todos disponíveis durante as 3 horas, com velocidade reduzida."
                        : subscription
                          ? `Modelos do seu plano: ${subscription.models.map((model) => MODEL_LABELS[model] || model).join(", ")}.`
                          : "Seu espaço para construir com Fable 5.1, Argon 4, Astra 6 e GLM 5."}
                    </p>
                  )}
                  <div className="six-plan-price">
                    {subscription ? <DashboardNumber value={subscription.amount} format="money" /> : <strong>—</strong>}
                    <span>
                      {subscription
                        ? subscription.mode === "pix"
                          ? "/ 30 dias · pagamento com Pix"
                          : "/ mês · renovação pelo Mercado Pago"
                        : "Sem cobrança ativa"}
                    </span>
                  </div>
                  <div className="six-plan-benefits">
                    {[
                      subscription && !subscription.api ? "Uso somente pelo site" : "Chave individual de acesso",
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
                  <div className="six-plan-actions">
                    <a
                      className="six-primary"
                      href={supportLink("Olá! Quero falar sobre o meu plano SixtySix.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare size={16} /> Falar sobre meu plano
                    </a>
                  </div>
                </section>
              </div>
              <section aria-labelledby="six-plans-title">
                <div className="six-section-head">
                  <h2 id="six-plans-title">Planos</h2>
                  <p>Contrate aqui mesmo, por Pix ou cartão. Depois do pagamento, sua chave chega pelo WhatsApp.</p>
                </div>
                <div className="six-plans-grid">
                  {PLANS.map((plan) => {
                    // Dev pode ir com ou sem chave de API, como na página inicial.
                    const code = plan.code === "dev" && devWithApi ? "devApi" : plan.code
                    const current = Boolean(code && subscription?.active && subscription.plan === code)
                    return (
                      <article key={plan.name} className={`six-plan-card${current ? " is-current" : ""}`}>
                        <img src={plan.icon} alt="" aria-hidden="true" />
                        <h3>{plan.name}</h3>
                        <div className="six-plan-card-price">
                          <span>R$</span>
                          <strong>{plan.code === "dev" && devWithApi ? "94,99" : plan.price}</strong>
                          <small>{plan.period}</small>
                        </div>
                        <p>{plan.desc}</p>
                        {plan.code === "dev" ? (
                          <div className="six-plan-api-toggle" role="group" aria-label="Chave de API no plano Dev">
                            <button type="button" aria-pressed={!devWithApi} onClick={() => setDevWithApi(false)}>
                              Só no site
                            </button>
                            <button type="button" aria-pressed={devWithApi} onClick={() => setDevWithApi(true)}>
                              + Chave de API
                            </button>
                          </div>
                        ) : (
                          <span className="six-plan-card-note">
                            <Check size={14} aria-hidden="true" /> {plan.note}
                          </span>
                        )}
                        {current ? (
                          <span className="six-primary is-current" aria-disabled="true">
                            <CircleCheck size={15} aria-hidden="true" /> Seu plano atual
                          </span>
                        ) : code ? (
                          <Link className="six-primary" to={`/comprar/${code}`}>
                            {plan.code === "dev" && devWithApi ? "Contratar o Dev + API" : plan.cta} <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <a className="six-primary" href={supportLink(plan.message)} target="_blank" rel="noopener noreferrer">
                            {plan.cta} <ArrowUpRight size={15} />
                          </a>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
              <section className="six-panel">
                <div className="six-panel-head">
                  <div>
                    <h2>Cobranças e recibos</h2>
                    <p>Seu histórico de assinatura</p>
                  </div>
                </div>
                {subscription ? (
                  <div className="six-panel-row">
                    <p>Comprovantes, renovação e cancelamento são tratados pelo WhatsApp.</p>
                    <a
                      className="six-secondary"
                      href={supportLink("Olá! Quero um comprovante do meu pagamento SixtySix.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pedir comprovante <ArrowUpRight size={15} />
                    </a>
                  </div>
                ) : (
                  empty(
                    "Nenhuma cobrança registrada no painel",
                    preview
                      ? "Entre na sua conta para ver suas cobranças."
                      : "Compras feitas pelo WhatsApp podem não aparecer aqui. Para comprovantes, fale com a gente.",
                    <a
                      className="six-secondary"
                      href={supportLink("Olá! Quero um comprovante do meu pagamento SixtySix.")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar no WhatsApp <ArrowUpRight size={14} />
                    </a>,
                  )
                )}
              </section>
            </>
          )}

          {tab === "help" && (
            <div className="six-help-layout">
              <section className="six-panel six-faq">
                {[
                  [
                    "Onde consigo minha chave?",
                    "Você recebe sua chave individual e a URL de configuração pelo WhatsApp, logo depois de contratar. Depois, vincule a chave em Chaves de API para ver seu consumo aqui. O plano Dev pago usa somente o site; Dev + API e Pro permitem conexão externa.",
                  ],
                  [
                    "Deu erro 401. O que confiro?",
                    "Confira se a chave está completa, sem espaços, se continua ativa e se o aplicativo usa a URL correta. Uma credencial de login Google ou Discord não substitui sua chave individual do gateway.",
                  ],
                  [
                    "Posso usar GLM 5 no Codex?",
                    "O catálogo atual do gateway no Codex usa gpt-6-astra. O tutorial de GLM 5 é para Claude Code, com a URL base terminando em /glm.",
                  ],
                  [
                    "O Claude Desktop não salva a conexão.",
                    "Confira se sua versão oferece gateway personalizado, use autenticação x-api-key e salve e reinicie. Se o erro persistir, informe o aplicativo, a versão e a mensagem ao suporte, sem enviar sua chave.",
                  ],
                ].map(([q, a], i) => (
                  <div className="six-faq-row" key={q}>
                    <button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>
                      {q}
                      <ChevronDown size={16} />
                    </button>
                    {faq === i && <p>{a}</p>}
                  </div>
                ))}
              </section>
              <section className="six-panel six-support">
                <span className="six-soft-icon">
                  <CircleHelp size={22} />
                </span>
                <h2>
                  Vamos resolver <em>juntos.</em>
                </h2>
                <p>
                  Envie o nome da ferramenta, seu sistema e a mensagem de erro. Assim conseguimos entender o problema mais
                  rápido.
                </p>
                <a
                  className="six-primary"
                  href={supportLink("Olá! Preciso de ajuda com a SixtySix.")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Falar no WhatsApp <ArrowUpRight size={15} />
                </a>
                <a className="six-text-button" href="mailto:alisongeneral25@gmail.com?subject=Suporte%20SixtySix">
                  Prefiro mandar e-mail <ArrowRight size={14} />
                </a>
                <button type="button" className="six-text-button" onClick={() => switchTab("guides")}>
                  Revisar configuração <ArrowRight size={14} />
                </button>
              </section>
            </div>
          )}

          <footer className="six-dashboard-footer">
            <span>Feito para suas próximas grandes ideias.</span>
            <span>
              <a href="/privacidade.html">Privacidade</a>
              <a href="/termos.html">Termos</a>
              <a href="/reembolso.html">Reembolso</a>
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

function GuideStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
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
