import { useEffect, useState } from 'react'
import { Check, Copy, Gift } from 'lucide-react'

type Affiliate = {
  enabled: boolean
  code?: string
  link?: string
  days?: number
  referred?: number
  paying?: number
  totalDays?: number
  rewards?: { at: string; days: number; revoked: boolean }[]
}

const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "Indique e ganhe dias": só aparece para as contas que o admin ativou como afiliado.
 * Busca os próprios dados (/api/account/affiliate): uma falha aqui nunca afeta o resto do painel.
 */
export default function AffiliatePanel({ token }: { token: string }) {
  const [data, setData] = useState<Affiliate | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/account/affiliate', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((body: Affiliate) => setData(body))
      .catch(() => undefined)
    return () => controller.abort()
  }, [token])

  if (!data?.enabled || !data.link) return null
  const days = data.days || 7

  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.link!)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* navegador sem área de transferência: o link continua visível para copiar à mão */
    }
  }

  return (
    <section className="six-panel six-affiliate" aria-labelledby="six-affiliate-title">
      <div className="six-panel-head">
        <div>
          <h2 id="six-affiliate-title">
            <Gift size={18} aria-hidden="true" /> Indique e ganhe dias
          </h2>
          <p>
            Cada pagamento de quem você indicar, inclusive as renovações, dá <strong>+{days} dias</strong> de acesso para você.
          </p>
        </div>
      </div>

      <div className="six-affiliate-link">
        <code>{data.link}</code>
        <button type="button" className="six-primary" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="six-affiliate-hint">
        Vale para quem cria a conta pelo seu link e ainda não é cliente. Os dias entram sozinhos no seu plano e na validade da sua chave.
      </p>

      <div className="six-affiliate-stats">
        <div>
          <strong>{data.referred || 0}</strong>
          <span>{(data.referred || 0) === 1 ? 'conta indicada' : 'contas indicadas'}</span>
        </div>
        <div>
          <strong>{data.paying || 0}</strong>
          <span>{(data.paying || 0) === 1 ? 'já pagou' : 'já pagaram'}</span>
        </div>
        <div>
          <strong>+{data.totalDays || 0}</strong>
          <span>dias ganhos</span>
        </div>
      </div>

      {data.rewards && data.rewards.length > 0 && (
        <ul className="six-affiliate-list">
          {data.rewards.map((r, i) => (
            <li key={`${r.at}-${i}`} className={r.revoked ? 'is-revoked' : ''}>
              <span>{date(r.at)}</span>
              <span>{r.revoked ? `${plural(r.days, 'dia', 'dias')} retirados (pagamento estornado)` : `+${plural(r.days, 'dia', 'dias')}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
