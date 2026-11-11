import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Ban,
  BellRing,
  Check,
  CircleAlert,
  Clock,
  Download,
  KeyRound,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { confirmationReminder, customerGreeting, deliveryMessage, formatWhatsapp, whatsappLink } from '../lib/whatsapp'
import {
  DELIVERY_PRODUCTS,
  PRODUCT_LABELS,
  STATE_LABELS,
  deliveryState,
  isActiveDelivery,
  validBaseUrl,
  validKeyHint,
  type DeliveryProduct,
  type DeliveryRow,
} from '../lib/deliveries'
import './admin.css'

type Row = Record<string, any>

const tabs: Array<[string, string]> = [
  ['service', 'Atendimento'],
  ['users', 'Clientes'],
  ['deliveries', 'Credenciais'],
  ['subscriptions', 'Planos'],
  ['payments', 'Pagamentos'],
  ['keys', 'Chaves do gateway'],
  ['trials', 'Testes grátis'],
  ['usage', 'Consumo e falhas'],
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
  deliveries: ['customer', 'product', 'supplier', 'key_hint', 'base_url', 'model_id', 'delivered_at', 'expires_at', 'state', 'confirmed_at', 'created_by'],
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
const money = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (n: number) => n.toLocaleString('pt-BR')
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
  if (key.endsWith('_at') || ['paid_until', 'period_end'].includes(key)) return new Date(value).toLocaleString('pt-BR')
  if (typeof value === 'number') return number(value)
  return String(value)
}
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

