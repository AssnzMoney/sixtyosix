import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { billingRequest, type BillingState } from '../lib/billing'
import { purchaseMessage, supportWhatsappLink } from '../lib/whatsapp'
import './trial.css'
import './billing.css'

// Pedido que voltou do Mercado Pago; sobrevive a um desvio para o login/onboarding.
const PENDING_ORDER = 'sixtysix_pending_order'
const HANDOFF_SECONDS = 5

export default function SubscriptionPage() {
  const { session, user, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState<BillingState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelIntent, setCancelIntent] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const urlOrder = params.get('order')
  useEffect(() => {
    if (urlOrder) sessionStorage.setItem(PENDING_ORDER, urlOrder)
  }, [urlOrder])
  const orderId = urlOrder || sessionStorage.getItem(PENDING_ORDER)

  const chosen =
    data?.subscriptions.find((item) => item.id === orderId) ||
    data?.subscriptions.find((item) => item.active) ||
    data?.subscriptions[0]

  useEffect(() => {
    if (loading) return
    sessionStorage.removeItem('sixtysix_pending_trial')
    sessionStorage.removeItem('sixtysix_pending_purchase')
    if (!session) {
      sessionStorage.setItem('sixtysix_pending_subscription', '1')
      navigate('/login', { replace: true })
      return
    }
    if (!user?.hasCompletedOnboarding) {
      sessionStorage.setItem('sixtysix_pending_subscription', '1')
      navigate('/onboarding', { replace: true })
      return
    }
    sessionStorage.removeItem('sixtysix_pending_subscription')
    const controller = new AbortController()
    let running = false
    async function refresh(sync = false) {
      if (running) return
      running = true
      try {
        const state = await billingRequest<BillingState>(sync ? 'sync' : 'status', sync ? {} : undefined, controller.signal)
        if (!controller.signal.aborted) {
          setData(state)
          setError('')
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Não foi possível consultar sua assinatura.')
      } finally {
        running = false
      }
    }
    void refresh(Boolean(orderId))
    const timer = setInterval(() => void refresh(), 10000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [loading, session?.user.id, user?.hasCompletedOnboarding, navigate, orderId])

  // Pagamento do pedido que acabou de voltar foi aprovado → leva ao WhatsApp uma única vez.
  const justPaid = Boolean(chosen && orderId && chosen.id === orderId && chosen.active)
  const handoffKey = chosen ? `wa_sent_${chosen.id}` : ''
  const whatsappUrl = chosen
    ? supportWhatsappLink(purchaseMessage({ name: user?.name, plan: chosen.name, order: chosen.id, email: user?.email }))
    : supportWhatsappLink('Olá! Quero falar sobre a minha assinatura SixtySix.')

  useEffect(() => {
    if (!justPaid || !handoffKey) return
    if (localStorage.getItem(handoffKey)) {
      sessionStorage.removeItem(PENDING_ORDER)
      return
    }
    setCountdown(HANDOFF_SECONDS)
  }, [justPaid, handoffKey])

  useEffect(() => {
    if (countdown === null) return
    if (countdown <= 0) {
      localStorage.setItem(handoffKey, new Date().toISOString())
      sessionStorage.removeItem(PENDING_ORDER)
      window.location.assign(whatsappUrl)
      return
    }
    const timer = setTimeout(() => setCountdown((value) => (value === null ? null : value - 1)), 1000)
    return () => clearTimeout(timer)
  }, [countdown, handoffKey, whatsappUrl])

  function cancelHandoff() {
    if (handoffKey) localStorage.setItem(handoffKey, new Date().toISOString())
    sessionStorage.removeItem(PENDING_ORDER)
    setCountdown(null)
  }

  function openWhatsapp() {
    if (handoffKey) localStorage.setItem(handoffKey, new Date().toISOString())
    sessionStorage.removeItem(PENDING_ORDER)
    setCountdown(null)
  }

  async function update(action: 'sync' | 'cancel') {
    setBusy(true)
    setError('')
    try {
      const result = await billingRequest<BillingState>(action, action === 'cancel' ? { id: chosen?.id } : {})
      setData(result)
      setCancelIntent(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }

  const date = chosen?.expires ? new Date(chosen.expires).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : ''
  const statusLabel = chosen
    ? chosen.active
      ? 'acesso ativo'
      : chosen.status === 'cancelled'
        ? 'cancelado'
        : chosen.expires
          ? 'período encerrado'
          : 'aguardando pagamento'
    : ''

  return (
    <main className="six-trial-page">
      <section className="six-trial-card">
        <Link to="/dashboard" className="six-trial-brand">
          <img src="/assets/sidebar-logo.png" alt="" />
          <span>SixtySix</span>
        </Link>
        <span className="six-trial-pill">
          <ShieldCheck size={15} /> Minha assinatura
        </span>
        <h1>
          {justPaid ? (
            <>
              Pagamento <em>confirmado!</em>
            </>
          ) : chosen ? (
            `${chosen.name} · ${statusLabel}`
          ) : (
            'Seu espaço para criar.'
          )}
        </h1>
        {error && (
          <p role="alert" className="six-trial-error">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Conferindo sua assinatura…</p>}

        {chosen && chosen.active && (
          <div className="six-trial-handoff">
            <p>
              {justPaid
                ? 'Agora fale com a gente no WhatsApp: é por lá que enviamos sua chave e a URL de configuração.'
                : 'Sua chave e a URL de configuração são enviadas pelo WhatsApp. Precisa de uma nova chave ou de ajuda? Fale com a gente.'}
            </p>
            <a className="six-trial-primary" href={whatsappUrl} onClick={openWhatsapp}>
              <MessageCircle size={18} /> {justPaid ? 'Receber minha chave no WhatsApp' : 'Falar no WhatsApp'}
            </a>
            {countdown !== null && (
              <div className="six-trial-countdown" role="status" aria-live="polite">
                <span>Abrindo o WhatsApp em {countdown}s…</span>
                <button type="button" onClick={cancelHandoff}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}

        {chosen && (
          <>
            <p>
              <strong>
                {chosen.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                {chosen.mode === 'pix' ? ' / 30 dias · Pix.' : '/mês.'}
              </strong>{' '}
              {chosen.active
                ? `Acesso pago até ${date}.`
                : chosen.expires
                  ? `O último período terminou em ${date}.`
                  : 'Aguardando a confirmação do primeiro pagamento.'}
            </p>
            <p>
              {chosen.mode === 'pix'
                ? 'Sem débito automático. Cada novo Pix aprovado acrescenta 30 dias ao acesso.'
                : chosen.status === 'cancelled'
                  ? 'Renovação cancelada. O acesso é mantido até o fim do período já pago.'
                  : 'Cada renovação aprovada atualiza o acesso automaticamente. Sem novo pagamento confirmado, o acesso termina no vencimento.'}
            </p>
            {chosen.active && (
              <Link to="/dashboard" className="six-trial-secondary">
                Abrir meu painel
              </Link>
            )}
            {!chosen.active && chosen.checkoutUrl && (
              <a href={chosen.checkoutUrl} className="six-trial-primary">
                Continuar pagamento
              </a>
            )}
            {chosen.active && chosen.mode === 'pix' && chosen.checkoutUrl && (
              <a href={chosen.checkoutUrl} className="six-trial-secondary">
                Renovar mais 30 dias com Pix
              </a>
            )}
            <button disabled={busy} className="six-trial-secondary" onClick={() => void update('sync')}>
              <RefreshCw size={16} /> {busy ? 'Conferindo…' : 'Atualizar pagamento'}
            </button>
            {chosen.mode !== 'pix' &&
              chosen.status !== 'cancelled' &&
              (!cancelIntent ? (
                <button className="six-trial-guide" onClick={() => setCancelIntent(true)}>
                  Cancelar renovação
                </button>
              ) : (
                <div className="six-trial-cancel">
                  <p>Cancelar as próximas cobranças? Você mantém o acesso até o fim do período já pago.</p>
                  <button disabled={busy} className="six-trial-secondary" onClick={() => void update('cancel')}>
                    Confirmar cancelamento
                  </button>
                  <button className="six-trial-guide" onClick={() => setCancelIntent(false)}>
                    Manter assinatura
                  </button>
                </div>
              ))}
          </>
        )}

        {data && !chosen && (
          <>
            <p>Sua conta ainda não tem uma assinatura. Escolha um plano para continuar.</p>
            <Link to="/planos" className="six-trial-primary">
              Ver planos
            </Link>
            <a href={supportWhatsappLink('Olá! Quero contratar a SixtySix.')} className="six-trial-secondary">
              <MessageCircle size={16} /> Falar no WhatsApp
            </a>
          </>
        )}

        {!!data?.payments.length && (
          <div className="six-billing-history">
            <h2>Seus pagamentos</h2>
            {data.payments.map((p) => (
              <article key={p.id}>
                <strong>{(p.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                <span>
                  {p.status === 'approved'
                    ? 'Aprovado'
                    : p.status === 'refunded'
                      ? 'Estornado'
                      : p.status === 'charged_back'
                        ? 'Contestado'
                        : p.status === 'rejected'
                          ? 'Recusado'
                          : 'Pendente'}
                </span>
                <small>
                  {new Date(p.period_start).toLocaleDateString('pt-BR')} — {new Date(p.period_end).toLocaleDateString('pt-BR')}
                </small>
              </article>
            ))}
          </div>
        )}
        <Link to="/dashboard" className="six-trial-guide">
          Voltar ao painel
        </Link>
      </section>
    </main>
  )
}
