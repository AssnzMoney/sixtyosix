import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Ban, Check, CircleAlert, Copy, CreditCard, Gauge, Globe, KeyRound, Layers, Pencil, Plus, RefreshCw, Search, Server, Trash2, X } from 'lucide-react'
import { ROUTER_MODEL_NAMES, suggestAlias, suggestLabel } from '../lib/routerModels'
import { adminHeaders } from '../lib/adminSession'

/**
 * Aba "Roteador" do /admin, no estilo 9router:
 * provedores (URL + key mestra), modelos vendidos e chaves manuais com validade.
 * Pagou no site, a chave nasce sozinha; vendeu no WhatsApp, a chave é criada aqui.
 */

type Row = Record<string, any>
type Provider = { id: string; name: string; base_url: string; key_hint: string; enabled: boolean; created_at: string }
type Model = { alias: string; provider_id: string; upstream_model: string; label: string; enabled: boolean; in_pro: boolean }
type RouterKey = { id: string; gateway_client_id: string; name: string; contact: string | null; token_prefix: string; models: string[] | null; expires_at: string; revoked_at: string | null; created_at: string; user_id?: string | null }
type Limits = { rpm: number | null; concurrency: number | null; max_ips?: number | null; trial_rpm?: number | null; trial_concurrency?: number | null }
type Guard = { settings: Limits; blocks: { network: string; reason: string | null; created_by: string | null; created_at: string }[]; controls: (Limits & { client_id: string })[]; ipLimit?: boolean; trialLimit?: boolean }
type Overview = { providers: Provider[]; models: Model[]; keys: RouterKey[]; guard: Guard | null }
type SeenIp = { ip: string; first_seen: string; last_seen: string; requests: number; blocked_at: string | null; accepted?: boolean; device_label?: string | null }
type EditForm = { name: string; contact: string; email: string; expires: string; all: boolean; models: string[] }
type Draft = { key: string; upstream: string; upstreamName: string; sell: boolean; alias: string; label: string; in_pro: boolean; missing: boolean }
type ProviderForm = { id?: string; name: string; base_url: string; key: string }
/** Chave de plano do site (nasce no pagamento), mostrada no filtro "Planos do site". */
type SiteKey = { id: string; subscription_id?: string; client_id: string; user_id: string; customer: string; email: string; plan: string; prefix: string; paid_until: string | null; api: boolean; state: string }
type KeyForm = { name: string; contact: string; email: string; days: string; custom: string; unit: 'dias' | 'horas'; slow: boolean; all: boolean; models: string[] }
type ReporForm = { mode: 'add' | 'remove'; days: string; search: string; filter: 'active' | 'paid' | 'all'; selectedKeys: string[]; selectedSubs: string[] }
type ManualSubForm = { keyId: string; keyName: string; email: string; plan: 'dev' | 'devApi' | 'pro' | 'enterprise'; expires: string }
const MANUAL_PLANS: Array<['dev' | 'devApi' | 'pro' | 'enterprise', string, string]> = [
  ['dev', 'Starter · R$ 249,90/mês', 'GPT Astra 6 · Sem limite de IPs'],
  ['devApi', 'Starter + API · R$ 264,90/mês', 'GPT Astra 6 + API · Sem limite de IPs'],
  ['pro', 'Pro · R$ 319,90/mês', 'Todos os modelos + Imagens · Limite de 3 IPs'],
  ['enterprise', 'Enterprise · R$ 609,90/mês', 'Todos os modelos + Imagens · Limite de 10 IPs · 100 req/min'],
]

const DAY = 86400000
const SITE = 'https://www.sixtysix.online'
const DURATIONS: Array<[string, string]> = [['h3', '3 horas (teste)'], ['1', '1 dia'], ['7', '7 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias'], ['custom', 'Outro…']]
const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const limitText = (value: string) => (value.trim() === '' ? null : Number(value))
/** AAAA-MM-DD no horário de Brasília. */
const brDay = (value: string | number) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const plusDays = (from: string, days: number) => brDay(Math.max(Date.parse(from + 'T23:59:59-03:00') || 0, Date.now()) + days * DAY)
const tokens = (value: number) => (value >= 10000 ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : value.toLocaleString('pt-BR'))

const clock = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
/** "faltam 2h 40min", "falta 1h", "faltam 25 min". */
function hoursLeft(ms: number) {
  const total = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(total / 60), m = total % 60
  if (!h) return `faltam ${m} min`
  return `${h === 1 && !m ? 'falta' : 'faltam'} ${h}h${m ? ` ${String(m).padStart(2, '0')}min` : ''}`
}

function keyState(key: RouterKey, now: number) {
  if (key.revoked_at) return { label: 'Bloqueada', tone: 'is-revoked', detail: `desde ${date(key.revoked_at)}` }
  const left = Date.parse(key.expires_at) - now
  if (left <= 0) return { label: 'Vencida', tone: 'is-expired', detail: `venceu em ${date(key.expires_at)}${left > -DAY ? ` às ${clock(key.expires_at)}` : ''}` }
  // Menos de 1 dia (ex.: teste de 3 horas): mostra o horário e as horas que faltam.
  if (left < DAY) return { label: 'Ativa', tone: 'is-pending', detail: `vence em ${date(key.expires_at)} às ${clock(key.expires_at)} · ${hoursLeft(left)}` }
  const days = Math.ceil(left / DAY)
  return { label: 'Ativa', tone: days <= 3 ? 'is-pending' : 'is-confirmed', detail: `vence em ${date(key.expires_at)} · ${days === 1 ? 'falta 1 dia' : `faltam ${days} dias`}` }
}