type DeliveryDraft = {
  id: string
  user_id: string
  subscription_id: string
  replaces: string
  product: DeliveryProduct
  supplier: string
  key_hint: string
  base_url: string
  model_id: string
  expires_at: string
  notes: string
}
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
  const [draft, setDraft] = useState<DeliveryDraft | null>(null)
  const [draftCustomer, setDraftCustomer] = useState<Customer | null>(null)
  const [draftError, setDraftError] = useState('')
  const [hintNotice, setHintNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedDelivery, setSavedDelivery] = useState<DeliveryDraft | null>(null)

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

  /* ------------------------------ Filas ------------------------------ */
  const queues = useMemo(() => {
    const soon = now + 3 * 86400000
    const users = data.users || []
    const paidWaiting = users
      .map((u) => ({ user: u, subscription: activeSubscription(u.id) }))
      .filter((x) => x.subscription && (!deliveriesReady || activeDeliveries(x.user.id).length === 0))
      .sort((a, b) => String(b.subscription!.created_at).localeCompare(String(a.subscription!.created_at)))
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
  }, [data, deliveries, deliveriesByUser, subscriptionsByUser, deliveriesReady])

  const serviceStatus = (userId: string) => {
    if (activeDeliveries(userId).some((d) => d.state === 'pending')) return 'Aguardando confirmação'
    if (activeDeliveries(userId).length) return 'Credencial confirmada'
    if (activeSubscription(userId)) return deliveriesReady ? 'Pagou, aguardando entrega' : 'Plano ativo'
    return 'Sem plano ativo'
  }

  /* ------------------------- Tabelas genéricas ------------------------ */
  const enriched = useMemo<Row[]>(() => {
    if (tab === 'service') return []
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
        return {
          ...x,
          customer: label(x.user_id || sub?.user_id || client?.owner),
          plan_code: x.plan_code || sub?.plan_code,
          key: client?.key_prefix || x.client_id,
          ...(tab === 'users' ? { service_status: serviceStatus(x.id) } : {}),
        }
      })
      .filter((x) => !term || JSON.stringify(x).toLowerCase().includes(term))
  }, [data, tab, search, deliveries, usersById])

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

  /* ------------------------ Registrar entrega ------------------------ */
  function openDelivery(userId: string, options: { replaces?: Row } = {}) {
    const previous = options.replaces
    setDraftCustomer(customer(userId))
    setDraftError('')
    setHintNotice('')
    setSavedDelivery(null)
    setDraft({
      id: crypto.randomUUID(),
      user_id: userId,
      subscription_id: activeSubscription(userId)?.id || '',
      replaces: previous?.id || '',
      product: (previous?.product as DeliveryProduct) || 'claude',
      supplier: previous?.supplier || '',
      key_hint: '',
      base_url: previous?.base_url || '',
      model_id: previous?.model_id || '',
      expires_at: '',
      notes: '',
    })
  }
  const closeDelivery = () => {
    setDraft(null)
    setSavedDelivery(null)
    if (savedDelivery) setRevision((x) => x + 1)
  }
  const suggestions = (field: 'supplier' | 'base_url' | 'model_id') => [...new Set(deliveries.map((d) => d[field]).filter(Boolean))].slice(0, 12)

  async function saveDelivery(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    if (!validKeyHint(draft.key_hint)) return setDraftError('Informe o final da chave com 2 a 8 caracteres.')
    if (!validBaseUrl(draft.base_url)) return setDraftError('Informe a URL base com https://, sem parâmetros.')
    if (!draft.supplier.trim()) return setDraftError('Informe o fornecedor.')
    setSaving(true)
    setDraftError('')
    try {
      await adminAction({ action: 'register-delivery', delivery: draft })
      setSavedDelivery(draft)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Não foi possível registrar.')
    } finally {
      setSaving(false)
    }
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
      <strong>{c.name}</strong>
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
                {key !== 'service' && <small>{(key === 'deliveries' ? deliveries : data[key])?.length ?? 0}</small>}
              </button>
            ))}
          </nav>

          {tab === 'service' ? (
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
                        <strong>{planNames[subscription!.plan_code] || subscription!.plan_code}</strong>
                        <span>Pago até {shortDate(subscription!.paid_until)}</span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, customerGreeting({ name: c.name, plan: planNames[subscription!.plan_code] }))}
                        <button type="button" className="sx-btn is-primary" disabled={!deliveriesReady} onClick={() => openDelivery(user.id)}>
                          <KeyRound size={15} /> Registrar entrega
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
                          {PRODUCT_LABELS[d.product as DeliveryProduct] || d.product} · …{d.key_hint}
                        </strong>
                        <span>Enviada em {shortDate(d.delivered_at)}</span>
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
                          {PRODUCT_LABELS[d.product as DeliveryProduct] || d.product} · …{d.key_hint}
                        </strong>
                        <span className={expired ? 'is-late' : ''}>
                          {expired ? 'Venceu em' : 'Vence em'} {shortDate(d.expires_at)}
                        </span>
                      </div>
                      <div className="sx-actions">
                        {whatsappButton(c, customerGreeting({ name: c.name, plan: planOf(d.user_id) }))}
                        <button type="button" className="sx-btn is-primary" onClick={() => openDelivery(d.user_id, { replaces: d })}>
                          <RefreshCw size={15} /> Registrar rotação
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
                          {PRODUCT_LABELS[d.product as DeliveryProduct] || d.product} · …{d.key_hint}
                        </strong>
                        <span>{d.expires_at ? `Válida até ${shortDate(d.expires_at)}` : 'Sem validade registrada'}</span>
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
                        <strong>{planNames[s.plan_code] || s.plan_code}</strong>
                        <span>Iniciado em {shortDate(s.created_at)}</span>
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
                      <span>Último acesso {shortDate(u.last_sign_in_at)}</span>
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
                              {whatsappButton(customer(row.id), customerGreeting({ name: row.name, plan: planOf(row.id) }))}
                              {deliveriesReady && (
                                <button type="button" className="sx-btn" onClick={() => openDelivery(row.id)}>
                                  <KeyRound size={15} /> Entrega
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
                                  <RefreshCw size={15} /> Rotação
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

      {draft && draftCustomer && (
        <div className="sx-modal-backdrop" onClick={closeDelivery}>
          <div className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="sx-modal-title" onClick={(e) => e.stopPropagation()}>
            <header>
              <span className="sx-eyebrow">{draft.replaces ? 'rotação de credencial' : 'nova entrega'}</span>
              <button type="button" className="sx-icon" onClick={closeDelivery} aria-label="Fechar">
                <X size={18} />
              </button>
            </header>
            <h2 id="sx-modal-title">{savedDelivery ? 'Entrega registrada.' : `Registrar entrega para ${draftCustomer.name}`}</h2>
            {savedDelivery ? (
              <div className="sx-modal-done">
                <p>
                  <Check size={16} /> A credencial …{savedDelivery.key_hint} já aparece na dashboard do cliente para confirmação.
                </p>
                <p>Agora envie a chave pelo WhatsApp. A mensagem abre pronta; cole a chave no lugar indicado.</p>
                <div className="sx-actions">
                  {whatsappButton(
                    draftCustomer,
                    deliveryMessage({ name: draftCustomer.name, hint: validKeyHint(savedDelivery.key_hint) || savedDelivery.key_hint, url: validBaseUrl(savedDelivery.base_url) || savedDelivery.base_url }),
                    'Abrir WhatsApp do cliente',
                  )}
                  <button type="button" className="sx-btn" onClick={closeDelivery}>
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={saveDelivery} className="sx-form">
                <p className="sx-form-who">
                  {draftCustomer.email} · {draftCustomer.whatsapp ? formatWhatsapp(draftCustomer.whatsapp) : 'sem WhatsApp'}
                </p>
                <div className="sx-form-grid">
                  <label>
                    Produto
                    <select value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value as DeliveryProduct })}>
                      {DELIVERY_PRODUCTS.map((p) => (
                        <option key={p} value={p}>
                          {PRODUCT_LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fornecedor
                    <input
                      list="sx-suppliers"
                      maxLength={60}
                      value={draft.supplier}
                      onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
                      placeholder="Nome do fornecedor"
                      required
                    />
                    <datalist id="sx-suppliers">
                      {suggestions('supplier').map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Final da chave
                    <input
                      value={draft.key_hint}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => {
                        const value = e.target.value.trim()
                        if (value.length > 8) {
                          setDraft({ ...draft, key_hint: value.slice(-4) })
                          setHintNotice('Guardamos só os últimos 4 caracteres. A chave inteira não é salva no painel.')
                        } else {
                          setDraft({ ...draft, key_hint: value })
                          setHintNotice('')
                        }
                      }}
                      placeholder="Ex.: 9f3a"
                      required
                    />
                    <small>{hintNotice || 'Só os últimos caracteres (2 a 8). Nunca a chave inteira.'}</small>
                  </label>
                  <label>
                    Válida até
                    <input type="date" value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} />
                    <span className="sx-quick">
                      {[7, 30].map((d) => (
                        <button key={d} type="button" onClick={() => setDraft({ ...draft, expires_at: inDays(d) })}>
                          +{d} dias
                        </button>
                      ))}
                    </span>
                  </label>
                  <label className="is-wide">
                    URL base
                    <input
                      list="sx-urls"
                      value={draft.base_url}
                      onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
                      placeholder="https://api.fornecedor.com"
                      required
                    />
                    <datalist id="sx-urls">
                      {suggestions('base_url').map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Modelo (opcional)
                    <input
                      list="sx-models"
                      value={draft.model_id}
                      onChange={(e) => setDraft({ ...draft, model_id: e.target.value })}
                      placeholder="Ex.: claude-fable-5-1"
                    />
                    <datalist id="sx-models">
                      {suggestions('model_id').map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Substitui a credencial
                    <select value={draft.replaces} onChange={(e) => setDraft({ ...draft, replaces: e.target.value })}>
                      <option value="">Nenhuma (nova chave)</option>
                      {activeDeliveries(draft.user_id).map((d) => (
                        <option key={d.id} value={d.id}>
                          {PRODUCT_LABELS[d.product as DeliveryProduct] || d.product} · …{d.key_hint}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    Observação (opcional)
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      placeholder="Ex.: rotação mensal do fornecedor"
                    />
                  </label>
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
                  <button type="submit" className="sx-btn is-primary" disabled={saving}>
                    <ShieldCheck size={15} /> {saving ? 'Registrando…' : 'Registrar entrega'}
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
