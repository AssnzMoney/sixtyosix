import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, Gift, UserPlus } from 'lucide-react'
import { adminHeaders } from '../lib/adminSession'

type Affiliate = {
  user_id: string
  email: string
  name: string
  code: string
  days: number
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
  const [form, setForm] = useState({ email: '', code: '', days: '7' })
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

  async function save(input: { email: string; code?: string; days: number | string; enabled: boolean }, message: string) {
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
            void save({ email: form.email, code: form.code || undefined, days: form.days, enabled: true }, 'Afiliado ativado.').then((ok) => {
              if (ok) setForm({ email: '', code: '', days: form.days })
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
            <small>Vale para cada pagamento, inclusive renovações.</small>
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
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`sx-btn${a.enabled ? ' is-danger' : ''}`}
                        disabled={saving}
                        onClick={() => {
                          if (a.enabled && !window.confirm(`Desativar ${a.email}? O link para de valer para novas contas e os próximos pagamentos dos indicados não dão mais dias.`)) return
                          void save({ email: a.email, code: a.code, days: a.days, enabled: !a.enabled }, a.enabled ? 'Afiliado desativado.' : 'Afiliado ativado de novo.')
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
    </>
  )
}