function Modal({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sx-modal-backdrop" onClick={onClose}>
      <div className="sx-modal sx-router-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sx-router-modal-head">
          <div>
            <span className="sx-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="sx-btn" aria-label="Fechar" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function RouterPanel({ token, usage, period, users = [], siteKeys = [], onSiteRefresh }: { token: string; usage: Row[]; period: string; users?: Row[]; siteKeys?: SiteKey[]; onSiteRefresh?: () => void }) {
  // Contas cadastradas: para ligar uma chave ao e-mail do cliente e mostrar a quem ela pertence.
  const accounts = useMemo(() => new Map(users.map((u) => [String(u.id), u])), [users])
  const accountEmail = (id?: string | null) => (id ? String(accounts.get(id)?.email || '') : '')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [working, setWorking] = useState('')
  const [search, setSearch] = useState('')
  const [providerForm, setProviderForm] = useState<ProviderForm | null>(null)
  const [modelsFor, setModelsFor] = useState<Provider | null>(null)
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [modelSearch, setModelSearch] = useState('')
  const [manualModel, setManualModel] = useState('')
  const [modalError, setModalError] = useState('')
  const [keyForm, setKeyForm] = useState<KeyForm | null>(null)
  const [created, setCreated] = useState<{ key: string; message: string } | null>(null)
  const [guardForm, setGuardForm] = useState<{ rpm: string; concurrency: string; max_ips: string; trial_rpm: string; trial_concurrency: string } | null>(null)
  const [blockForm, setBlockForm] = useState({ network: '', reason: '' })
  const [ipsFor, setIpsFor] = useState<RouterKey | null>(null)
  const [ipsData, setIpsData] = useState<{ ips: SeenIp[]; controls: Limits; ipLimit?: boolean } | null>(null)
  const [keyLimits, setKeyLimits] = useState({ rpm: '', concurrency: '', max_ips: '' })
  const [editFor, setEditFor] = useState<RouterKey | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [reporForm, setReporForm] = useState<ReporForm | null>(null)
  const [manualSubForm, setManualSubForm] = useState<ManualSubForm | null>(null)
  const now = Date.now()

  async function call<T>(body: Row): Promise<T> {
    const response = await fetch('/api/management', {
      method: 'POST',
      headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
    return result as T
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch('/api/management?resource=router', { headers: adminHeaders(token), signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o Roteador.')
        setOverview({ providers: body.providers || [], models: body.models || [], keys: body.keys || [], guard: body.guard || null })
        setError('')
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, revision])

  const reload = () => setRevision((r) => r + 1)
  async function run(id: string, task: () => Promise<string | void>) {
    setWorking(id)
    setError('')
    setNotice('')
    try {
      const message = await task()
      if (message) setNotice(message)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setWorking('')
    }
  }
  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text)
      setNotice(message)
    } catch {
      window.prompt('Copie o texto abaixo:', text)
    }
  }

  const providers = overview?.providers || []
  const models = overview?.models || []
  const providerById = useMemo(() => new Map(providers.map((p) => [p.id, p])), [providers])
  const sellable = models.filter((m) => m.enabled && providerById.get(m.provider_id)?.enabled)
  const labelOf = (alias: string) => models.find((m) => m.alias === alias)?.label || alias

  // Consumo de cada chave manual no período escolhido na aba Consumo.
  const spent = useMemo(() => {
    const totals = new Map<string, { requests: number; input: number; output: number; errors: number; last: string }>()
    for (const row of usage) {
      const t = totals.get(row.client_id) || { requests: 0, input: 0, output: 0, errors: 0, last: '' }
      t.requests++
      if (String(row.created_at || '') > t.last) t.last = String(row.created_at)
      t.input += Number(row.input_tokens || 0)
      t.output += Number(row.output_tokens || 0)
      if (Number(row.status_code) >= 400) t.errors++
      totals.set(row.client_id, t)
    }
    return totals
  }, [usage])

  // Filtro das chaves: testes (validade de poucas horas), pagas, vencidas ou bloqueadas, e os planos do site.
  const [keyFilter, setKeyFilter] = useState<'all' | 'test' | 'paid' | 'ended' | 'site'>('all')
  const isTestKey = (k: RouterKey) => {
    const life = Date.parse(k.expires_at) - Date.parse(k.created_at)
    return life > 0 && life < 23 * 3600000
  }
  const isEnded = (k: RouterKey) => Boolean(k.revoked_at) || !(Date.parse(k.expires_at) > now)
  const matches = (value: string) => !search || value.toLowerCase().includes(search.toLowerCase())
  const allKeys = (overview?.keys || []).filter((k) => matches(`${k.name} ${k.contact || ''} ${k.token_prefix} ${accountEmail(k.user_id)}`))
  const shownSiteKeys = siteKeys.filter((s) => matches(`${s.customer} ${s.email} ${s.prefix} ${s.plan}`))
  const keyCounts = { all: allKeys.length, test: allKeys.filter(isTestKey).length, paid: allKeys.filter((k) => !isTestKey(k)).length, ended: allKeys.filter(isEnded).length, site: shownSiteKeys.length }
  const keys = allKeys.filter((k) => (keyFilter === 'test' ? isTestKey(k) : keyFilter === 'paid' ? !isTestKey(k) : keyFilter === 'ended' ? isEnded(k) : true))

  /* ----------------------------- Provedores ----------------------------- */
  async function saveProvider() {
    if (!providerForm) return
    setModalError('')
    setWorking('provider-form')
    try {
      const result = await call<{ id: string }>({ action: 'router-provider-save', ...providerForm })
      const isNew = !providerForm.id
      setProviderForm(null)
      setNotice(isNew ? 'Provedor salvo. Agora escolha os modelos que você vai vender.' : 'Provedor atualizado.')
      reload()
      if (isNew) openModels({ id: result.id, name: providerForm.name, base_url: providerForm.base_url, key_hint: '', enabled: true, created_at: '' })
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setWorking('')
    }
  }

  async function openModels(provider: Provider) {
    setModelsFor(provider)
    setDrafts(null)
    setModalError('')
    setModelSearch('')
    const saved = models.filter((m) => m.provider_id === provider.id)
    let offered: { id: string; name: string }[] = []
    try {
      offered = (await call<{ models: { id: string; name: string }[] }>({ action: 'router-provider-models', id: provider.id })).models
    } catch (e) {
      setModalError(`${e instanceof Error ? e.message : 'O provedor não respondeu.'} Os modelos já cadastrados continuam abaixo.`)
    }
    const list: Draft[] = offered.map((item) => {
      const current = saved.find((m) => m.upstream_model === item.id)
      const alias = current?.alias || suggestAlias(item.id)
      return { key: current ? 'saved:' + current.alias : 'offer:' + item.id, upstream: item.id, upstreamName: item.name, sell: Boolean(current), alias, label: current?.label || suggestLabel(alias, item.name), in_pro: current?.in_pro ?? true, missing: false }
    })
    // Nomes salvos que ainda não estão na lista: outros nomes do mesmo modelo, ou modelos que sumiram do provedor.
    for (const m of saved)
      if (!list.some((d) => d.sell && d.alias === m.alias))
        list.push({ key: 'saved:' + m.alias, upstream: m.upstream_model, upstreamName: '', sell: true, alias: m.alias, label: m.label, in_pro: m.in_pro, missing: offered.length > 0 && !offered.some((o) => o.id === m.upstream_model) })
    setDrafts(list)
  }

  async function saveModels() {
    if (!modelsFor || !drafts) return
    setModalError('')
    setWorking('models')
    try {
      const chosen = drafts.filter((d) => d.sell)
      await call({ action: 'router-models-save', provider_id: modelsFor.id, models: chosen.map((d) => ({ alias: d.alias, upstream_model: d.upstream, label: d.label, enabled: true, in_pro: d.in_pro })) })
      setModelsFor(null)
      setNotice(`${chosen.length} ${chosen.length === 1 ? 'modelo à venda' : 'modelos à venda'} em ${modelsFor.name}. Vale para novas chamadas em até 30 segundos.`)
      reload()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setWorking('')
    }
  }
  const editDraft = (key: string, change: Partial<Draft>) => setDrafts((list) => list && list.map((d) => (d.key === key ? { ...d, ...change } : d)))
  /** Cria uma segunda linha para vender o mesmo modelo do provedor com outro nome (ex.: Argon vendido também como Claude Opus). */
  function duplicateDraft(item: Draft) {
    setDrafts((list) => {
      if (!list) return list
      const used = new Set(list.filter((d) => d.sell).map((d) => d.alias))
      const alias = !used.has('claude-opus-5-5') ? 'claude-opus-5-5' : !used.has('claude-opus') ? 'claude-opus' : ''
      const copy: Draft = { key: 'dup:' + Date.now() + ':' + Math.random().toString(36).slice(2, 6), upstream: item.upstream, upstreamName: item.upstreamName, sell: true, alias, label: alias ? suggestLabel(alias, '') : 'Claude Opus', in_pro: item.in_pro, missing: item.missing }
      const index = list.findIndex((d) => d.key === item.key)
      const next = [...list]
      next.splice(index + 1, 0, copy)
      return next
    })
  }
  /** Modelo digitado à mão (o provedor não listou, ou um segundo nome para o mesmo modelo). */
  function addManualModel() {
    const upstream = manualModel.trim()
    if (!upstream) return
    const alias = suggestAlias(upstream)
    setDrafts((list) => [{ key: 'manual:' + Date.now(), upstream, upstreamName: '', sell: true, alias, label: suggestLabel(alias, ''), in_pro: true, missing: false }, ...(list || [])])
    setManualModel('')
  }

  /* ------------------------------- Chaves ------------------------------- */
  async function createKey() {
    if (!keyForm) return
    setModalError('')
    const inHours = keyForm.days === 'h3' || (keyForm.days === 'custom' && keyForm.unit === 'horas')
    const amount = keyForm.days === 'h3' ? 3 : Number(keyForm.days === 'custom' ? keyForm.custom : keyForm.days)
    if (!keyForm.name.trim()) return setModalError('Dê um nome para a chave (ex.: nome do cliente).')
    if (inHours && (!Number.isInteger(amount) || amount < 1 || amount > 720)) return setModalError('Escolha uma validade entre 1 e 720 horas.')
    if (!inHours && (!Number.isInteger(amount) || amount < 1 || amount > 366)) return setModalError('Escolha uma validade entre 1 e 366 dias.')
    const days = inHours ? 0 : amount
    if (!keyForm.all && !keyForm.models.length) return setModalError('Escolha pelo menos um modelo.')
    setWorking('key-form')
    try {
      const result = await call<{ key: string; row: RouterKey }>({ action: 'router-key-create', name: keyForm.name, contact: keyForm.contact, ...(inHours ? { hours: amount } : { days }), slow: keyForm.slow, models: keyForm.all ? null : keyForm.models })
      const list = (keyForm.all ? sellable.map((m) => m.alias) : keyForm.models).map(labelOf).join(', ')
      const expires = result.row?.expires_at ? (inHours ? `${date(result.row.expires_at)} às ${new Date(result.row.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : date(result.row.expires_at)) : inHours ? `${amount} horas` : `${days} dias`
      setCreated({
        key: result.key,
        message: [
          `Olá, ${keyForm.name.trim()}! Seu acesso SixtySix está liberado.`,
          '',
          `Chave: ${result.key}`,
          `Endereço (Claude Code): ${SITE}`,
          `Endereço (Codex, Cline, OpenCode e apps compatíveis com OpenAI): ${SITE}/v1`,
          `Modelos: ${list}`,
          `Válida até: ${expires}`,
        ].join('\n'),
      })
      // Conta do cliente: a chave e o consumo aparecem no painel dele.
      if (keyForm.email.trim() && result.row?.id) {
        try {
          await call({ action: 'router-key-link', id: result.row.id, email: keyForm.email })
          setNotice(`Chave criada e ligada à conta ${keyForm.email.trim()}.`)
        } catch (e) {
          setError(`A chave foi criada, mas não deu para ligar à conta: ${e instanceof Error ? e.message : 'tente em Editar'}`)
        }
      }
      setKeyForm(null)
      reload()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível criar a chave.')
    } finally {
      setWorking('')
    }
  }

  /* ------------------------ Proteção e IPs ------------------------ */
  const guard = overview?.guard || null
  const settings = guard?.settings || { rpm: null, concurrency: null }
  const customLimits = useMemo(() => new Map((guard?.controls || []).map((c) => [c.client_id, c])), [guard])
  const asText = (value: number | null | undefined) => (value == null ? '' : String(value))
  const form = guardForm || { rpm: asText(settings.rpm), concurrency: asText(settings.concurrency), max_ips: asText(settings.max_ips), trial_rpm: asText(settings.trial_rpm), trial_concurrency: asText(settings.trial_concurrency) }

  async function saveGuard() {
    await run('guard', async () => {
      await call({ action: 'router-guard-save', rpm: limitText(form.rpm), concurrency: limitText(form.concurrency), ...(guard?.ipLimit ? { max_ips: limitText(form.max_ips) } : {}), ...(guard?.trialLimit ? { trial_rpm: limitText(form.trial_rpm), trial_concurrency: limitText(form.trial_concurrency) } : {}) })
      setGuardForm(null)
      return 'Proteção salva. Vale para novas chamadas na hora.'
    })
  }
  async function blockNetwork(network: string, blocked: boolean, reason = '') {
    await run('network:' + network, async () => {
      await call({ action: 'router-network-block', network, blocked, reason })
      if (blocked) setBlockForm({ network: '', reason: '' })
      return blocked ? `${network} bloqueado em todas as chaves.` : `${network} liberado.`
    })
  }
  async function openIps(key: RouterKey) {
    setIpsFor(key)
    setIpsData(null)
    setModalError('')
    try {
      const data = await call<{ ips: SeenIp[]; controls: Limits; ipLimit?: boolean }>({ action: 'router-key-ips', client_id: key.gateway_client_id })
      setIpsData(data)
      setKeyLimits({ rpm: asText(data.controls.rpm), concurrency: asText(data.controls.concurrency), max_ips: asText(data.controls.max_ips) })
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível carregar os IPs.')
    }
  }
  async function setIpBlocked(ip: string, blocked: boolean) {
    if (!ipsFor) return
    setModalError('')
    setWorking('ip:' + ip)
    try {
      await call({ action: 'router-key-ip-block', client_id: ipsFor.gateway_client_id, ip, blocked })
      setIpsData((d) => d && { ...d, ips: d.ips.map((x) => (x.ip === ip ? { ...x, blocked_at: blocked ? new Date().toISOString() : null } : x)) })
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setWorking('')
    }
  }
  async function saveKeyLimits() {
    if (!ipsFor) return
    setModalError('')
    setWorking('key-limits')
    try {
      await call({ action: 'router-key-limits', client_id: ipsFor.gateway_client_id, rpm: limitText(keyLimits.rpm), concurrency: limitText(keyLimits.concurrency), ...(ipsData?.ipLimit ? { max_ips: limitText(keyLimits.max_ips) } : {}) })
      setNotice(`Limite da chave de ${ipsFor.name} salvo.`)
      reload()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setWorking('')
    }
  }

  async function ipAction(ip: string, action: 'router-key-ip-accept' | 'router-key-ip-remove') {
    if (!ipsFor) return
    setModalError('')
    setWorking('ip:' + ip)
    try {
      await call({ action, client_id: ipsFor.gateway_client_id, ip })
      setIpsData((d) => d && { ...d, ips: action === 'router-key-ip-remove' ? d.ips.filter((x) => x.ip !== ip) : d.ips.map((x) => (x.ip === ip ? { ...x, accepted: true, blocked_at: null } : x)) })
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível concluir.')
    } finally {
      setWorking('')
    }
  }

  /* ---------------------------- Editar chave ---------------------------- */
  function openEdit(key: RouterKey) {
    setModalError('')
    setEditFor(key)
    setEditForm({ name: key.name, contact: key.contact || '', email: accountEmail(key.user_id), expires: brDay(key.expires_at), all: !key.models, models: key.models || [] })
  }
  async function saveEdit() {
    if (!editFor || !editForm) return
    setModalError('')
    if (!editForm.name.trim()) return setModalError('Dê um nome para a chave.')
    if (!editForm.all && !editForm.models.length) return setModalError('Escolha pelo menos um modelo.')
    setWorking('edit')
    try {
      await call({ action: 'router-key-update', id: editFor.id, name: editForm.name, contact: editForm.contact, expires_at: editForm.expires === brDay(editFor.expires_at) ? editFor.expires_at : editForm.expires, models: editForm.all ? null : editForm.models })
      // Só mexe no vínculo se o e-mail do campo mudou.
      const email = editForm.email.trim().toLowerCase()
      if (email !== accountEmail(editFor.user_id).toLowerCase()) {
        await call({ action: 'router-key-link', id: editFor.id, email })
        setNotice(email ? `Chave de ${editForm.name.trim()} atualizada e ligada à conta ${email}.` : `Chave de ${editForm.name.trim()} atualizada e desligada da conta do cliente.`)
      } else setNotice(`Chave de ${editForm.name.trim()} atualizada.`)
      setEditFor(null)
      reload()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setWorking('')
    }
  }

  /* ----------------- Assinatura fora do site / Trocar plano ----------------- */
  function openManualSub(key?: RouterKey) {
    setModalError('')
    const defaultExpires = key && Date.parse(key.expires_at) > Date.now() ? brDay(key.expires_at) : plusDays(brDay(Date.now()), 30)
    const currentLimits = key ? customLimits.get(key.gateway_client_id) : undefined
    const guessedPlan: 'dev' | 'devApi' | 'pro' | 'enterprise' = currentLimits?.max_ips === 10 ? 'enterprise' : key?.models && key.models.length === 1 ? 'devApi' : 'pro'
    setManualSubForm({
      keyId: key?.id || '',
      keyName: key?.name || '',
      email: key ? accountEmail(key.user_id) : '',
      plan: guessedPlan,
      expires: defaultExpires,
    })
  }

  async function saveManualSub() {
    if (!manualSubForm) return
    setModalError('')
    if (!manualSubForm.keyId && !manualSubForm.email.trim()) {
      return setModalError('Escolha uma chave ativa ou informe o e-mail da conta do cliente.')
    }
    setWorking('manual-sub')
    try {
      const result = await call<{ plan: string; paid_until: string; keysUpdated: number }>({
        action: 'manual-subscription',
        key_id: manualSubForm.keyId || undefined,
        email: manualSubForm.email.trim() || undefined,
        plan: manualSubForm.plan,
        expires: manualSubForm.expires,
      })
      setManualSubForm(null)
      setNotice(`Plano ${result.plan} aplicado até ${date(result.paid_until)} (${result.keysUpdated} ${result.keysUpdated === 1 ? 'chave configurada' : 'chaves configuradas'}).`)
      reload()
      onSiteRefresh?.()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível salvar a assinatura.')
    } finally {
      setWorking('')
    }
  }

  /* ----------------------------- Repor dias ---------------------------- */
  // Começa sem ninguém marcado: antes vinham todos os ativos marcados e os dias iam para quem não devia.
  function openRepor(mode: 'add' | 'remove' = 'add') {
    setModalError('')
    setReporForm({ mode, days: '1', search: '', filter: 'active', selectedKeys: [], selectedSubs: [] })
  }

  async function saveRepor() {
    if (!reporForm) return
    setModalError('')
    const days = Number(reporForm.days)
    const removing = reporForm.mode === 'remove'
    if (!Number.isInteger(days) || days < 1 || days > 366) return setModalError(`Escolha entre 1 e 366 dias para ${removing ? 'remover' : 'repor'}.`)
    const count = reporForm.selectedKeys.length + reporForm.selectedSubs.length
    if (!count) return setModalError('Selecione pelo menos um assinante.')
    if (removing && !window.confirm(`Tirar ${days} ${days === 1 ? 'dia' : 'dias'} de ${count} ${count === 1 ? 'assinante' : 'assinantes'}? O vencimento nunca fica antes de agora.`)) return
    setWorking('repor')
    try {
      const result = await call<{ total: number }>({
        action: removing ? 'router-keys-remover' : 'router-keys-repor',
        days,
        key_ids: reporForm.selectedKeys,
        subscription_ids: reporForm.selectedSubs,
      })
      setReporForm(null)
      setNotice(removing
        ? `-${days} ${days === 1 ? 'dia removido' : 'dias removidos'} de ${result.total} ${result.total === 1 ? 'assinante' : 'assinantes'}.`
        : `+${days} ${days === 1 ? 'dia reposto' : 'dias repostos'} para ${result.total} ${result.total === 1 ? 'assinante' : 'assinantes'}.`)
      reload()
      onSiteRefresh?.()
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Não foi possível repor os dias.')
    } finally {
      setWorking('')
    }
  }

  /* ------------------------------- Tela -------------------------------- */
  return (
    <div className="sx-router">
      <datalist id="sx-router-accounts">
        {users.filter((u) => u.email).map((u) => (
          <option key={u.id} value={u.email}>{u.name || u.email}</option>
        ))}
      </datalist>
      <div className="sx-router-intro">
        <div>
          <h2>Roteador</h2>
          <p>Seus provedores, os modelos que você vende e as chaves criadas na mão. Pagou no site, a chave nasce sozinha; vendeu no WhatsApp, crie aqui.</p>
        </div>
        <button type="button" className="sx-btn" onClick={reload} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'sx-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="sx-admin-message is-error">
          <CircleAlert size={16} /> {error}
        </p>
      )}
      {notice && <p className="sx-admin-message">{notice}</p>}

      <div className="sx-router-endpoints">
        <span>Endereço para os clientes</span>
        <button type="button" onClick={() => copy(SITE, 'Endereço do Claude Code copiado.')}>
          <code>{SITE}</code> <small>Claude Code</small> <Copy size={13} />
        </button>
        <button type="button" onClick={() => copy(`${SITE}/v1`, 'Endereço OpenAI copiado.')}>
          <code>{SITE}/v1</code> <small>Codex, Cline, OpenCode</small> <Copy size={13} />
        </button>
      </div>

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <Server size={17} /> Provedores
          </h3>
          <button type="button" className="sx-btn is-primary" onClick={() => { setModalError(''); setProviderForm({ name: '', base_url: '', key: '' }) }}>
            <Plus size={15} /> Adicionar provedor
          </button>
        </div>
        {!providers.length ? (
          <p className="sx-admin-empty">{loading ? 'Carregando…' : 'Nenhum provedor ainda. Adicione a URL e a API key que você recebeu do fornecedor.'}</p>
        ) : (
          <ul className="sx-router-list">
            {providers.map((p) => {
              const count = models.filter((m) => m.provider_id === p.id && m.enabled).length
              return (
                <li key={p.id}>
                  <div className="sx-router-main">
                    <strong>{p.name}</strong>
                    <span>
                      {p.base_url} · key {p.key_hint}
                    </span>
                  </div>
                  <span className={`sx-state ${p.enabled ? 'is-confirmed' : 'is-revoked'}`}>{p.enabled ? 'Ligado' : 'Desligado'}</span>
                  <span className="sx-router-count">{count === 1 ? '1 modelo à venda' : `${count} modelos à venda`}</span>
                  <div className="sx-actions">
                    <button type="button" className="sx-btn" onClick={() => openModels(p)}>
                      <Layers size={15} /> Modelos
                    </button>
                    <button type="button" className="sx-btn" onClick={() => { setModalError(''); setProviderForm({ id: p.id, name: p.name, base_url: p.base_url, key: '' }) }}>
                      <Pencil size={15} /> Editar
                    </button>
                    <button
                      type="button"
                      className="sx-btn"
                      disabled={working === p.id}
                      onClick={() => run(p.id, async () => { await call({ action: 'router-provider-enabled', id: p.id, enabled: !p.enabled }); return p.enabled ? `${p.name} desligado. Os modelos dele param de responder.` : `${p.name} ligado.` })}
                    >
                      {p.enabled ? <Ban size={15} /> : <Check size={15} />} {p.enabled ? 'Desligar' : 'Ligar'}
                    </button>
                    <button
                      type="button"
                      className="sx-btn is-danger"
                      aria-label={`Excluir ${p.name}`}
                      disabled={working === p.id}
                      onClick={() => {
                        if (!window.confirm(`Excluir o provedor ${p.name}? Os modelos dele deixam de ser vendidos na hora.`)) return
                        run(p.id, async () => { await call({ action: 'router-provider-delete', id: p.id }); return `${p.name} excluído.` })
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

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <Gauge size={17} /> Proteção contra sobrecarga
          </h3>
        </div>
        {!guard ? (
          <p className="sx-admin-empty">
            {loading ? 'Carregando…' : 'Aplique a migração supabase/gateway-guard.sql no Supabase para ligar a proteção e o controle de IP.'}
          </p>
        ) : (
          <div className="sx-router-guard">
            <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); saveGuard() }}>
              <label>
                Chamadas por minuto, por chave
                <input type="number" min={1} max={100000} inputMode="numeric" placeholder="Sem limite" value={form.rpm} onChange={(e) => setGuardForm({ ...form, rpm: e.target.value })} />
                <small>Passou disso, a chave espera alguns segundos antes da próxima.</small>
              </label>
              <label>
                Respostas ao mesmo tempo, por chave
                <input type="number" min={1} max={1000} inputMode="numeric" placeholder="Sem limite" value={form.concurrency} onChange={(e) => setGuardForm({ ...form, concurrency: e.target.value })} />
                <small>Evita que uma chave sozinha ocupe o fornecedor.</small>
              </label>
              <label>
                Máximo de IPs por chave
                <input type="number" min={1} max={100} inputMode="numeric" placeholder="Sem limite" disabled={!guard.ipLimit} value={form.max_ips} onChange={(e) => setGuardForm({ ...form, max_ips: e.target.value })} />
                <small>{guard.ipLimit ? 'Passou disso, o IP novo fica aguardando você aceitar. IP parado há 7 dias libera a vaga.' : 'Aplique supabase/gateway-guard-ips.sql no Supabase para ligar.'}</small>
              </label>
              <label>
                Teste grátis: chamadas por minuto
                <input type="number" min={1} max={100000} inputMode="numeric" placeholder="Sem limite" disabled={!guard.trialLimit} value={form.trial_rpm} onChange={(e) => setGuardForm({ ...form, trial_rpm: e.target.value })} />
                <small>{guard.trialLimit ? 'Mais lento que os pagantes. Vale para as próximas chaves marcadas como teste; numa chave já criada, ajuste em Detalhes.' : 'Aplique supabase/trial-3h.sql no Supabase para ligar.'}</small>
              </label>
              <label>
                Teste grátis: respostas ao mesmo tempo
                <input type="number" min={1} max={1000} inputMode="numeric" placeholder="Sem limite" disabled={!guard.trialLimit} value={form.trial_concurrency} onChange={(e) => setGuardForm({ ...form, trial_concurrency: e.target.value })} />
                <small>Crie a chave de teste em Nova chave → "3 horas (teste)".</small>
              </label>
              <div className="sx-router-modal-actions is-wide">
                <button type="submit" className="sx-btn is-primary" disabled={working === 'guard' || !guardForm}>
                  {working === 'guard' ? 'Salvando…' : 'Salvar padrões'}
                </button>
              </div>
            </form>
            <p className="sx-admin-hint sx-router-note">
              Não existe limite diário: o cliente usa quanto quiser. Quem passa do ritmo recebe "aguarde um instante" com o tempo de espera, e o Claude Code e o Codex tentam de novo sozinhos. Fica mais lento, não bloqueia. Para uma chave específica, use o botão Detalhes.
            </p>

            <div className="sx-router-blocks">
              <h4>
                <Globe size={15} /> IPs bloqueados em todas as chaves
              </h4>
              <form className="sx-router-block-form" onSubmit={(e) => { e.preventDefault(); blockNetwork(blockForm.network.trim(), true, blockForm.reason) }}>
                <input aria-label="IP ou faixa" placeholder="IP ou faixa (ex.: 177.10.20.30 ou 177.10.20.0/24)" spellCheck={false} value={blockForm.network} onChange={(e) => setBlockForm({ ...blockForm, network: e.target.value })} />
                <input aria-label="Motivo" placeholder="Motivo (opcional)" maxLength={200} value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} />
                <button type="submit" className="sx-btn is-danger" disabled={!blockForm.network.trim() || working.startsWith('network:')}>
                  <Ban size={15} /> Bloquear
                </button>
              </form>
              {!guard.blocks.length ? (
                <p className="sx-router-sub">Nenhum IP bloqueado.</p>
              ) : (
                <ul className="sx-router-list">
                  {guard.blocks.map((b) => (
                    <li key={b.network}>
                      <div className="sx-router-main">
                        <strong>
                          <code>{b.network}</code>
                        </strong>
                        <span>
                          {b.reason || 'Sem motivo'} · {date(b.created_at)}
                          {b.created_by ? ` · ${b.created_by}` : ''}
                        </span>
                      </div>
                      <div className="sx-actions">
                        <button type="button" className="sx-btn" disabled={working === 'network:' + b.network} onClick={() => blockNetwork(b.network, false)}>
                          <Check size={15} /> Liberar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <KeyRound size={17} /> Chaves
          </h3>
          <div className="sx-actions">
            <label className="sx-search">
              <Search size={16} />
              <input aria-label="Buscar chave" placeholder="Busque cliente ou chave…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <button
              type="button"
              className="sx-btn"
              disabled={!(overview?.keys?.length || siteKeys.length)}
              onClick={() => openRepor('add')}
            >
              <RefreshCw size={15} /> Repor dias
            </button>
            <button
              type="button"
              className="sx-btn is-danger"
              disabled={!(overview?.keys?.length || siteKeys.length)}
              onClick={() => openRepor('remove')}
            >
              <Ban size={15} /> Remover dias
            </button>
            <button
              type="button"
              className="sx-btn"
              onClick={() => openManualSub()}
            >
              <CreditCard size={15} /> Assinatura fora do site
            </button>
            <button
              type="button"
              className="sx-btn is-primary"
              disabled={!sellable.length}
              title={sellable.length ? undefined : 'Cadastre um provedor e escolha os modelos primeiro.'}
              onClick={() => { setModalError(''); setKeyForm({ name: '', contact: '', email: '', days: '30', custom: '', unit: 'dias', slow: false, all: true, models: [] }) }}
            >
              <Plus size={15} /> Nova chave
            </button>
          </div>
        </div>
        <div className="sx-quick sx-router-filter" role="group" aria-label="Filtrar chaves">
          {([['all', 'Todas'], ['test', 'Testes'], ['paid', 'Pagas'], ['ended', 'Vencidas ou bloqueadas'], ['site', 'Planos do site']] as const).map(([value, label]) => (
            <button key={value} type="button" className={keyFilter === value ? 'is-on' : ''} aria-pressed={keyFilter === value} onClick={() => setKeyFilter(value)}>
              {label} ({keyCounts[value]})
            </button>
          ))}
        </div>
        {keyFilter === 'site' ? (
          !shownSiteKeys.length ? (
            <p className="sx-admin-empty">{search ? 'Nenhuma chave encontrada.' : 'Nenhuma chave de plano do site ainda.'}</p>
          ) : (
            <div className="sx-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Chave</th>
                    <th>Plano</th>
                    <th>Situação</th>
                    <th>Consumo ({period})</th>
                  </tr>
                </thead>
                <tbody>
                  {shownSiteKeys.map((s) => {
                    const use = spent.get(s.client_id)
                    // Chaves do Roteador ligadas à mesma conta: quem recebeu a chave pelo WhatsApp usa essa, não a do plano.
                    const routerKeys = s.user_id ? (overview?.keys || []).filter((k) => k.user_id === s.user_id) : []
                    const routerUse = routerKeys.reduce(
                      (t, k) => {
                        const u = spent.get(k.gateway_client_id)
                        return u ? { requests: t.requests + u.requests, tokens: t.tokens + u.input + u.output } : t
                      },
                      { requests: 0, tokens: 0 },
                    )
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.customer}</strong>
                          {s.email && <small className="sx-router-sub">{s.email}</small>}
                        </td>
                        <td>
                          <code>{s.prefix}…</code>
                        </td>
                        <td>
                          {s.plan}
                          {!s.api && <small className="sx-router-sub">Só no site, sem API</small>}
                        </td>
                        <td>
                          <span className={`sx-state ${s.state === 'Ativa' ? 'is-confirmed' : 'is-expired'}`}>{s.state}</span>
                          {s.paid_until && <small className="sx-router-sub">vence em {date(s.paid_until)}</small>}
                        </td>
                        <td>
                          {use ? (
                            <>
                              {tokens(use.input + use.output)} tokens
                              <small className="sx-router-sub">
                                {use.requests} chamadas{use.errors ? ` · ${use.errors} com erro` : ''}
                              </small>
                            </>
                          ) : (
                            <span className="sx-router-sub">Sem uso nesta chave</span>
                          )}
                          {routerKeys.length > 0 && (
                            <small className="sx-router-sub is-linked">
                              Usa a chave do Roteador {routerKeys.map((k) => `${k.token_prefix}…`).join(', ')}
                              {routerUse.requests ? `: ${tokens(routerUse.tokens)} tokens em ${routerUse.requests} chamadas` : ', ainda sem uso'}
                            </small>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : !keys.length ? (
          <p className="sx-admin-empty">
            {loading ? 'Carregando…' : search || keyFilter !== 'all' ? 'Nenhuma chave neste filtro.' : 'Nenhuma chave criada na mão ainda.'}
          </p>
        ) : (
          <div className="sx-admin-table">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Chave</th>
                  <th>Situação</th>
                  <th>Modelos</th>
                  <th>Consumo ({period})</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const state = keyState(k, now)
                  const use = spent.get(k.gateway_client_id)
                  const blocked = Boolean(k.revoked_at)
                  return (
                    <tr key={k.id}>
                      <td>
                        <strong>{k.name}</strong>
                        {k.contact && <small className="sx-router-sub">{k.contact}</small>}
                        {k.user_id && <small className="sx-router-sub is-linked">Conta: {accountEmail(k.user_id) || 'cliente cadastrado'}</small>}
                      </td>
                      <td>
                        <code>{k.token_prefix}…</code>
                      </td>
                      <td>
                        <span className={`sx-state ${state.tone}`}>{state.label}</span>
                        <small className="sx-router-sub">{state.detail}</small>
                        {customLimits.has(k.gateway_client_id) && (
                          <small className="sx-router-sub">
                            Limite próprio: {customLimits.get(k.gateway_client_id)?.rpm ?? 'padrão'}/min · {customLimits.get(k.gateway_client_id)?.concurrency ?? 'padrão'} ao mesmo tempo
                          </small>
                        )}
                      </td>
                      <td title={k.models ? k.models.map(labelOf).join(', ') : undefined}>{k.models ? (k.models.length === 1 ? labelOf(k.models[0]) : `${k.models.length} modelos`) : 'Todos'}</td>
                      <td>
                        {use ? (
                          <>
                            {tokens(use.input + use.output)} tokens
                            <small className="sx-router-sub">
                              {use.requests} chamadas{use.errors ? ` · ${use.errors} com erro` : ''}
                            </small>
                          </>
                        ) : (
                          <span className="sx-router-sub">Sem uso</span>
                        )}
                      </td>
                      <td>
                        <div className="sx-actions">
                          <button
                            type="button"
                            className="sx-btn"
                            disabled={working === k.id}
                            onClick={() => run(k.id, async () => {
                              const result = await call<{ row: RouterKey }>({ action: 'router-key-renew', id: k.id, days: 30 })
                              return `Chave de ${k.name} renovada até ${result.row?.expires_at ? date(result.row.expires_at) : '+30 dias'}.`
                            })}
                          >
                            <RefreshCw size={15} /> +30 dias
                          </button>
                          <button type="button" className="sx-btn" title="Definir ou alterar o plano desta chave (Starter, Pro ou Enterprise)" onClick={() => openManualSub(k)}>
                            <CreditCard size={15} /> Plano
                          </button>
                          <button type="button" className="sx-btn" onClick={() => openEdit(k)}>
                            <Pencil size={15} /> Editar
                          </button>
                          <button type="button" className="sx-btn" disabled={!guard} title={guard ? 'Consumo, limites e IPs desta chave' : 'Aplique supabase/gateway-guard.sql'} onClick={() => openIps(k)}>
                            <Globe size={15} /> Detalhes
                          </button>
                          <button
                            type="button"
                            className="sx-btn"
                            aria-label={`Copiar a chave de ${k.name}`}
                            disabled={working === k.id}
                            onClick={() => run(k.id, async () => {
                              const result = await call<{ key: string }>({ action: 'router-key-reveal', id: k.id })
                              await copy(result.key, `Chave de ${k.name} copiada.`)
                            })}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className={`sx-btn ${blocked ? '' : 'is-danger'}`}
                            disabled={working === k.id}
                            onClick={() => {
                              if (!blocked && !window.confirm(`Bloquear a chave de ${k.name}? Ela para de funcionar na hora.`)) return
                              run(k.id, async () => { await call({ action: 'router-key-block', id: k.id, blocked: !blocked }); return blocked ? `Chave de ${k.name} desbloqueada.` : `Chave de ${k.name} bloqueada.` })
                            }}
                          >
                            {blocked ? <Check size={15} /> : <Ban size={15} />} {blocked ? 'Desbloquear' : 'Bloquear'}
                          </button>
                          <button
                            type="button"
                            className="sx-btn is-danger"
                            aria-label={`Apagar a chave de ${k.name}`}
                            title="Apagar chave"
                            disabled={working === k.id}
                            onClick={() => {
                              if (!window.confirm(`Apagar a chave de ${k.name}?

Ela para de funcionar na hora e some da lista. Não dá para desfazer.`)) return
                              run(k.id, async () => { await call({ action: 'router-key-delete', id: k.id }); return `Chave de ${k.name} apagada.` })
                            }}
                          >
                            <Trash2 size={15} /> Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="sx-admin-hint sx-router-note">
          {keyFilter === 'site'
            ? 'Estas chaves nascem sozinhas quando o cliente paga no site e seguem a validade do plano (aba Planos).'
            : 'Venceu, a chave para sozinha. "+30 dias" soma a partir do vencimento (ou de hoje, se já venceu) e reativa a chave. Teste = chave de poucas horas.'}
        </p>
      </section>

      {providerForm && (
        <Modal eyebrow="Provedor" title={providerForm.id ? `Editar ${providerForm.name}` : 'Adicionar provedor'} onClose={() => setProviderForm(null)}>
          <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); saveProvider() }}>
            <label>
              Nome
              <input value={providerForm.name} maxLength={60} placeholder="Ex.: Provedor principal" onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })} />
            </label>
            <label>
              URL base
              <input value={providerForm.base_url} placeholder="https://api.exemplo.com/v1" spellCheck={false} onChange={(e) => setProviderForm({ ...providerForm, base_url: e.target.value })} />
            </label>
            <label className="is-wide">
              API keys
              <textarea
                rows={3}
                autoComplete="off"
                spellCheck={false}
                style={{ fontFamily: 'DM Mono, monospace', WebkitTextSecurity: 'disc' } as React.CSSProperties}
                value={providerForm.key}
                placeholder={providerForm.id ? 'Deixe em branco para manter as atuais' : 'Cole a key que você recebeu (uma por linha)'}
                onChange={(e) => setProviderForm({ ...providerForm, key: e.target.value })}
              />
              <small>
                Mais de uma key (uma por linha) aumenta o limite de chamadas: o gateway reveza entre elas e, se uma estiver no limite, usa a próxima.
                Ficam guardadas criptografadas no Supabase. Ao salvar, as keys novas substituem todas as anteriores.
              </small>
            </label>
            {modalError && (
              <p role="alert" className="sx-admin-message is-error is-wide">
                <CircleAlert size={16} /> {modalError}
              </p>
            )}
            <div className="sx-router-modal-actions is-wide">
              <button type="button" className="sx-btn" onClick={() => setProviderForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="sx-btn is-primary" disabled={working === 'provider-form'}>
                {working === 'provider-form' ? 'Salvando…' : providerForm.id ? 'Salvar' : 'Salvar e escolher modelos'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modelsFor && (
        <Modal eyebrow={modelsFor.name} title="Modelos à venda" onClose={() => setModelsFor(null)}>
          <p className="sx-router-help">
            Marque o que você vende. O cliente usa o <strong>nome para o cliente</strong>, nunca o nome do provedor. "Pro e teste" coloca o modelo no plano Pro e no teste grátis do site.
          </p>
          {modalError && (
            <p role="alert" className="sx-admin-message is-error">
              <CircleAlert size={16} /> {modalError}
            </p>
          )}
          <form className="sx-router-manual" onSubmit={(e) => { e.preventDefault(); addManualModel() }}>
            <input
              aria-label="Modelo no provedor"
              placeholder="Digite o ID do modelo no provedor (ex.: anthropic/claude-opus-5-5)"
              spellCheck={false}
              value={manualModel}
              onChange={(e) => setManualModel(e.target.value)}
            />
            <button type="submit" className="sx-btn" disabled={!manualModel.trim()}>
              <Plus size={15} /> Adicionar modelo
            </button>
          </form>
          <p className="sx-router-help">
            Use para um modelo que o provedor não listou ou para dar outro nome ao mesmo modelo (ex.: os nomes dos planos <code>claude-opus-5-5</code>, <code>argon-4</code> e <code>gpt-6-astra</code>).
          </p>
          {!drafts ? (
            <p className="sx-admin-empty">Consultando os modelos do provedor…</p>
          ) : !drafts.length ? (
            <p className="sx-admin-empty">O provedor não listou nenhum modelo. Digite o ID acima para adicionar.</p>
          ) : (
            <>
              <div className="sx-router-model-tools">
                <label className="sx-search">
                  <Search size={16} />
                  <input aria-label="Buscar modelo" placeholder="Busque um modelo…" value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} />
                </label>
                <span>{drafts.filter((d) => d.sell).length} marcados</span>
              </div>
              <div className="sx-admin-table sx-router-models">
                <table>
                  <thead>
                    <tr>
                      <th>Vender</th>
                      <th>Modelo no provedor</th>
                      <th>Nome para o cliente</th>
                      <th>Nome na tela</th>
                      <th>Pro e teste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts
                      .filter((d) => !modelSearch || `${d.upstream} ${d.upstreamName} ${d.alias}`.toLowerCase().includes(modelSearch.toLowerCase()))
                      .map((d) => (
                        <tr key={d.key} className={d.sell ? 'is-selected' : ''}>
                          <td>
                            <input type="checkbox" aria-label={`Vender ${d.upstream}`} checked={d.sell} onChange={(e) => editDraft(d.key, { sell: e.target.checked })} />
                          </td>
                          <td>
                            <code>{d.upstream}</code>
                            {d.missing && <small className="sx-router-sub is-warning">Sumiu da lista do provedor</small>}
                            <div>
                              <button type="button" className="sx-link-btn" onClick={() => duplicateDraft(d)}>
                                + Outro nome
                              </button>
                            </div>
                          </td>
                          <td>
                            <input
                              value={d.alias}
                              disabled={!d.sell}
                              spellCheck={false}
                              placeholder="ex.: claude-opus-5-5"
                              aria-label={`Nome para o cliente de ${d.upstream}`}
                              onChange={(e) => {
                                const alias = e.target.value.toLowerCase()
                                const known = ROUTER_MODEL_NAMES[alias]
                                editDraft(d.key, known ? { alias, label: known } : { alias })
                              }}
                            />
                          </td>
                          <td>
                            <input value={d.label} disabled={!d.sell} aria-label={`Nome na tela de ${d.upstream}`} onChange={(e) => editDraft(d.key, { label: e.target.value })} />
                          </td>
                          <td>
                            <input type="checkbox" aria-label={`${d.upstream} no Pro e no teste`} disabled={!d.sell} checked={d.in_pro} onChange={(e) => editDraft(d.key, { in_pro: e.target.checked })} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="sx-router-modal-actions">
            <button type="button" className="sx-btn" onClick={() => setModelsFor(null)}>
              Cancelar
            </button>
            <button type="button" className="sx-btn is-primary" disabled={!drafts || working === 'models'} onClick={saveModels}>
              {working === 'models' ? 'Salvando…' : 'Salvar modelos'}
            </button>
          </div>
        </Modal>
      )}

      {keyForm && (
        <Modal eyebrow="Chave manual" title="Nova chave" onClose={() => setKeyForm(null)}>
          <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); createKey() }}>
            <label>
              Nome do cliente
              <input value={keyForm.name} maxLength={80} placeholder="Ex.: João Silva" onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} />
            </label>
            <label>
              WhatsApp (opcional)
              <input value={keyForm.contact} maxLength={80} placeholder="(81) 99999-9999" onChange={(e) => setKeyForm({ ...keyForm, contact: e.target.value })} />
            </label>
            <label className="is-wide">
              E-mail da conta do cliente (opcional)
              <input type="email" list="sx-router-accounts" value={keyForm.email} maxLength={200} placeholder="email@cliente.com" onChange={(e) => setKeyForm({ ...keyForm, email: e.target.value })} />
              <small>Ligada à conta, o cliente vê esta chave, a validade e o consumo no painel dele. A conta precisa estar cadastrada no site.</small>
            </label>
            <label>
              Validade
              <select value={keyForm.days} onChange={(e) => setKeyForm({ ...keyForm, days: e.target.value, slow: e.target.value === 'h3' || (e.target.value === 'custom' && keyForm.unit === 'horas') })}>
                {DURATIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {keyForm.days === 'custom' ? (
              <label>
                Quanto tempo
                <span className="sx-router-amount">
                  <input type="number" min={1} max={keyForm.unit === 'horas' ? 720 : 366} value={keyForm.custom} onChange={(e) => setKeyForm({ ...keyForm, custom: e.target.value })} />
                  <select aria-label="Unidade" value={keyForm.unit} onChange={(e) => setKeyForm({ ...keyForm, unit: e.target.value as 'dias' | 'horas', slow: e.target.value === 'horas' })}>
                    <option value="horas">horas</option>
                    <option value="dias">dias</option>
                  </select>
                </span>
              </label>
            ) : (
              <span />
            )}
            <label className="sx-router-check is-wide">
              <input type="checkbox" checked={keyForm.slow} onChange={(e) => setKeyForm({ ...keyForm, slow: e.target.checked })} /> Chave de teste (mais lenta): usa o ritmo do teste grátis definido em Proteção
            </label>
            <fieldset className="sx-router-models-pick is-wide">
              <legend>Modelos</legend>
              <label className="sx-router-check">
                <input type="radio" checked={keyForm.all} onChange={() => setKeyForm({ ...keyForm, all: true })} /> Todos os modelos à venda ({sellable.length})
              </label>
              <label className="sx-router-check">
                <input type="radio" checked={!keyForm.all} onChange={() => setKeyForm({ ...keyForm, all: false })} /> Escolher
              </label>
              {!keyForm.all && (
                <div className="sx-router-chips">
                  {sellable.map((m) => (
                    <label key={m.alias} className="sx-router-check">
                      <input
                        type="checkbox"
                        checked={keyForm.models.includes(m.alias)}
                        onChange={(e) => setKeyForm({ ...keyForm, models: e.target.checked ? [...keyForm.models, m.alias] : keyForm.models.filter((x) => x !== m.alias) })}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            {modalError && (
              <p role="alert" className="sx-admin-message is-error is-wide">
                <CircleAlert size={16} /> {modalError}
              </p>
            )}
            <div className="sx-router-modal-actions is-wide">
              <button type="button" className="sx-btn" onClick={() => setKeyForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="sx-btn is-primary" disabled={working === 'key-form'}>
                {working === 'key-form' ? 'Criando…' : 'Criar chave'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {ipsFor && (
        <Modal eyebrow={ipsFor.name} title="Detalhes da chave" onClose={() => setIpsFor(null)}>
          {modalError && (
            <p role="alert" className="sx-admin-message is-error">
              <CircleAlert size={16} /> {modalError}
            </p>
          )}
          {(() => {
            const use = spent.get(ipsFor.gateway_client_id)
            return (
              <div className="sx-router-usage">
                <h4>Consumo ({period})</h4>
                {use ? (
                  <dl>
                    <div><dt>Chamadas</dt><dd>{use.requests.toLocaleString('pt-BR')}</dd></div>
                    <div><dt>Tokens de entrada</dt><dd>{tokens(use.input)}</dd></div>
                    <div><dt>Tokens de saída</dt><dd>{tokens(use.output)}</dd></div>
                    <div><dt>Com erro</dt><dd>{use.errors.toLocaleString('pt-BR')}</dd></div>
                    <div><dt>Última chamada</dt><dd>{use.last ? dateTime(use.last) : '—'}</dd></div>
                  </dl>
                ) : (
                  <p className="sx-router-sub">Sem uso neste período.</p>
                )}
                <small className="sx-router-sub">Cada chamada, com modelo e tokens, aparece na aba "Consumo e falhas". Mude o período lá.</small>
              </div>
            )
          })()}
          <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); saveKeyLimits() }}>
            <label>
              Chamadas por minuto
              <input type="number" min={1} max={100000} placeholder={settings.rpm == null ? 'Padrão: sem limite' : `Padrão: ${settings.rpm}`} value={keyLimits.rpm} onChange={(e) => setKeyLimits({ ...keyLimits, rpm: e.target.value })} />
            </label>
            <label>
              Respostas ao mesmo tempo
              <input type="number" min={1} max={1000} placeholder={settings.concurrency == null ? 'Padrão: sem limite' : `Padrão: ${settings.concurrency}`} value={keyLimits.concurrency} onChange={(e) => setKeyLimits({ ...keyLimits, concurrency: e.target.value })} />
            </label>
            <label>
              Máximo de IPs
              <input type="number" min={1} max={100} disabled={!ipsData?.ipLimit} placeholder={settings.max_ips == null ? 'Padrão: sem limite' : `Padrão: ${settings.max_ips}`} value={keyLimits.max_ips} onChange={(e) => setKeyLimits({ ...keyLimits, max_ips: e.target.value })} />
            </label>
            <small className="is-wide">Deixe vazio para usar o padrão de todas as chaves.{ipsData && !ipsData.ipLimit ? ' Para o máximo de IPs, aplique supabase/gateway-guard-ips.sql.' : ''}</small>
            <div className="sx-router-modal-actions is-wide">
              <button type="submit" className="sx-btn is-primary" disabled={!ipsData || working === 'key-limits'}>
                {working === 'key-limits' ? 'Salvando…' : 'Salvar limite da chave'}
              </button>
            </div>
          </form>
          {!ipsData ? (
            <p className="sx-admin-empty">{modalError ? '' : 'Carregando os IPs…'}</p>
          ) : !ipsData.ips.length ? (
            <p className="sx-admin-empty">Esta chave ainda não foi usada.</p>
          ) : (
            <div className="sx-admin-table">
              <table>
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Primeiro uso</th>
                    <th>Último uso</th>
                    <th>Chamadas</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ipsData.ips.map((x) => (
                    <tr key={x.ip}>
                      <td>
                        <code>{x.ip}</code>
                        {x.blocked_at ? (
                          <small className="sx-router-sub is-warning">Bloqueado nesta chave</small>
                        ) : x.accepted === false ? (
                          <small className="sx-router-sub is-warning">Recusado: a chave estava em uso em outro IP</small>
                        ) : null}
                        {x.device_label && <small className="sx-router-sub">{String(x.device_label)}</small>}
                      </td>
                      <td>{dateTime(x.first_seen)}</td>
                      <td>{dateTime(x.last_seen)}</td>
                      <td>{Number(x.requests).toLocaleString('pt-BR')}</td>
                      <td>
                        <div className="sx-actions">
                          {x.accepted === false && !x.blocked_at && (
                            <button type="button" className="sx-btn is-primary" disabled={working === 'ip:' + x.ip} onClick={() => ipAction(x.ip, 'router-key-ip-accept')}>
                              <Check size={15} /> Aceitar
                            </button>
                          )}
                          <button type="button" className={`sx-btn ${x.blocked_at ? '' : 'is-danger'}`} disabled={working === 'ip:' + x.ip} onClick={() => setIpBlocked(x.ip, !x.blocked_at)}>
                            {x.blocked_at ? <Check size={15} /> : <Ban size={15} />} {x.blocked_at ? 'Liberar' : 'Bloquear'}
                          </button>
                          <button
                            type="button"
                            className="sx-btn is-danger"
                            title="Bloqueia este IP em todas as chaves, não só nesta"
                            onClick={() => {
                              if (!window.confirm(`Bloquear o IP ${x.ip} em TODAS as chaves? Quem usa esse endereço fica sem acesso em qualquer chave até você liberar.`)) return
                              blockNetwork(x.ip, true, `Visto na chave de ${ipsFor.name}`)
                            }}
                          >
                            <Globe size={15} /> Bloquear em todas
                          </button>
                          <button type="button" className="sx-btn" aria-label={`Remover ${x.ip}`} title="Tirar da lista (libera a vaga; se voltar a usar, aparece de novo)" disabled={working === 'ip:' + x.ip} onClick={() => ipAction(x.ip, 'router-key-ip-remove')}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="sx-router-help">Muitos IPs diferentes numa chave só costuma ser chave compartilhada. Com "Máximo de IPs", o IP novo além do limite fica aguardando: aceite aqui se for o cliente (trocou de rede ou de aparelho).</p>
        </Modal>
      )}

      {editFor && editForm && (
        <Modal eyebrow="Chave manual" title={`Editar ${editFor.name}`} onClose={() => setEditFor(null)}>
          <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); saveEdit() }}>
            <label>
              Nome do cliente
              <input value={editForm.name} maxLength={80} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </label>
            <label>
              WhatsApp (opcional)
              <input value={editForm.contact} maxLength={80} placeholder="(81) 99999-9999" onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} />
            </label>
            <label className="is-wide">
              E-mail da conta do cliente
              <input type="email" list="sx-router-accounts" value={editForm.email} maxLength={200} placeholder="email@cliente.com" onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              <small>Ligada à conta, o cliente vê esta chave, a validade e o consumo no painel dele. Apague o e-mail para desligar.</small>
            </label>
            <label className="is-wide">
              Válida até
              <input type="date" value={editForm.expires} onChange={(e) => setEditForm({ ...editForm, expires: e.target.value })} />
              <span className="sx-quick">
                {[7, 30, 60, 90].map((days) => (
                  <button key={days} type="button" onClick={() => setEditForm({ ...editForm, expires: plusDays(brDay(editFor.expires_at), days) })}>
                    +{days} dias
                  </button>
                ))}
                <button type="button" onClick={() => setEditForm({ ...editForm, expires: brDay(Date.now()) })}>
                  Vence hoje
                </button>
              </span>
              <small>Vale até o fim do dia escolhido. Os botões somam a partir do vencimento atual (ou de hoje, se já venceu).</small>
            </label>
            <fieldset className="sx-router-models-pick is-wide">
              <legend>Modelos</legend>
              <label className="sx-router-check">
                <input type="radio" checked={editForm.all} onChange={() => setEditForm({ ...editForm, all: true })} /> Todos os modelos à venda ({sellable.length})
              </label>
              <label className="sx-router-check">
                <input type="radio" checked={!editForm.all} onChange={() => setEditForm({ ...editForm, all: false })} /> Escolher
              </label>
              {!editForm.all && (
                <div className="sx-router-chips">
                  {sellable.map((m) => (
                    <label key={m.alias} className="sx-router-check">
                      <input
                        type="checkbox"
                        checked={editForm.models.includes(m.alias)}
                        onChange={(e) => setEditForm({ ...editForm, models: e.target.checked ? [...editForm.models, m.alias] : editForm.models.filter((x) => x !== m.alias) })}
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            {modalError && (
              <p role="alert" className="sx-admin-message is-error is-wide">
                <CircleAlert size={16} /> {modalError}
              </p>
            )}
            <div className="sx-router-modal-actions is-wide">
              <button type="button" className="sx-btn" onClick={() => setEditFor(null)}>
                Cancelar
              </button>
              <button type="submit" className="sx-btn is-primary" disabled={working === 'edit'}>
                {working === 'edit' ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {created && (
        <Modal eyebrow="Chave criada" title="Envie para o cliente" onClose={() => setCreated(null)}>
          <p className="sx-router-help">A chave já está valendo. Se precisar dela de novo, use o botão de copiar na lista.</p>
          <pre className="sx-router-message">{created.message}</pre>
          <div className="sx-router-modal-actions">
            <button type="button" className="sx-btn" onClick={() => copy(created.key, 'Chave copiada.')}>
              <Copy size={15} /> Copiar só a chave
            </button>
            <button type="button" className="sx-btn is-primary" onClick={() => copy(created.message, 'Mensagem copiada. Cole no WhatsApp do cliente.')}>
              <Copy size={15} /> Copiar mensagem para o WhatsApp
            </button>
          </div>
        </Modal>
      )}

      {reporForm && (() => {
        const q = reporForm.search.trim().toLowerCase()
        const matchText = (value: string) => !q || value.toLowerCase().includes(q)
        const eligibleKeys = (overview?.keys || []).filter((k) => {
          if (!matchText(`${k.name} ${k.contact || ''} ${k.token_prefix} ${accountEmail(k.user_id)}`)) return false
          if (reporForm.filter === 'active') return !isTestKey(k) && !isEnded(k)
          if (reporForm.filter === 'paid') return !isTestKey(k)
          return true
        })
        const uniqueSiteSubs = siteKeys.filter((s, idx, arr) => s.subscription_id && arr.findIndex((x) => x.subscription_id === s.subscription_id) === idx)
        const eligibleSubs = uniqueSiteSubs.filter((s) => {
          if (!matchText(`${s.customer} ${s.email} ${s.prefix} ${s.plan}`)) return false
          if (reporForm.filter === 'active') return s.state === 'Ativa'
          return true
        })
        const allVisibleKeysSelected = eligibleKeys.length > 0 && eligibleKeys.every((k) => reporForm.selectedKeys.includes(k.id))
        const allVisibleSubsSelected = eligibleSubs.length > 0 && eligibleSubs.every((s) => reporForm.selectedSubs.includes(String(s.subscription_id)))
        const allVisibleSelected = (eligibleKeys.length + eligibleSubs.length > 0) && (!eligibleKeys.length || allVisibleKeysSelected) && (!eligibleSubs.length || allVisibleSubsSelected)
        const totalSelected = reporForm.selectedKeys.length + reporForm.selectedSubs.length
        const toggleVisible = () => {
          if (allVisibleSelected) {
            const kSet = new Set(eligibleKeys.map((k) => k.id))
            const sSet = new Set(eligibleSubs.map((s) => String(s.subscription_id)))
            setReporForm({
              ...reporForm,
              selectedKeys: reporForm.selectedKeys.filter((id) => !kSet.has(id)),
              selectedSubs: reporForm.selectedSubs.filter((id) => !sSet.has(id)),
            })
          } else {
            const nextKeys = [...new Set([...reporForm.selectedKeys, ...eligibleKeys.map((k) => k.id)])]
            const nextSubs = [...new Set([...reporForm.selectedSubs, ...eligibleSubs.map((s) => String(s.subscription_id))])]
            setReporForm({ ...reporForm, selectedKeys: nextKeys, selectedSubs: nextSubs })
          }
        }
        return (
          <Modal eyebrow={reporForm.mode === 'remove' ? 'Remoção em lote' : 'Reposição em lote'} title={reporForm.mode === 'remove' ? 'Remover dias de assinantes' : 'Repor dias para assinantes'} onClose={() => setReporForm(null)}>
            <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); saveRepor() }}>
              <label className="is-wide">
                {reporForm.mode === 'remove' ? 'Quantos dias remover' : 'Quantos dias repor'}
                <input
                  type="number"
                  min={1}
                  max={366}
                  inputMode="numeric"
                  value={reporForm.days}
                  onChange={(e) => setReporForm({ ...reporForm, days: e.target.value })}
                />
                <span className="sx-quick">
                  {[1, 2, 3, 5, 7, 15, 30].map((d) => (
                    <button key={d} type="button" className={Number(reporForm.days) === d ? 'is-on' : ''} onClick={() => setReporForm({ ...reporForm, days: String(d) })}>
                      {reporForm.mode === 'remove' ? '-' : '+'}{d} {d === 1 ? 'dia' : 'dias'}
                    </button>
                  ))}
                </span>
                <small>{reporForm.mode === 'remove'
                  ? 'Os dias são tirados do vencimento atual de cada assinante marcado. O vencimento nunca fica antes de agora: quem tiver menos dias que isso fica vencido na hora.'
                  : 'Os dias são somados a partir do vencimento atual de cada assinante selecionado (ou a partir de hoje, se já tiver vencido).'}</small>
              </label>

              <div className="is-wide" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="sx-quick" role="group" aria-label="Filtrar assinantes para reposição">
                  {([
                    ['active', 'Assinantes ativos'],
                    ['paid', 'Pagos (inclui vencidos)'],
                    ['all', 'Todos (inclui testes)'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={reporForm.filter === val ? 'is-on' : ''}
                      onClick={() => setReporForm({ ...reporForm, filter: val })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button type="button" className="sx-btn" onClick={toggleVisible}>
                    {allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
                  </button>
                  {totalSelected > 0 && (
                    <button type="button" className="sx-btn" onClick={() => setReporForm({ ...reporForm, selectedKeys: [], selectedSubs: [] })}>
                      Limpar ({totalSelected})
                    </button>
                  )}
                </div>
              </div>

              <label className="sx-search is-wide">
                <Search size={16} />
                <input
                  aria-label="Buscar assinante para repor"
                  placeholder="Filtrar por nome, e-mail, WhatsApp ou chave…"
                  value={reporForm.search}
                  onChange={(e) => setReporForm({ ...reporForm, search: e.target.value })}
                />
              </label>

              <div className="sx-admin-table is-wide" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                {!eligibleKeys.length && !eligibleSubs.length ? (
                  <p className="sx-admin-empty">Nenhum assinante neste filtro.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '36px' }}>
                          <input type="checkbox" aria-label="Selecionar todos os visíveis" checked={allVisibleSelected} onChange={toggleVisible} />
                        </th>
                        <th>Assinante</th>
                        <th>Origem / Chave</th>
                        <th>Situação atual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleKeys.map((k) => {
                        const state = keyState(k, now)
                        const checked = reporForm.selectedKeys.includes(k.id)
                        const email = accountEmail(k.user_id)
                        return (
                          <tr key={'k:' + k.id} onClick={() => setReporForm({
                            ...reporForm,
                            selectedKeys: checked ? reporForm.selectedKeys.filter((id) => id !== k.id) : [...reporForm.selectedKeys, k.id],
                          })} style={{ cursor: 'pointer' }}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setReporForm({
                                  ...reporForm,
                                  selectedKeys: e.target.checked ? [...reporForm.selectedKeys, k.id] : reporForm.selectedKeys.filter((id) => id !== k.id),
                                })}
                              />
                            </td>
                            <td>
                              <strong>{k.name}</strong>
                              {(k.contact || email) && <small className="sx-router-sub">{[k.contact, email].filter(Boolean).join(' · ')}</small>}
                            </td>
                            <td>
                              <code>{k.token_prefix}…</code>
                              <small className="sx-router-sub">{isTestKey(k) ? 'Teste manual' : 'Chave Roteador'}</small>
                            </td>
                            <td>
                              <span className={`sx-state ${state.tone}`}>{state.label}</span>
                              <small className="sx-router-sub">{state.detail}</small>
                            </td>
                          </tr>
                        )
                      })}
                      {eligibleSubs.map((s) => {
                        const subId = String(s.subscription_id)
                        const checked = reporForm.selectedSubs.includes(subId)
                        return (
                          <tr key={'s:' + subId} onClick={() => setReporForm({
                            ...reporForm,
                            selectedSubs: checked ? reporForm.selectedSubs.filter((id) => id !== subId) : [...reporForm.selectedSubs, subId],
                          })} style={{ cursor: 'pointer' }}>
                            <td onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setReporForm({
                                  ...reporForm,
                                  selectedSubs: e.target.checked ? [...reporForm.selectedSubs, subId] : reporForm.selectedSubs.filter((id) => id !== subId),
                                })}
                              />
                            </td>
                            <td>
                              <strong>{s.customer}</strong>
                              {s.email && <small className="sx-router-sub">{s.email}</small>}
                            </td>
                            <td>
                              <code>{s.prefix}…</code>
                              <small className="sx-router-sub">Plano do site · {s.plan}</small>
                            </td>
                            <td>
                              <span className={`sx-state ${s.state === 'Ativa' ? 'is-confirmed' : 'is-expired'}`}>{s.state}</span>
                              {s.paid_until && <small className="sx-router-sub">vence em {date(s.paid_until)}</small>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {modalError && (
                <p role="alert" className="sx-admin-message is-error is-wide">
                  <CircleAlert size={16} /> {modalError}
                </p>
              )}
              <div className="sx-router-modal-actions is-wide">
                <button type="button" className="sx-btn" onClick={() => setReporForm(null)}>
                  Cancelar
                </button>
                <button type="submit" className={`sx-btn ${reporForm.mode === 'remove' ? 'is-danger' : 'is-primary'}`} disabled={working === 'repor' || totalSelected === 0}>
                  {working === 'repor'
                    ? reporForm.mode === 'remove' ? 'Removendo…' : 'Repondo…'
                    : reporForm.mode === 'remove'
                      ? `Remover ${Number(reporForm.days) || 0} ${Number(reporForm.days) === 1 ? 'dia' : 'dias'} de ${totalSelected} ${totalSelected === 1 ? 'assinante' : 'assinantes'}`
                      : `Repor +${Number(reporForm.days) || 0} ${Number(reporForm.days) === 1 ? 'dia' : 'dias'} para ${totalSelected} ${totalSelected === 1 ? 'assinante' : 'assinantes'}`}
                </button>
              </div>
            </form>
          </Modal>
        )
      })()}

      {manualSubForm && (
        <Modal
          eyebrow="Assinatura externa / Chave ativa"
          title={manualSubForm.keyName ? `Plano de ${manualSubForm.keyName}` : 'Adicionar ou alterar assinatura fora do site'}
          onClose={() => setManualSubForm(null)}
        >
          <form className="sx-form-grid" onSubmit={(e) => { e.preventDefault(); void saveManualSub() }}>
            <label className="is-wide">
              Chave ativa no Roteador (opcional se informar o e-mail)
              <select
                value={manualSubForm.keyId}
                onChange={(e) => {
                  const picked = (overview?.keys || []).find((x) => x.id === e.target.value)
                  setManualSubForm({
                    ...manualSubForm,
                    keyId: e.target.value,
                    keyName: picked?.name || '',
                    email: picked ? accountEmail(picked.user_id) || manualSubForm.email : manualSubForm.email,
                    expires: picked && Date.parse(picked.expires_at) > Date.now() ? brDay(picked.expires_at) : manualSubForm.expires,
                  })
                }}
              >
                <option value="">— Nenhuma chave específica (usar todas da conta do e-mail) —</option>
                {(overview?.keys || []).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.token_prefix}…){k.user_id ? ` · ${accountEmail(k.user_id)}` : ''}
                  </option>
                ))}
              </select>
              <small>Ao escolher uma chave que já está on, ela ganha automaticamente os modelos, validade e limites de IPs/req/min do plano escolhido.</small>
            </label>

            <label className="is-wide">
              E-mail da conta do cliente no site (opcional se só quiser mudar a chave)
              <input
                type="email"
                list="sx-router-accounts"
                value={manualSubForm.email}
                maxLength={200}
                placeholder="cliente@email.com"
                onChange={(e) => setManualSubForm({ ...manualSubForm, email: e.target.value })}
              />
              <small>Se preenchido, cria ou atualiza a assinatura no painel do cliente no site e vincula a chave à conta dele.</small>
            </label>

            <label className="is-wide">
              Plano para ativar ou alterar
              <select
                value={manualSubForm.plan}
                onChange={(e) => setManualSubForm({ ...manualSubForm, plan: e.target.value as ManualSubForm['plan'] })}
              >
                {MANUAL_PLANS.map(([code, title, desc]) => (
                  <option key={code} value={code}>
                    {title} — {desc}
                  </option>
                ))}
              </select>
            </label>

            <label className="is-wide">
              Válida até
              <input
                type="date"
                value={manualSubForm.expires}
                onChange={(e) => setManualSubForm({ ...manualSubForm, expires: e.target.value })}
              />
              <span className="sx-quick">
                {[7, 15, 30, 60, 90].map((d) => (
                  <button key={d} type="button" onClick={() => setManualSubForm({ ...manualSubForm, expires: plusDays(brDay(Date.now()), d) })}>
                    +{d} dias (de hoje)
                  </button>
                ))}
              </span>
            </label>

            {modalError && (
              <p role="alert" className="sx-admin-message is-error is-wide">
                <CircleAlert size={16} /> {modalError}
              </p>
            )}
            <div className="sx-router-modal-actions is-wide">
              <button type="button" className="sx-btn" onClick={() => setManualSubForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="sx-btn is-primary" disabled={working === 'manual-sub'}>
                {working === 'manual-sub' ? 'Salvando…' : 'Aplicar plano'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
