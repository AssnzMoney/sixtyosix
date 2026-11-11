// Quem recebe qual e-mail, e uma vez só. Cada aviso é "reservado" na tabela
// email_notifications (único por tipo + referência) antes de ser enviado.
import { deliveryEmail, expiredEmail, expiringEmail, isEmail, sendEmail, welcomeEmail, type EmailConfig, type EmailMessage } from './email.js'

export type NotifyKind = 'welcome' | 'delivery' | 'expiring' | 'expired'
export type NotifyResult = 'sent' | 'duplicate' | 'skipped' | 'failed' | 'unavailable'
type SupabaseConfig = { url: string; secret: string }
type Row = Record<string, any>
export type NotifyUser = { id: string; email: string; name: string; whatsapp: string; created_at?: string; email_confirmed_at?: string | null }

const DAY = 86400000

export function userFromAuth(u: Row): NotifyUser {
  const meta = (u.user_metadata || {}) as Row
  return {
    id: String(u.id),
    email: String(u.email || ''),
    name: String(meta.custom_name || meta.full_name || meta.name || ''),
    whatsapp: String(meta.whatsapp || ''),
    created_at: u.created_at,
    email_confirmed_at: u.email_confirmed_at ?? null,
  }
}

export function createNotifier(supabase: SupabaseConfig, email: EmailConfig | null, request: typeof fetch = fetch) {
  const headers = {
    apikey: supabase.secret,
    ...(!supabase.secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${supabase.secret}` } : {}),
    'Content-Type': 'application/json',
  }
  const rest = (path: string, init: RequestInit = {}) =>
    request(`${supabase.url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) })

  /** Reserva o aviso. Devolve false se já existe (enviado antes) e null se a tabela não existe. */
  async function claim(kind: NotifyKind, ref: string, user: NotifyUser): Promise<boolean | null> {
    const response = await rest('email_notifications?on_conflict=kind,ref', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ kind, ref, user_id: user.id, email: user.email }),
    })
    if (!response.ok) return null
    const rows = (await response.json().catch(() => [])) as Row[]
    return rows.length > 0
  }
  const where = (kind: NotifyKind, ref: string) => `email_notifications?${new URLSearchParams({ kind: `eq.${kind}`, ref: `eq.${ref}` })}`

  async function notify(kind: NotifyKind, ref: string, user: NotifyUser, message: EmailMessage): Promise<NotifyResult> {
    if (!email) return 'skipped'
    if (!isEmail(user.email)) return 'skipped'
    const claimed = await claim(kind, ref, user).catch(() => null)
    if (claimed === null) return 'unavailable'
    if (!claimed) return 'duplicate'
    try {
      const id = await sendEmail(email, message, request, `${kind}:${ref}`)
      await rest(where(kind, ref), { method: 'PATCH', body: JSON.stringify({ sent_at: new Date().toISOString(), provider_id: id }) }).catch(() => undefined)
      return 'sent'
    } catch {
      // Libera a reserva para a próxima execução tentar de novo.
      await rest(where(kind, ref), { method: 'DELETE' }).catch(() => undefined)
      return 'failed'
    }
  }

  const onboarded = (u: NotifyUser) => Boolean(u.name.trim() && u.whatsapp)

  return {
    notify,
    /** Boas-vindas: conta com e-mail confirmado e cadastro (nome e WhatsApp) completo. */
    welcome(user: NotifyUser) {
      if (!onboarded(user)) return Promise.resolve<NotifyResult>('skipped')
      return notify('welcome', user.id, user, welcomeEmail({ to: user.email, name: user.name }))
    },
    /** Credencial registrada no admin: avisa para olhar o WhatsApp e confirmar no painel. */
    delivery(user: NotifyUser, delivery: { id: string; title: string; key_hint: string }) {
      return notify('delivery', delivery.id, user, deliveryEmail({ to: user.email, name: user.name, title: delivery.title, hint: delivery.key_hint }))
    },

    /** Rodada diária: vencimento em até 3 dias, plano vencido e boas-vindas que ficaram para trás. */
    async daily(now = Date.now()) {
      const users = new Map<string, NotifyUser>()
      for (let page = 1; page <= 40; page++) {
        const response = await request(`${supabase.url}/auth/v1/admin/users?page=${page}&per_page=500`, { headers, signal: AbortSignal.timeout(20000) })
        if (!response.ok) throw new Error('Não foi possível listar as contas.')
        const list = (((await response.json()) as Row).users || []) as Row[]
        for (const u of list) users.set(String(u.id), userFromAuth(u))
        if (list.length < 500) break
      }

      const from = new Date(now - 3 * DAY).toISOString()
      const to = new Date(now + 3 * DAY + 3600000).toISOString()
      const response = await rest(
        `billing_subscription_state?${new URLSearchParams({
          select: 'id,user_id,plan_code,paid_until,entitled,billing_mode,provider_status',
          and: `(paid_until.gte.${from},paid_until.lte.${to})`,
          order: 'paid_until.asc',
          limit: '2000',
        })}`,
      )
      if (!response.ok) throw new Error('Não foi possível ler as assinaturas.')
      const subscriptions = (await response.json()) as Row[]
      // Quem tem outro plano ativo além do que está vencendo não recebe aviso.
      const activeResponse = await rest(
        `billing_subscription_state?${new URLSearchParams({ select: 'id,user_id,paid_until', entitled: 'eq.true', paid_until: `gt.${new Date(now).toISOString()}`, limit: '5000' })}`,
      )
      const active = activeResponse.ok ? ((await activeResponse.json()) as Row[]) : []
      const latestActive = new Map<string, number>()
      for (const s of active) latestActive.set(s.user_id, Math.max(latestActive.get(s.user_id) || 0, Date.parse(s.paid_until)))

      const counts: Record<string, Record<NotifyResult, number>> = {}
      const count = (kind: NotifyKind, result: NotifyResult) => {
        counts[kind] ||= { sent: 0, duplicate: 0, skipped: 0, failed: 0, unavailable: 0 }
        counts[kind][result]++
      }

      for (const s of subscriptions) {
        const user = users.get(s.user_id)
        if (!user || !s.paid_until) continue
        const end = Date.parse(s.paid_until)
        const ref = `${s.id}:${new Date(end).toISOString().slice(0, 10)}`
        const renewsAlone = s.billing_mode === 'recurring' && !['cancelled', 'paused'].includes(String(s.provider_status))
        if (end > now && s.entitled) {
          if (renewsAlone || (latestActive.get(s.user_id) || 0) > end) continue
          const daysLeft = Math.ceil((end - now) / DAY)
          count('expiring', await notify('expiring', ref, user, expiringEmail({ to: user.email, name: user.name, plan: s.plan_code, paidUntil: s.paid_until, daysLeft })))
        } else if (end <= now) {
          if ((latestActive.get(s.user_id) || 0) > now) continue
          count('expired', await notify('expired', ref, user, expiredEmail({ to: user.email, name: user.name, plan: s.plan_code, paidUntil: s.paid_until })))
        }
      }

      // Boas-vindas de quem fez o cadastro nos últimos 3 dias e não recebeu (ex.: falha no envio).
      for (const user of users.values()) {
        if (!user.created_at || Date.parse(user.created_at) < now - 3 * DAY || !user.email_confirmed_at) continue
        if (!onboarded(user)) continue
        count('welcome', await notify('welcome', user.id, user, welcomeEmail({ to: user.email, name: user.name })))
      }
      return { users: users.size, subscriptions: subscriptions.length, counts }
    },
  }
}
