import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Gift, MessageCircle, UserPlus } from 'lucide-react'
import { adminHeaders } from '../lib/adminSession'

type Affiliate = {
  user_id: string
  email: string
  name: string
  code: string
  days: number
  referredDays: number | null
  enabled: boolean
  link: string
  referred: number
  paying: number
  payments: number
  totalDays: number
}

/**
 * Aba Afiliados do admin: só as contas ativadas aqui têm link de indicação. Cada pagamento aprovado
 * de quem chegou pelo link (inclusive renovações) dá ao afiliado os dias escolhidos.
 */
export default function AffiliatesPanel({ token }: { token: string }) {
  const [list, setList] = useState<Affiliate[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ email: '', code: '', days: '7', referredDays: '3' })
  // Venda feita pelo WhatsApp: afiliado escolhido, e-mail do cliente (opcional) e uma anotação.
  const [sale, setSale] = useState<{ user_id: string; email: string; note: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  async function call<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch('/api/management', {
      method: 'POST',
      headers: { ...adminHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
    return result as T
  }

  async function load() {
    try {
      const result = await call<{ affiliates: Affiliate[] }>({ action: 'affiliate-list' })
      setList(result.affiliates)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os afiliados.')
      setList([])
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function save(input: { email: string; code?: string; days: number | string; referred_days?: number | string; enabled: boolean }, message: string) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await call<{ link: string }>({ action: 'affiliate-save', ...input })
      setNotice(`${message} Link: ${result.link}`)
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(link)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      /* sem área de transferência: o link continua visível */
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="sx-admin-message is-error">
          {error}
        </p>
      )}
      {notice && <p className="sx-admin-message">{notice}</p>}

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <UserPlus size={17} /> Ativar afiliado
          </h3>
        </div>
        <p className="sx-router-sub">
          Só quem estiver aqui tem link de indicação. Cada pagamento aprovado de quem criou a conta pelo link, inclusive as renovações, dá ao
          afiliado os dias escolhidos no plano e na validade das chaves do Roteador dele. Quem já era cliente não conta.
        </p>
        <form
          className="sx-form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            void save({ email: form.email, code: form.code || undefined, days: form.days, referred_days: form.referredDays, enabled: true }, 'Afiliado ativado.').then((ok) => {
              if (ok) setForm({ email: '', code: '', days: form.days, referredDays: form.referredDays })
            })
          }}
        >
          <label>
            E-mail da conta do afiliado
            <input type="email" required placeholder="cliente@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <small>A pessoa precisa já ter conta em sixtysix.online.</small>
          </label>
          <label>
            Código do link (opcional)
            <input type="text" placeholder="ex.: joao" pattern="[a-z0-9][a-z0-9-]{2,29}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
            <small>Vazio: usa o começo do e-mail. O link fica sixtysix.online/convite/código.</small>
          </label>
          <label>
            Dias por pagamento indicado
            <input type="number" min={1} max={60} inputMode="numeric" required value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            <small>Para o afiliado, a cada pagamento do indicado, inclusive renovações.</small>
          </label>
          <label>
            Dias de bônus para quem é indicado
            <input type="number" min={0} max={60} inputMode="numeric" required value={form.referredDays} onChange={(e) => setForm({ ...form, referredDays: e.target.value })} />
            <small>Uma vez, na primeira assinatura de quem veio pelo link ou pelo código.</small>
          </label>
          <div className="sx-actions">
            <button type="submit" className="sx-btn is-primary" disabled={saving}>
              <Gift size={15} /> {saving ? 'Salvando…' : 'Ativar afiliado'}
            </button>
          </div>
        </form>
      </section>

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <Gift size={17} /> Afiliados
          </h3>
        </div>
        {list === null ? (
          <p className="sx-admin-empty">Carregando…</p>
        ) : !list.length ? (
          <p className="sx-admin-empty">Nenhum afiliado ainda.</p>
        ) : (
          <div className="sx-admin-table">
            <table>
              <thead>
                <tr>
                  <th>Afiliado</th>
                  <th>Link</th>
                  <th>Indicados</th>
                  <th>Pagaram</th>
                  <th>Dias ganhos</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.user_id}>
                    <td>
                      <strong>{a.name || a.email}</strong>
                      {a.name && <small style={{ display: 'block' }}>{a.email}</small>}
                    </td>
                    <td>
                      <button type="button" className="sx-btn" onClick={() => void copy(a.link)} title={a.link}>
                        {copied === a.link ? <Check size={14} /> : <Copy size={14} />} /convite/{a.code}
                      </button>{' '}
                      <a className="sx-btn" href={a.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink size={14} /> Abrir
                      </a>
                    </td>
                    <td>{a.referred}</td>
                    <td>
                      {a.paying}
                      {a.payments > a.paying ? <small style={{ display: 'block' }}>{a.payments} pagamentos</small> : null}
                    </td>
                    <td>
                      +{a.totalDays}
                      <small style={{ display: 'block' }}>{a.days} por pagamento</small>
                      {a.referredDays != null && <small style={{ display: 'block' }}>indicado ganha {a.referredDays}</small>}
                    </td>
                    <td>
                      {a.enabled && (
                        <button type="button" className="sx-btn is-primary" disabled={saving} onClick={() => setSale({ user_id: a.user_id, email: '', note: '' })}>
                          <MessageCircle size={14} /> Venda pelo WhatsApp
                        </button>
                      )}{' '}
                      <button
                        type="button"
                        className={`sx-btn${a.enabled ? ' is-danger' : ''}`}
                        disabled={saving}
                        onClick={() => {
                          if (a.enabled && !window.confirm(`Desativar ${a.email}? O link para de valer para novas contas e os próximos pagamentos dos indicados não dão mais dias.`)) return
                          void save({ email: a.email, code: a.code, days: a.days, ...(a.referredDays != null ? { referred_days: a.referredDays } : {}), enabled: !a.enabled }, a.enabled ? 'Afiliado desativado.' : 'Afiliado ativado de novo.')
                        }}
                      >
                        {a.enabled ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sale && (() => {
        const a = list?.find((x) => x.user_id === sale.user_id)
        if (!a) return null
        return (
          <section className="sx-admin-panel">
            <div className="sx-router-head">
              <h3>
                <MessageCircle size={17} /> Venda pelo WhatsApp com o código {a.code.toUpperCase()}
              </h3>
            </div>
            <p className="sx-router-sub">
              Use quando o cliente mandou o código {a.code.toUpperCase()} e comprou pelo WhatsApp. {a.name || a.email} ganha {a.days} dias na hora. Com o
              e-mail da conta do cliente, ele também ganha {a.referredDays ?? 0} dias de bônus (uma vez) e as próximas renovações dele pelo site
              contam para o afiliado. Sem conta, lembre de pôr os dias de bônus na validade da chave dele.
            </p>
            <form
              className="sx-form-grid"
              onSubmit={async (e) => {
                e.preventDefault()
                setSaving(true)
                setError('')
                setNotice('')
                try {
                  const result = await call<{ affiliateDays: number; referredDays: number; customer: string | null }>({ action: 'affiliate-manual', user_id: a.user_id, email: sale.email || undefined, note: sale.note || undefined })
                  setNotice(
                    `Venda registrada: ${a.name || a.email} ganhou +${result.affiliateDays} dias.` +
                      (result.customer ? (result.referredDays ? ` ${result.customer} ganhou +${result.referredDays} dias de bônus.` : ` ${result.customer} já tinha recebido o bônus de indicação antes.`) : ''),
                  )
                  setSale(null)
                  await load()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível registrar.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              <label>
                E-mail da conta do cliente (opcional)
                <input type="email" placeholder="cliente@email.com" value={sale.email} onChange={(e) => setSale({ ...sale, email: e.target.value })} />
                <small>Se o cliente já tem conta em sixtysix.online.</small>
              </label>
              <label>
                Anotação (opcional)
                <input type="text" maxLength={200} placeholder="ex.: Pix de 13/11, plano Pro" value={sale.note} onChange={(e) => setSale({ ...sale, note: e.target.value })} />
              </label>
              <div className="sx-actions">
                <button type="submit" className="sx-btn is-primary" disabled={saving}>
                  {saving ? 'Registrando…' : 'Registrar venda'}
                </button>
                <button type="button" className="sx-btn" disabled={saving} onClick={() => setSale(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )
      })()}
    </>
  )
}
