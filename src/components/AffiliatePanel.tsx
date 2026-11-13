import { useEffect, useState } from 'react'
import { Check, Copy, Gift } from 'lucide-react'

export type Affiliate = {
  enabled: boolean
  code?: string
  link?: string
  days?: number
  referred?: number
  paying?: number
  totalDays?: number
  referredDays?: number
  rewards?: { at: string; days: number; revoked: boolean; whatsapp?: boolean }[]
}

const date = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Dados de afiliado da conta (/api/account/affiliate). Falha ou conta comum: { enabled: false }. */
export function useAffiliate(token: string | undefined) {
  const [data, setData] = useState<Affiliate | null>(null)
  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    fetch('/api/account/affiliate', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((body: Affiliate) => setData(body))
      .catch(() => undefined)
    return () => controller.abort()
  }, [token])
  return data
}

// "v2": o aviso volta a aparecer uma vez para quem já tinha fechado (o afiliado pediu para ver de novo).
const seenKey = (code: string) => `six-affiliate-seen-v2-${code}`
/** Abre o aviso de novo (botão "Ver o aviso de novo" na aba Indicações). */
const REOPEN = 'six-affiliate-welcome-open'
export const showAffiliateWelcome = () => window.dispatchEvent(new Event(REOPEN))

/**
 * Aviso na primeira entrada do afiliado neste aparelho: conta que ele agora tem um link de indicação.
 * Usa o mesmo visual do pop-up de confirmação da chave e nunca aparece junto com ele (`blocked`).
 */
export function AffiliateWelcome({ data, blocked, onOpen }: { data: Affiliate | null; blocked: boolean; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!data?.enabled || !data.code || blocked) return
    try { if (!localStorage.getItem(seenKey(data.code))) setOpen(true) } catch { /* sem armazenamento: não mostra */ }
  }, [data, blocked])
  useEffect(() => {
    const reopen = () => { setCopied(false); setOpen(true) }
    window.addEventListener(REOPEN, reopen)
    return () => window.removeEventListener(REOPEN, reopen)
  }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!open || blocked || !data?.link || !data.code) return null
  function close() {
    try { localStorage.setItem(seenKey(data!.code!), String(Date.now())) } catch { /* ignora */ }
    setOpen(false)
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.link!)
      setCopied(true)
    } catch { /* o link continua visível */ }
  }
  const days = data.days || 7
  return (
    <div className="six-confirm-gate" role="dialog" aria-modal="true" aria-labelledby="six-affiliate-welcome-title" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="six-confirm-gate-card six-affiliate-welcome">
        <span className="six-step-badge">
          <Gift size={13} aria-hidden="true" /> Novidade na sua conta
        </span>
        <h2 id="six-affiliate-welcome-title">Agora você é afiliado da SixtySix</h2>
        <p>
          Você ganhou um link e um código de indicação (<strong>{data.code.toUpperCase()}</strong>). Quem assinar com eles ganha
          {data.referredDays ? <strong> +{data.referredDays} dias</strong> : ' dias'} de bônus, e você ganha <strong>+{days} dias</strong> a cada
          pagamento dessa pessoa, inclusive as renovações, direto no seu plano e na validade da sua chave.
        </p>
        <div className="six-affiliate-link">
          <a href={data.link} target="_blank" rel="noopener noreferrer" title="Abrir a página do seu convite">
            <code>{data.link}</code>
          </a>
          <button type="button" className="six-primary" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar link'}
          </button>
        </div>
        <p className="six-affiliate-hint">
          O link abre o nosso WhatsApp com a mensagem pronta e o seu código. Vale para quem ainda não é cliente. Você acompanha tudo na aba
          Indicações.
        </p>
        <div className="six-affiliate-welcome-actions">
          <button type="button" className="six-secondary" onClick={close}>
            Entendi
          </button>
          <button type="button" className="six-primary" onClick={() => { close(); onOpen() }}>
            Ver minhas indicações
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * "Indique e ganhe dias": só aparece para as contas que o admin ativou como afiliado.
 * Recebe os dados de useAffiliate: uma falha aqui nunca afeta o resto do painel.
 */
export default function AffiliatePanel({ data }: { data: Affiliate | null }) {
  const [copied, setCopied] = useState(false)

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
            Quem assinar pelo seu link ou com o código <strong>{data.code?.toUpperCase()}</strong> ganha
            {data.referredDays ? <strong> +{data.referredDays} dias</strong> : ' dias'} de bônus, e você ganha <strong>+{days} dias</strong> a cada
            pagamento dessa pessoa, inclusive as renovações.
          </p>
        </div>
      </div>

      <div className="six-affiliate-link">
        <a href={data.link} target="_blank" rel="noopener noreferrer" title="Abrir a página do seu convite">
          <code>{data.link}</code>
        </a>
        <button type="button" className="six-primary" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="six-affiliate-hint">
        O link abre o nosso WhatsApp com a mensagem pronta e o seu código; quem preferir assina pelo site e digita o código no pagamento. Vale para
        quem ainda não é cliente. Os dias entram sozinhos no seu plano e na validade da sua chave.{' '}
        <button type="button" className="six-text-button" onClick={showAffiliateWelcome}>
          Ver o aviso de novo
        </button>
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
              <span>{r.revoked ? `${plural(r.days, 'dia', 'dias')} retirados (pagamento estornado)` : `+${plural(r.days, 'dia', 'dias')}${r.whatsapp ? ' · venda pelo WhatsApp' : ''}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
