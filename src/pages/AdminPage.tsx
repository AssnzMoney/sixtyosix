import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  BellRing,
  Check,
  CircleAlert,
  Clock,
  Copy,
  Download,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Search,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import RouterPanel from '../components/RouterPanel'
import { confirmationReminder, customerGreeting, deliveryMessage, formatWhatsapp, shortOrder, whatsappLink } from '../lib/whatsapp'
import {
  PRODUCT_LABELS,
  STATE_LABELS,
  MODEL_NAMES,
  credentialTitle,
  deliveryState,
  isActiveDelivery,
  type DeliveryProduct,
  type DeliveryRow,
} from '../lib/deliveries'
import './admin.css'

type Row = Record<string, any>
const brShort = (day: string) => day.split('-').reverse().slice(0, 2).join('/')

const tabs: Array<[string, string]> = [
  ['service', 'Atendimento'],
  ['users', 'Clientes'],
  ['deliveries', 'Credenciais'],
  ['subscriptions', 'Planos'],
  ['payments', 'Pagamentos'],
  ['keys', 'Chaves do gateway'],
  ['trials', 'Testes grátis'],
  ['usage', 'Consumo e falhas'],
  ['router', 'Roteador'],
]
const resourceLabels: Record<string, string> = {
  clients: 'Vínculo das chaves',
  subscriptions: 'Planos',
  keys: 'Chaves',
  trials: 'Testes grátis',
  usage: 'Consumo',
  payments: 'Pagamentos',
  deliveries: 'Credenciais',
}
const columns: Record<string, string[]> = {
  users: ['name', 'whatsapp', 'email', 'service_status', 'provider', 'created_at', 'last_sign_in_at'],
  deliveries: ['customer', 'plan_code', 'model_id', 'supplier', 'key_hint', 'base_url', 'delivered_at', 'expires_at', 'state', 'confirmed_at', 'created_by'],
  subscriptions: ['customer', 'plan_code', 'amount_cents', 'provider_status', 'entitled', 'paid_until', 'billing_mode'],
  keys: ['customer', 'token_prefix', 'api_enabled', 'entitled', 'paid_until', 'revoked_at'],
  trials: ['customer', 'token_prefix', 'created_at', 'expires_at', 'revoked_at'],
  usage: ['customer', 'key', 'requested_alias', 'status_code', 'input_tokens', 'output_tokens', 'latency_ms', 'created_at'],
  payments: ['customer', 'plan_code', 'id', 'status', 'amount_cents', 'currency', 'approved_at', 'period_end'],
}
// No CSV de credenciais também saem os dados da confirmação (prova de entrega).
const csvExtra: Record<string, string[]> = { deliveries: ['confirm_ip', 'confirm_user_agent', 'confirm_text', 'notes'] }
const titles: Record<string, string> = {
  name: 'Nome', whatsapp: 'WhatsApp', email: 'E-mail', service_status: 'Atendimento', provider: 'Login', created_at: 'Criado em',
  last_sign_in_at: 'Último acesso', customer: 'Cliente', plan_code: 'Plano', amount_cents: 'Valor', provider_status: 'Status',
  entitled: 'Acesso pago', paid_until: 'Vencimento', billing_mode: 'Cobrança', token_prefix: 'Identificação da chave',
  api_enabled: 'API externa', revoked_at: 'Revogada em', expires_at: 'Válida até', key: 'Chave', requested_alias: 'Modelo',
  status_code: 'Resposta', input_tokens: 'Tokens entrada', output_tokens: 'Tokens saída', latency_ms: 'Tempo (ms)', id: 'ID',
  status: 'Status', currency: 'Moeda', approved_at: 'Aprovado em', period_end: 'Fim do período', product: 'Produto',
  supplier: 'Fornecedor', key_hint: 'Final da chave', base_url: 'URL base', model_id: 'Modelo', delivered_at: 'Enviada em',
  state: 'Estado', confirmed_at: 'Confirmada em', created_by: 'Registrada por', confirm_ip: 'IP da confirmação',
  confirm_user_agent: 'Navegador da confirmação', confirm_text: 'Texto confirmado', notes: 'Observação',
}
const planNames: Record<string, string> = { dev: 'Dev', devApi: 'Dev + API', pro: 'Pro' }
const paymentLabels: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente',
  in_process: 'Em análise',
  authorized: 'Autorizado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
  charged_back: 'Contestado',
}
const money = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (n: number) => n.toLocaleString('pt-BR')
const compact = (n: number) => (n >= 10000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) : n.toLocaleString('pt-BR'))
const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
function format(key: string, value: any) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (key === 'amount_cents') return money(value)
  if (key === 'whatsapp') return formatWhatsapp(value)
  if (key === 'plan_code') return planNames[value] || String(value)
  if (key === 'product') return PRODUCT_LABELS[value as DeliveryProduct] || String(value)
  if (key === 'state') return STATE_LABELS[value as keyof typeof STATE_LABELS] || String(value)
  if (key === 'key_hint') return `…${value}`
  if (key === 'model_id') return MODEL_NAMES[value] ? `${MODEL_NAMES[value]} (${value})` : String(value)
  if (key === 'status' && paymentLabels[value]) return paymentLabels[value]
  if (key.endsWith('_at') || ['paid_until', 'period_end'].includes(key)) return new Date(value).toLocaleString('pt-BR')
  if (typeof value === 'number') return number(value)
  return String(value)
}
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
const fullDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
/** Data (AAAA-MM-DD) no horário de Brasília, para o campo "Válida até". */
const brDate = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
/** "há 3 h", "em 5 dias"… */
function relative(value: string | null | undefined, now = Date.now()) {
  if (!value) return ''
  const diff = Date.parse(value) - now
  const abs = Math.abs(diff)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)
  const text = abs < 3600000 ? 'menos de 1 h' : abs < 86400000 ? `${hours} h` : `${days} ${days === 1 ? 'dia' : 'dias'}`
  return diff >= 0 ? `em ${text}` : `há ${text}`
}
const subscriptionActive = (s: Row, now = Date.now()) => Boolean(s.entitled && s.paid_until && Date.parse(s.paid_until) > now)
const subscriptionLabel = (s: Row) =>
  `${planNames[s.plan_code] || s.plan_code} · ${money(Number(s.amount_cents || 0))} · ${
    subscriptionActive(s) ? `pago até ${fullDate(s.paid_until)}` : s.paid_until ? `venceu em ${fullDate(s.paid_until)}` : 'aguardando pagamento'
  }`

/** Entrega da operação atual: uma chave SixtySix (sk-rt-) criada no Roteador para o cliente. */
type KeyDraft = { userId: string; subscription_id: string; expires: string; all: boolean; models: string[] }
type KeyDelivered = { key: string; hint: string; expires_at: string; models: string[] | null; deliveryId: string | null; email?: string }
type Customer = { id: string; name: string; email: string; whatsapp: string }

export default function AdminPage() {
  const { session, loading } = useAuth()
  const [data, setData] = useState<Record<string, Row[]>>({})
  const [tab, setTab] = useState('service')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [failed, setFailed] = useState<string[]>([])
  const [updated, setUpdated] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState<KeyDraft | null>(null)
  const [draftCustomer, setDraftCustomer] = useState<Customer | null>(null)
  const [draftError, setDraftError] = useState('')
  const [saving, setSaving] = useState(false)
  const [delivered, setDelivered] = useState<KeyDelivered | null>(null)
  const [routerModels, setRouterModels] = useState<{ alias: string; label: string }[] | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    let alive = true
    setBusy(true)
    setError('')
    setNotice('')
    setFailed([])
    async function load() {
      const result: Record<string, Row[]> = {}
      let capped = false
      const fetchPage = async (resource: string, offset: number) => {
        const response = await fetch('/api/management?' + new URLSearchParams({ resource, offset: String(offset), from, to }), {
          headers: { Authorization: `Bearer ${session!.access_token}` },
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Falha ao carregar a administração.')
        return body
      }
      async function rest(resource: string, initial?: any) {
        let page = initial
        let offset = initial ? 500 : 0
        const rows: Row[] = initial ? [...initial.rows] : []
        while (!initial || page.hasMore) {
          page = await fetchPage(resource, offset)
          rows.push(...page.rows)
          offset += 500
          initial = page
          if (!page.hasMore) break
          if (offset >= 10000) {
            capped = true
            break
          }
        }
        result[resource] = rows
      }
      // Valida o administrador antes de pedir o restante.
      const first = await fetchPage('users', 0)
      if (alive) setAdminEmail(first.admin || '')
      await rest('users', first)
      const missing: string[] = []
      await Promise.all(
        Object.keys(resourceLabels).map(async (resource) => {
          try {
            await rest(resource)
          } catch (e) {
            if (controller.signal.aborted) throw e
            result[resource] = []
            missing.push(resource)
          }
        }),
      )
      const known = new Set([...result.keys, ...result.trials].map((x) => x.gateway_client_id))
      result.keys.push(
        ...result.clients
          .filter((x) => !known.has(x.id))
          .map((x) => ({ ...x, gateway_client_id: x.id, token_prefix: x.key_prefix, entitled: x.enabled, api_enabled: true })),
      )
      if (alive) {
        setData(result)
        setFailed(missing)
        setUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        if (capped) setNotice('Exibindo até 10.000 registros por seção. Reduza o período para consultar o consumo em partes.')
      }
    }
    load()
      .catch((e) => {
        if (alive && e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [session?.access_token, from, to, revision])

  useEffect(() => {
    if (!profileId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileId(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [profileId])

  async function adminAction<T>(body: Row): Promise<T> {
    const response = await fetch('/api/management', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
    return result as T
  }

  /* ----------------------------- Junções ----------------------------- */
  const now = Date.now()
  const usersById = useMemo(() => new Map((data.users || []).map((u) => [u.id, u])), [data.users])
  const subscriptionsByUser = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const s of data.subscriptions || []) map.set(s.user_id, [...(map.get(s.user_id) || []), s])
    return map
  }, [data.subscriptions])
  const deliveries = useMemo<Row[]>(
    () => (data.deliveries || []).map((d) => ({ ...d, state: deliveryState(d as DeliveryRow) })),
    [data.deliveries],
  )
  const deliveriesByUser = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const d of deliveries) map.set(d.user_id, [...(map.get(d.user_id) || []), d])
    return map
  }, [deliveries])
  const customer = (id: string): Customer => {
    const u = usersById.get(id)
    return { id, name: u?.name || 'Sem nome', email: u?.email || id || 'Sem conta', whatsapp: u?.whatsapp || '' }
  }
  const activeSubscription = (userId: string) =>
    (subscriptionsByUser.get(userId) || []).find((s) => s.entitled && Date.parse(s.paid_until) > now)
  const activeDeliveries = (userId: string) => (deliveriesByUser.get(userId) || []).filter((d) => isActiveDelivery(d as DeliveryRow))
  const deliveriesReady = !failed.includes('deliveries')
  const subscriptionsById = useMemo(() => new Map((data.subscriptions || []).map((s) => [s.id, s])), [data.subscriptions])
  const paymentsBySubscription = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const p of data.payments || []) map.set(p.subscription_id, [...(map.get(p.subscription_id) || []), p])
    for (const list of map.values()) list.sort((a, b) => String(b.approved_at || b.recorded_at).localeCompare(String(a.approved_at || a.recorded_at)))
    return map
  }, [data.payments])
  /** Quando o plano foi pago: último pagamento aprovado, ou a criação do pedido. */
  const paidAt = (s: Row) => (paymentsBySubscription.get(s.id) || []).find((p) => p.status === 'approved' && p.approved_at)?.approved_at || s.created_at
  const userSubscriptions = (userId: string) =>
    [...(subscriptionsByUser.get(userId) || [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  /* ------------------------------ Filas ------------------------------ */
  const queues = useMemo(() => {
    const soon = now + 3 * 86400000
    const users = data.users || []
    const paidWaiting = users
      .map((u) => ({ user: u, subscription: activeSubscription(u.id) }))
      .filter((x) => x.subscription && (!deliveriesReady || activeDeliveries(x.user.id).length === 0))
      .sort((a, b) => String(paidAt(a.subscription!)).localeCompare(String(paidAt(b.subscription!))))
    const awaitingConfirmation = deliveries.filter((d) => d.state === 'pending')
    const rotation = deliveries
      .filter((d) => !d.replaced_at && !d.revoked_at && d.expires_at && Date.parse(d.expires_at) <= soon)
      .sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)))
    const endedWithKey = users.filter((u) => !activeSubscription(u.id) && activeDeliveries(u.id).length > 0)
    const weekAgo = now - 7 * 86400000
    const pendingPayment = (data.subscriptions || [])
      .filter((s) => !s.entitled && Date.parse(s.created_at) >= weekAgo && !activeSubscription(s.user_id))
      .filter((s, i, list) => list.findIndex((x) => x.user_id === s.user_id) === i)
    const noWhatsapp = users.filter((u) => !u.whatsapp)
    return { paidWaiting, awaitingConfirmation, rotation, endedWithKey, pendingPayment, noWhatsapp }
  }, [data, deliveries, deliveriesByUser, subscriptionsByUser, deliveriesReady, paymentsBySubscription])

  const serviceStatus = (userId: string) => {
    if (activeDeliveries(userId).some((d) => d.state === 'pending')) return 'Aguardando confirmação'
    if (activeDeliveries(userId).length) return 'Credencial confirmada'
    if (activeSubscription(userId)) return deliveriesReady ? 'Pagou, aguardando entrega' : 'Plano ativo'
    return 'Sem plano ativo'
  }

  /* ------------------------- Tabelas genéricas ------------------------ */
  const enriched = useMemo<Row[]>(() => {
    if (tab === 'service' || tab === 'router') return []
    const subs = new Map((data.subscriptions || []).map((x) => [x.id, x]))
    const clients = new Map<string, Row>((data.clients || []).map((x) => [x.id, { ...x, owner: x.user_id }]))
    for (const x of [...(data.keys || []), ...(data.trials || [])])
      clients.set(x.gateway_client_id, { ...clients.get(x.gateway_client_id), owner: x.user_id, key_prefix: x.token_prefix })
    const label = (id: string) => {
      const u = usersById.get(id)
      return u ? `${u.name || 'Sem nome'} · ${u.email}` : id || 'Chave legada sem conta vinculada'
    }
    const source = tab === 'deliveries' ? deliveries : data[tab] || []
    const term = search.toLowerCase()
    return source
      .map((x) => {
        const sub = subs.get(x.subscription_id)
        const client = clients.get(x.client_id)
        const owner = x.user_id || sub?.user_id || client?.owner
        return {
          ...x,
          // Chaves do Roteador não têm conta: aparecem pelo nome do cliente.
          customer: owner || !client?.name ? label(owner) : client.name,
          plan_code: x.plan_code || sub?.plan_code,
          key: client?.key_prefix || x.client_id,
          ...(tab === 'users' ? { service_status: serviceStatus(x.id) } : {}),
        }
      })
      .filter((x) => !term || JSON.stringify(x).toLowerCase().includes(term))
  }, [data, tab, search, deliveries, usersById])

  // Aba Consumo: soma por cliente (todas as chaves dele), do maior consumo para o menor. Respeita período e busca.
  const usageByCustomer = useMemo(() => {
    if (tab !== 'usage') return null
    type Group = { customer: string; keys: Set<string>; requests: number; input: number; output: number; errors: number; last: string; models: Map<string, number> }
    const groups = new Map<string, Group>()
    for (const row of enriched) {
      const name = String(row.customer || 'Sem cliente')
      const g = groups.get(name) || { customer: name, keys: new Set<string>(), requests: 0, input: 0, output: 0, errors: 0, last: '', models: new Map<string, number>() }
      g.requests++
      g.input += Number(row.input_tokens || 0)
      g.output += Number(row.output_tokens || 0)
      if (Number(row.status_code) >= 400) g.errors++
      if (String(row.created_at || '') > g.last) g.last = String(row.created_at)
      if (String(row.key || '').startsWith('sk-')) g.keys.add(String(row.key))
      if (row.requested_alias) g.models.set(String(row.requested_alias), (g.models.get(String(row.requested_alias)) || 0) + 1)
      groups.set(name, g)
    }
    const list = [...groups.values()].sort((a, b) => b.input + b.output - (a.input + a.output) || b.requests - a.requests)
    const total = list.reduce((t, g) => ({ requests: t.requests + g.requests, tokens: t.tokens + g.input + g.output, errors: t.errors + g.errors }), { requests: 0, tokens: 0, errors: 0 })
    return { list, total }
  }, [tab, enriched])

  const revenue = (data.payments || []).filter((x) => x.status === 'approved').reduce((a, x) => a + Number(x.amount_cents || 0), 0)
  const activePlans = (data.subscriptions || []).filter((x) => x.entitled && Date.parse(x.paid_until) > now).length

  function exportCsv() {
    const cols = [...columns[tab], ...(csvExtra[tab] || [])]
    const escape = (v: any) => '"' + String(v ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"'
    const value = (c: string, row: Row) => (c === 'whatsapp' ? row.whatsapp || '' : format(c, row[c]))
    const csv = String.fromCharCode(0xfeff) + [cols.map((c) => escape(titles[c])).join(';'), ...enriched.map((x) => cols.map((c) => escape(value(c, x))).join(';'))].join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `sixtysix-${tab}-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function revokeOld() {
    if (!session) return
    if (!window.confirm('Revogar todos os testes grátis criados antes de 09/11/2026 às 18h10? Essa ação não pode ser desfeita.')) return
    setBusy(true)
    setError('')
    try {
      const result = await adminAction<{ revoked: number }>({ action: 'revoke-old-trials' })
      setNotice(`${result.revoked} testes antigos revogados.`)
      setRevision((x) => x + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível revogar.')
      setBusy(false)
    }
  }

  async function revokeDelivery(d: Row) {
    if (!window.confirm(`Revogar a credencial …${d.key_hint} de ${customer(d.user_id).name}? Lembre de desativar a chave no fornecedor.`)) return
    try {
      await adminAction({ action: 'revoke-delivery', id: d.id })
      setNotice(`Credencial …${d.key_hint} revogada.`)
      setRevision((x) => x + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível revogar.')
    }
  }

  /* -------------------------- Entregar chave -------------------------- */
  // Cria a chave SixtySix no Roteador para o cliente, liga à conta dele e registra a entrega
  // para ele só confirmar no painel. A validade vem do fim do plano pago (ou 30 dias).
  async function loadRouterModels() {
    if (routerModels || !session) return
    try {
      const response = await fetch('/api/management?resource=router', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os modelos do Roteador.')
      const providers = new Map((body.providers || []).map((p: Row) => [p.id, p]))
      setRouterModels((body.models || []).filter((m: Row) => m.enabled && (providers.get(m.provider_id) as Row | undefined)?.enabled).map((m: Row) => ({ alias: m.alias, label: m.label || m.alias })))
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Não foi possível carregar os modelos do Roteador.')
      setRouterModels([])
    }
  }
  const defaultExpires = (s?: Row) => (s?.paid_until && subscriptionActive(s) ? brDate(s.paid_until) : inDays(30))
  // `options` fica por compatibilidade com os botões antigos de rotação: agora sempre entrega uma chave nova.
  function openDelivery(userId: string, _options: { replaces?: Row } = {}) {
    const subscription = activeSubscription(userId) || userSubscriptions(userId)[0]
    setDraftCustomer(customer(userId))
    setDraftError('')
    setDelivered(null)
    setProfileId(null)
    setDraft({ userId, subscription_id: subscription?.id || '', expires: defaultExpires(subscription), all: true, models: [] })
    void loadRouterModels()
  }
  const pickSubscription = (id: string) => {
    if (!draft) return
    setDraft({ ...draft, subscription_id: id, expires: defaultExpires(subscriptionsById.get(id)) })
  }
  const draftSubscription = draft?.subscription_id ? subscriptionsById.get(draft.subscription_id) : undefined
  const closeDelivery = () => {
    setDraft(null)
    if (delivered) setRevision((x) => x + 1)
    setDelivered(null)
  }
  async function saveDelivery(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (!draft.expires) return setDraftError('Escolha até quando a chave vale.')
    if (!draft.all && !draft.models.length) return setDraftError('Escolha pelo menos um modelo.')
    setSaving(true)
    setDraftError('')
    try {
      const result = await adminAction<KeyDelivered>({ action: 'deliver-key', user_id: draft.userId, subscription_id: draft.subscription_id || null, expires: draft.expires, models: draft.all ? null : draft.models })
      setDelivered(result)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Não foi possível criar a chave.')
    } finally {
      setSaving(false)
    }
  }
  const deliveredMessage = (c: Customer, d: KeyDelivered) => {
    const labels = (d.models || (routerModels || []).map((m) => m.alias)).map((alias) => routerModels?.find((m) => m.alias === alias)?.label || alias)
    return [
      `Olá${c.name && c.name !== 'Sem nome' ? `, ${c.name}` : ''}! Seu acesso SixtySix está liberado.`,
      '',
      `Chave: ${d.key}`,
      'Endereço (Claude Code): https://www.sixtysix.online',
      'Endereço (Codex, Cline, OpenCode e apps compatíveis com OpenAI): https://www.sixtysix.online/v1',
      ...(labels.length ? [`Modelos: ${labels.join(', ')}`] : []),
      `Válida até: ${fullDate(d.expires_at)}`,
      '',
      'Depois de configurar, confirme o recebimento no seu painel: https://www.sixtysix.online/dashboard',
    ].join('\n')
  }

  /* --------------------------- Fragmentos ---------------------------- */
  const whatsappButton = (c: Customer, text: string, label = 'Chamar') => {
    const href = whatsappLink(c.whatsapp, text)
    return href ? (
      <a className="sx-btn is-whatsapp" href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle size={15} /> {label}
      </a>
    ) : (
      <span className="sx-btn is-disabled" title="Cliente sem WhatsApp cadastrado">
        <MessageCircle size={15} /> Sem WhatsApp
      </span>
    )
  }
  const who = (c: Customer) => (
    <div className="sx-who">
      <button type="button" className="sx-who-name" onClick={() => setProfileId(c.id)} title="Abrir ficha do cliente">
        {c.name}
      </button>
      <span>{c.email}</span>
      <span className={c.whatsapp ? 'sx-phone' : 'sx-phone is-missing'}>{c.whatsapp ? formatWhatsapp(c.whatsapp) : 'sem WhatsApp'}</span>
    </div>
  )
  const queue = (title: string, description: string, icon: ReactNode, count: number, tone: string, children: ReactNode) => (
    <section className={`sx-queue is-${tone}`}>
      <header>
        <span className="sx-queue-icon">{icon}</span>
        <div>
          <h2>
            {title} <small>{count}</small>
          </h2>
          <p>{description}</p>
        </div>
      </header>
      {count ? <ul>{children}</ul> : <p className="sx-queue-empty">Nada por aqui.</p>}
    </section>
  )
  const planOf = (userId: string) => {
    const s = activeSubscription(userId)
    return s ? planNames[s.plan_code] || s.plan_code : ''
  }

  /* ------------------------- Ficha do cliente ------------------------ */
  const profile = profileId
    ? {
        customer: customer(profileId),
        user: usersById.get(profileId),
        active: activeSubscription(profileId),
        subscriptions: userSubscriptions(profileId),
        credentials: [...(deliveriesByUser.get(profileId) || [])].sort((a, b) => String(b.delivered_at).localeCompare(String(a.delivered_at))),
        payments: userSubscriptions(profileId)
          .flatMap((s) => (paymentsBySubscription.get(s.id) || []).map((p): Row => ({ ...p, plan_code: s.plan_code })))
          .sort((a, b) => String(b.approved_at || b.recorded_at).localeCompare(String(a.approved_at || a.recorded_at))),
        trial: (data.trials || []).find((t) => t.user_id === profileId),
      }
    : null

  const metrics: Array<[string, ReactNode, string]> = [
    [deliveriesReady ? 'Pagou, aguarda entrega' : 'Pagantes ativos', queues.paidWaiting.length, queues.paidWaiting.length ? 'alert' : ''],
    ['Aguardando confirmação', deliveriesReady ? queues.awaitingConfirmation.length : '—', ''],
    ['Rotação em até 3 dias', deliveriesReady ? queues.rotation.length : '—', queues.rotation.length ? 'warn' : ''],
    ['Clientes', number(data.users?.length || 0), ''],
    ['Sem WhatsApp', number(queues.noWhatsapp.length), ''],
    ['Planos ativos', number(activePlans), ''],
    ['Receita aprovada no período', money(revenue), ''],
  ]

  return (
    <main className="sx-admin">
      <header className="sx-admin-top">
        <div className="sx-admin-brand">
          <img src="/assets/sidebar-logo.png" alt="SixtySix" />
          <span>
            Administração
            <small>{adminEmail || 'Área privada'}</small>
          </span>
        </div>
        <div className="sx-admin-top-actions">
          {updated && <span className="sx-admin-updated">Atualizado às {updated}</span>}
          <button type="button" className="sx-btn" disabled={busy || !session} onClick={() => setRevision((x) => x + 1)}>
            <RefreshCw size={15} className={busy ? 'sx-spin' : ''} /> {busy ? 'Atualizando…' : 'Atualizar'}
          </button>
          <Link to="/dashboard" className="sx-btn">
            <ArrowLeft size={15} /> Painel do cliente
          </Link>
        </div>
      </header>

      <section className="sx-admin-heading">
        <span className="sx-eyebrow">controle da operação</span>
        <h1>
          Atendimento <em>pelo WhatsApp.</em>
        </h1>
        <p>Quem pagou, quem já recebeu a credencial, quem confirmou e o que precisa de rotação.</p>
      </section>

      {loading ? (
        <p className="sx-admin-message" role="status">
          Conferindo sua conta…
        </p>
      ) : !session ? (
        <div className="sx-admin-message">
          <h2>Entre com sua conta administrativa</h2>
          <Link className="sx-btn is-primary" to="/login">
            Entrar na SixtySix
          </Link>
        </div>
      ) : error && !data.users ? (
        <div role="alert" className="sx-admin-message is-error">
          <CircleAlert size={18} /> {error}
        </div>
      ) : (
        <>
          {error && (
            <p role="alert" className="sx-admin-message is-error">
              <CircleAlert size={16} /> {error}
            </p>
          )}
          {notice && <p className="sx-admin-message">{notice}</p>}
          {failed.length > 0 && (
            <p className="sx-admin-message is-warning">
              <CircleAlert size={16} />
              {failed.includes('deliveries')
                ? ' Credenciais indisponíveis: aplique a migração supabase/whatsapp-delivery.sql no Supabase. '
                : ' '}
              {failed.filter((x) => x !== 'deliveries').length > 0 &&
                `Dados indisponíveis: ${failed.filter((x) => x !== 'deliveries').map((x) => resourceLabels[x]).join(', ')}.`}
            </p>
          )}

          <div className="sx-admin-metrics">
            {metrics.map(([label, value, tone]) => (
              <article key={label} className={tone ? `is-${tone}` : ''}>
                <span>{label}</span>
                <strong>{busy && !data.users ? '…' : value}</strong>
              </article>
            ))}
          </div>

          <nav className="sx-admin-tabs" aria-label="Seções da administração">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={tab === key ? 'active' : ''}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => {
                  setTab(key)
                  setSearch('')
                }}
              >
                {label}
                {key !== 'service' && key !== 'router' && <small>{(key === 'deliveries' ? deliveries : data[key])?.length ?? 0}</small>}
              </button>
            ))}
          </nav>

          {tab === 'router' ? (
            <RouterPanel token={session!.access_token} usage={data.usage || []} users={data.users || []} period={`${brShort(from)} a ${brShort(to)}`} />
          ) : tab === 'service' ? (
            <div className="sx-queues">
              {queue(
                'Pagou e aguarda entrega',
                deliveriesReady
                  ? 'Plano ativo e nenhuma credencial ativa. Chame no WhatsApp e registre a entrega.'
                  : 'Plano ativo. Para registrar entregas, aplique a migração supabase/whatsapp-delivery.sql.',
                <Wallet size={18} />,
                queues.paidWaiting.length,
                'alert',
                queues.paidWaiting.map(({ user, subscription }) => {
                  const c = customer(user.id)
                  return (
                    <li key={user.id}>
                      {who(c)}
                      <div className="sx-context">
                        <strong>
                          {planNames[subscription!.plan_code] || subscription!.plan_code} · {money(Number(subscription!.amount_cents || 0))}
                        </strong>
                        <span className={now - Date.parse(paidAt(subscription!)) > 2 * 3600000 ? 'is-late' : 'is-fresh'}>
                          Pagou {relative(paidAt(subscription!), now)}
                        </span>
                        <span>Acesso até {fullDate(subscription!.paid_until)}</span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, customerGreeting({ name: c.name, plan: planNames[subscription!.plan_code] }))}
                        <button type="button" className="sx-btn is-primary" disabled={!deliveriesReady} onClick={() => openDelivery(user.id)}>
                          <KeyRound size={15} /> Entregar chave
                        </button>
                      </div>
                    </li>
                  )
                }),
              )}
              {queue(
                'Entregue, aguardando confirmação',
                'O cliente ainda não confirmou na dashboard que recebeu a chave e a URL.',
                <BellRing size={18} />,
                queues.awaitingConfirmation.length,
                'info',
                queues.awaitingConfirmation.map((d) => {
                  const c = customer(d.user_id)
                  return (
                    <li key={d.id}>
                      {who(c)}
                      <div className="sx-context">
                        <strong>
                          {credentialTitle(d)} · …{d.key_hint}
                        </strong>
                        <span className={now - Date.parse(d.delivered_at) > 86400000 ? 'is-late' : ''}>Enviada {relative(d.delivered_at, now)}</span>
                        <span>{planOf(d.user_id) ? `Plano ${planOf(d.user_id)}` : 'Sem plano ativo'}</span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, confirmationReminder({ name: c.name, hint: d.key_hint }), 'Lembrar')}
                      </div>
                    </li>
                  )
                }),
              )}
              {queue(
                'Rotação em até 3 dias ou vencida',
                'Credenciais que precisam de uma chave nova. Ao registrar, a anterior é marcada como substituída.',
                <Clock size={18} />,
                queues.rotation.length,
                'warn',
                queues.rotation.map((d) => {
                  const c = customer(d.user_id)
                  const expired = Date.parse(d.expires_at) <= now
                  return (
                    <li key={d.id}>
                      {who(c)}
                      <div className="sx-context">
                        <strong>
                          {credentialTitle(d)} · …{d.key_hint}
                        </strong>
                        <span className={expired ? 'is-late' : 'is-soon'}>
                          {expired ? 'Venceu' : 'Vence'} {relative(d.expires_at, now)}
                        </span>
                        <span>
                          {fullDate(d.expires_at)}
                          {planOf(d.user_id) ? ` · plano ${planOf(d.user_id)}` : ' · sem plano ativo'}
                        </span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, customerGreeting({ name: c.name, plan: planOf(d.user_id) }))}
                        <button type="button" className="sx-btn is-primary" onClick={() => openDelivery(d.user_id, { replaces: d })}>
                          <KeyRound size={15} /> Entregar chave nova
                        </button>
                      </div>
                    </li>
                  )
                }),
              )}
              {queue(
                'Sem plano ativo e com chave ativa',
                'Venceu, estornou ou é teste. Confira e, se for o caso, desative no fornecedor e revogue aqui.',
                <Ban size={18} />,
                queues.endedWithKey.length,
                'danger',
                queues.endedWithKey.map((u) => {
                  const c = customer(u.id)
                  return activeDeliveries(u.id).map((d) => (
                    <li key={d.id}>
                      {who(c)}
                      <div className="sx-context">
                        <strong>
                          {credentialTitle(d)} · …{d.key_hint}
                        </strong>
                        <span className="is-late">
                          {userSubscriptions(u.id)[0]?.paid_until
                            ? `Plano venceu ${relative(userSubscriptions(u.id)[0].paid_until, now)}`
                            : 'Sem plano (teste ou cortesia)'}
                        </span>
                        <span>{d.expires_at ? `Chave válida até ${fullDate(d.expires_at)}` : 'Chave sem validade registrada'}</span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, `Olá, ${c.name}! Aqui é da SixtySix. Seu acesso não está ativo no momento. Quer renovar?`)}
                        <button type="button" className="sx-btn is-danger" onClick={() => void revokeDelivery(d)}>
                          <X size={15} /> Revogar
                        </button>
                      </div>
                    </li>
                  ))
                }),
              )}
              {queue(
                'Pagamento pendente (7 dias)',
                'Começou a compra e ainda não pagou. Um contato pode ajudar.',
                <Wallet size={18} />,
                queues.pendingPayment.length,
                'muted',
                queues.pendingPayment.map((s) => {
                  const c = customer(s.user_id)
                  return (
                    <li key={s.id}>
                      {who(c)}
                      <div className="sx-context">
                        <strong>
                          {planNames[s.plan_code] || s.plan_code} · {money(Number(s.amount_cents || 0))}
                        </strong>
                        <span>Começou {relative(s.created_at, now)}</span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, `Olá, ${c.name}! Aqui é da SixtySix. Vi que você começou a contratar o plano ${planNames[s.plan_code] || ''}. Posso ajudar a concluir?`)}
                      </div>
                    </li>
                  )
                }),
              )}
              {queue(
                'Sem WhatsApp cadastrado',
                'Contas antigas: o WhatsApp será pedido no próximo acesso.',
                <UserRound size={18} />,
                queues.noWhatsapp.length,
                'muted',
                queues.noWhatsapp.slice(0, 30).map((u) => (
                  <li key={u.id}>
                    {who(customer(u.id))}
                    <div className="sx-context">
                      <span>{u.last_sign_in_at ? `Último acesso ${relative(u.last_sign_in_at, now)}` : 'Nunca acessou'}</span>
                    </div>
                  </li>
                )),
              )}
            </div>
          ) : (
            <section className="sx-admin-panel">
              <div className="sx-admin-tools">
                <label className="sx-search">
                  <Search size={16} />
                  <input
                    aria-label="Buscar"
                    placeholder="Busque cliente, WhatsApp, chave ou status…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                {['usage', 'payments'].includes(tab) && (
                  <div className="sx-admin-filters">
                    <label>
                      De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </label>
                    <label>
                      Até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </label>
                  </div>
                )}
                {tab === 'trials' && (
                  <button type="button" className="sx-btn is-danger" disabled={busy} onClick={() => void revokeOld()}>
                    <Ban size={15} /> Revogar testes antes de 09/11 18h10
                  </button>
                )}
                <button type="button" className="sx-btn" disabled={busy || !enriched.length} onClick={exportCsv}>
                  <Download size={15} /> Exportar CSV
                </button>
              </div>
              {['usage', 'payments'].includes(tab) && <p className="sx-admin-hint">Período aplicado ao consumo e aos pagamentos, em UTC.</p>}
              {tab === 'usage' && usageByCustomer && (
                <div className="sx-usage-summary">
                  <h3>Consumo por cliente</h3>
                  <div className="sx-admin-metrics">
                    <article><span>Chamadas</span><strong>{number(usageByCustomer.total.requests)}</strong></article>
                    <article><span>Tokens (entrada + saída)</span><strong>{compact(usageByCustomer.total.tokens)}</strong></article>
                    <article><span>Clientes que usaram</span><strong>{number(usageByCustomer.list.length)}</strong></article>
                    <article className={usageByCustomer.total.errors ? 'is-warn' : ''}>
                      <span>Chamadas com erro</span>
                      <strong>{number(usageByCustomer.total.errors)}{usageByCustomer.total.requests ? ` (${Math.round((usageByCustomer.total.errors / usageByCustomer.total.requests) * 100)}%)` : ''}</strong>
                    </article>
                  </div>
                  {usageByCustomer.list.length ? (
                    <div className="sx-admin-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Cliente</th>
                            <th>Chamadas</th>
                            <th>Tokens de entrada</th>
                            <th>Tokens de saída</th>
                            <th>Com erro</th>
                            <th>Modelos mais usados</th>
                            <th>Última chamada</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageByCustomer.list.slice(0, 200).map((g) => (
                            <tr key={g.customer}>
                              <td title={g.customer}>
                                <strong>{g.customer}</strong>
                                {g.keys.size > 0 && <small className="sx-usage-keys">{[...g.keys].join(' · ')}</small>}
                              </td>
                              <td>{number(g.requests)}</td>
                              <td>{compact(g.input)}</td>
                              <td>{compact(g.output)}</td>
                              <td className={g.errors ? 'sx-admin-failure' : ''}>{number(g.errors)}</td>
                              <td className="sx-usage-models">
                                {[...g.models.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${m} (${number(n)})`).join(' · ')}
                              </td>
                              <td>{g.last ? shortDate(g.last) : '—'}</td>
                              <td>
                                <button type="button" className="sx-btn" onClick={() => setSearch(g.customer)}>
                                  <Search size={15} /> Ver chamadas
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="sx-admin-hint">Ninguém usou neste período{search ? ' com essa busca' : ''}.</p>
                  )}
                  <h3>Chamadas, uma por uma</h3>
                </div>
              )}
              <div className="sx-admin-table">
                <table>
                  <thead>
                    <tr>
                      {columns[tab].map((c) => (
                        <th key={c}>{titles[c]}</th>
                      ))}
                      {['users', 'deliveries'].includes(tab) && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {enriched.slice(0, 500).map((row, i) => (
                      <tr key={row.id || row.subscription_id || i}>
                        {columns[tab].map((c) => (
                          <td key={c} className={c === 'status_code' && row[c] >= 400 ? 'sx-admin-failure' : ''}>
                            {c === 'state' ? <span className={`sx-state is-${row.state}`}>{format(c, row[c])}</span> : format(c, row[c])}
                          </td>
                        ))}
                        {tab === 'users' && (
                          <td>
                            <div className="sx-actions">
                              <button type="button" className="sx-btn" onClick={() => setProfileId(row.id)}>
                                <UserRound size={15} /> Ficha
                              </button>
                              {whatsappButton(customer(row.id), customerGreeting({ name: row.name, plan: planOf(row.id) }))}
                              {deliveriesReady && (
                                <button type="button" className="sx-btn" onClick={() => openDelivery(row.id)}>
                                  <KeyRound size={15} /> Entregar chave
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        {tab === 'deliveries' && (
                          <td>
                            <div className="sx-actions">
                              {(row.state === 'pending' || row.state === 'confirmed' || row.state === 'expired') && (
                                <button type="button" className="sx-btn" onClick={() => openDelivery(row.user_id, { replaces: row })}>
                                  <KeyRound size={15} /> Chave nova
                                </button>
                              )}
                              {!row.revoked_at && (
                                <button type="button" className="sx-btn is-danger" onClick={() => void revokeDelivery(row)}>
                                  <X size={15} /> Revogar
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!enriched.length && (
                  <p className="sx-admin-empty">
                    {busy
                      ? 'Carregando os dados da operação…'
                      : tab === 'deliveries' && !deliveriesReady
                        ? 'Aplique a migração supabase/whatsapp-delivery.sql para registrar credenciais.'
                        : 'Nenhum registro encontrado.'}
                  </p>
                )}
              </div>
              <footer>
                {enriched.length > 500
                  ? 'Mostrando os primeiros 500 resultados. Use a busca ou exporte o CSV completo.'
                  : `${number(enriched.length)} registros encontrados.`}
              </footer>
            </section>
          )}
        </>
      )}

      {profileId && profile && (
        <div className="sx-drawer-backdrop" onClick={() => setProfileId(null)}>
          <aside className="sx-drawer" role="dialog" aria-modal="true" aria-labelledby="sx-drawer-title" onClick={(e) => e.stopPropagation()}>
            <header className="sx-drawer-head">
              <div>
                <span className="sx-eyebrow">ficha do cliente</span>
                <h2 id="sx-drawer-title">{profile.customer.name}</h2>
                <p>{profile.customer.email}</p>
                <p className={profile.customer.whatsapp ? 'sx-phone' : 'sx-phone is-missing'}>
                  {profile.customer.whatsapp ? formatWhatsapp(profile.customer.whatsapp) : 'Sem WhatsApp cadastrado'}
                </p>
              </div>
              <button type="button" className="sx-icon" onClick={() => setProfileId(null)} aria-label="Fechar ficha">
                <X size={18} />
              </button>
            </header>

            <div className="sx-drawer-status">
              <span className={`sx-state ${profile.active ? 'is-confirmed' : 'is-pending'}`}>{serviceStatus(profileId)}</span>
              <span>
                Conta criada {relative(profile.user?.created_at, now)}
                {profile.user?.provider ? ` · entra com ${profile.user.provider}` : ''}
              </span>
              <span>{profile.user?.last_sign_in_at ? `Último acesso ${relative(profile.user.last_sign_in_at, now)}` : 'Nunca acessou'}</span>
            </div>

            <div className="sx-actions sx-drawer-actions">
              {whatsappButton(profile.customer, customerGreeting({ name: profile.customer.name, plan: planOf(profileId) }), 'Chamar no WhatsApp')}
              {deliveriesReady && (
                <button type="button" className="sx-btn is-primary" onClick={() => openDelivery(profileId)}>
                  <KeyRound size={15} /> Entregar chave
                </button>
              )}
            </div>

            <section className="sx-drawer-section">
              <h3>Assinaturas</h3>
              {profile.subscriptions.length ? (
                <ul className="sx-drawer-list">
                  {profile.subscriptions.map((s) => (
                    <li key={s.id}>
                      <div>
                        <strong>
                          {planNames[s.plan_code] || s.plan_code} · {money(Number(s.amount_cents || 0))}
                        </strong>
                        <span>
                          {s.billing_mode === 'pix' ? 'Pix (30 dias)' : 'Cartão (mensal)'} · pedido {shortOrder(String(s.id))}
                        </span>
                      </div>
                      <span className={`sx-state ${subscriptionActive(s, now) ? 'is-confirmed' : s.paid_until ? 'is-expired' : 'is-pending'}`}>
                        {subscriptionActive(s, now)
                          ? `Ativo até ${fullDate(s.paid_until)}`
                          : s.paid_until
                            ? `Venceu em ${fullDate(s.paid_until)}`
                            : 'Aguardando pagamento'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sx-drawer-empty">Nenhuma assinatura.</p>
              )}
            </section>

            <section className="sx-drawer-section">
              <h3>Credenciais entregues</h3>
              {!deliveriesReady ? (
                <p className="sx-drawer-empty">Aplique a migração supabase/whatsapp-delivery.sql para ver as entregas.</p>
              ) : profile.credentials.length ? (
                <ul className="sx-drawer-list">
                  {profile.credentials.map((d) => (
                    <li key={d.id}>
                      <div>
                        <strong>
                          {credentialTitle(d)} · …{d.key_hint}
                        </strong>
                        <span>
                          Enviada em {fullDate(d.delivered_at)}
                          {d.expires_at ? ` · válida até ${fullDate(d.expires_at)}` : ''}
                        </span>
                        {d.confirmed_at && (
                          <span>
                            Confirmada em {shortDate(d.confirmed_at)}
                            {d.confirm_ip ? ` · IP ${d.confirm_ip}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="sx-drawer-item-actions">
                        <span className={`sx-state is-${d.state}`}>{STATE_LABELS[d.state as keyof typeof STATE_LABELS] || d.state}</span>
                        {d.state === 'pending' && whatsappButton(profile.customer, confirmationReminder({ name: profile.customer.name, hint: d.key_hint }), 'Lembrar')}
                        {['pending', 'confirmed', 'expired'].includes(d.state) && (
                          <button type="button" className="sx-btn" onClick={() => openDelivery(d.user_id, { replaces: d })}>
                            <KeyRound size={15} /> Chave nova
                          </button>
                        )}
                        {!d.revoked_at && !d.replaced_at && (
                          <button type="button" className="sx-btn is-danger" onClick={() => void revokeDelivery(d)}>
                            <X size={15} /> Revogar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sx-drawer-empty">Nenhuma credencial entregue ainda.</p>
              )}
            </section>

            <section className="sx-drawer-section">
              <h3>Pagamentos</h3>
              {profile.payments.length ? (
                <ul className="sx-drawer-list">
                  {profile.payments.slice(0, 12).map((p) => (
                    <li key={p.id}>
                      <div>
                        <strong>{money(Number(p.amount_cents || 0))}</strong>
                        <span>
                          {planNames[p.plan_code] || p.plan_code || 'Plano'} · {fullDate(p.approved_at || p.recorded_at)}
                        </span>
                      </div>
                      <span className={`sx-state ${p.status === 'approved' ? 'is-confirmed' : ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(p.status) ? 'is-expired' : 'is-pending'}`}>
                        {paymentLabels[p.status] || p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sx-drawer-empty">Nenhum pagamento no período carregado.</p>
              )}
            </section>

            {profile.trial && (
              <section className="sx-drawer-section">
                <h3>Teste grátis</h3>
                <p className="sx-drawer-empty">
                  Pedido em {fullDate(profile.trial.created_at)} ·{' '}
                  {profile.trial.revoked_at
                    ? 'revogado'
                    : Date.parse(profile.trial.expires_at) > now
                      ? `ativo até ${fullDate(profile.trial.expires_at)}`
                      : `terminou em ${fullDate(profile.trial.expires_at)}`}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      {draft && draftCustomer && (
        <div className="sx-modal-backdrop" onClick={closeDelivery}>
          <div className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="sx-modal-title" onClick={(e) => e.stopPropagation()}>
            <header>
              <span className="sx-eyebrow">entregar chave</span>
              <button type="button" className="sx-icon" onClick={closeDelivery} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            <h2 id="sx-modal-title">{delivered ? 'Chave criada.' : `Entregar chave para ${draftCustomer.name}`}</h2>
            {delivered ? (
              <div className="sx-modal-done">
                <p>
                  <Check size={16} /> A chave já está valendo e aparece no painel do cliente. Ele só precisa confirmar que recebeu a chave terminada em …{delivered.hint}.
                </p>
                {delivered.email === 'sent' && (
                  <p>
                    <Check size={16} /> Também avisamos o cliente por e-mail (sem a chave).
                  </p>
                )}
                {!delivered.deliveryId && (
                  <p>
                    <CircleAlert size={16} /> A confirmação no painel não foi registrada (aplique supabase/whatsapp-delivery.sql). A chave funciona normalmente.
                  </p>
                )}
                <pre className="sx-delivery-message">{deliveredMessage(draftCustomer, delivered)}</pre>
                <div className="sx-actions">
                  {whatsappButton(draftCustomer, deliveredMessage(draftCustomer, delivered), 'Enviar no WhatsApp do cliente')}
                  <button type="button" className="sx-btn" onClick={() => void navigator.clipboard.writeText(deliveredMessage(draftCustomer, delivered)).then(() => setNotice('Mensagem copiada.')).catch(() => window.prompt('Copie a mensagem:', deliveredMessage(draftCustomer, delivered)))}>
                    <Copy size={15} /> Copiar mensagem
                  </button>
                  <button type="button" className="sx-btn" onClick={closeDelivery}>
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveDelivery} className="sx-form">
                <p className="sx-form-who">
                  {draftCustomer.email} ·{' '}
                  <span className={draftCustomer.whatsapp ? 'sx-phone' : 'sx-phone is-missing'}>
                    {draftCustomer.whatsapp ? formatWhatsapp(draftCustomer.whatsapp) : 'sem WhatsApp'}
                  </span>{' '}
                  · {serviceStatus(draftCustomer.id)}
                </p>
                <div className="sx-form-grid">
                  <label className="is-wide">
                    Assinatura
                    <select value={draft.subscription_id} onChange={(e) => pickSubscription(e.target.value)}>
                      {userSubscriptions(draft.userId).map((s) => (
                        <option key={s.id} value={s.id}>
                          {subscriptionLabel(s)}
                        </option>
                      ))}
                      <option value="">Sem assinatura (teste grátis ou cortesia)</option>
                    </select>
                    {draftSubscription && !subscriptionActive(draftSubscription) && <small>Esta assinatura não está ativa. Confira o pagamento antes de entregar.</small>}
                  </label>
                  <label className="is-wide">
                    Válida até
                    <input type="date" value={draft.expires} onChange={(e) => setDraft({ ...draft, expires: e.target.value })} />
                    <span className="sx-quick">
                      {draftSubscription?.paid_until && subscriptionActive(draftSubscription) && (
                        <button type="button" className={draft.expires === brDate(draftSubscription.paid_until) ? 'is-on' : ''} onClick={() => setDraft({ ...draft, expires: brDate(draftSubscription.paid_until) })}>
                          Fim do plano
                        </button>
                      )}
                      {[7, 30].map((d) => (
                        <button key={d} type="button" onClick={() => setDraft({ ...draft, expires: inDays(d) })}>
                          {d} dias
                        </button>
                      ))}
                    </span>
                    <small>A chave para sozinha no fim desse dia. Depois dá para renovar ou editar no Roteador.</small>
                  </label>
                  <fieldset className="sx-delivery-models is-wide">
                    <legend>Modelos</legend>
                    {!routerModels ? (
                      <small>Carregando os modelos do Roteador…</small>
                    ) : !routerModels.length ? (
                      <small>Nenhum modelo ativo no Roteador. Cadastre o fornecedor e os modelos na aba Roteador.</small>
                    ) : (
                      <>
                        <label>
                          <input type="radio" checked={draft.all} onChange={() => setDraft({ ...draft, all: true })} /> Todos os modelos à venda ({routerModels.length})
                        </label>
                        <label>
                          <input type="radio" checked={!draft.all} onChange={() => setDraft({ ...draft, all: false })} /> Escolher
                        </label>
                        {!draft.all && (
                          <div className="sx-delivery-chips">
                            {routerModels.map((m) => (
                              <label key={m.alias}>
                                <input
                                  type="checkbox"
                                  checked={draft.models.includes(m.alias)}
                                  onChange={(e) => setDraft({ ...draft, models: e.target.checked ? [...draft.models, m.alias] : draft.models.filter((x) => x !== m.alias) })}
                                />
                                {m.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </fieldset>
                </div>
                {draftError && (
                  <p className="sx-admin-message is-error" role="alert">
                    <CircleAlert size={15} /> {draftError}
                  </p>
                )}
                <div className="sx-actions">
                  <button type="button" className="sx-btn" onClick={closeDelivery}>
                    Cancelar
                  </button>
                  <button type="submit" className="sx-btn is-primary" disabled={saving || !routerModels?.length}>
                    <KeyRound size={15} /> {saving ? 'Criando a chave…' : 'Criar chave e preparar WhatsApp'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
