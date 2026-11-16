import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, KeyRound, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { billingRequest, type BillingState } from '../lib/billing'
import { supportWhatsappLink } from '../lib/whatsapp'
import { isLocalhost } from '../lib/isLocalhost'
import PaymentMachine, { type Receipt } from '../components/PaymentMachine'
import './trial.css'
import './billing.css'

// Pedido que voltou do Mercado Pago; sobrevive a um desvio para o login/onboarding.
const PENDING_ORDER = 'sixtysix_pending_order'

export default function SubscriptionPage() {
  const { session, user, loading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [data, setData] = useState<BillingState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelIntent, setCancelIntent] = useState(false)
  // Notinha já impressa: mostra os botões depois da animação.
  const [printed, setPrinted] = useState(false)
  // Prévia no computador local: /assinatura?demo=pago (aguarda e aprova) ou ?demo=aguardando.
  const demo = isLocalhost() ? params.get('demo') : null

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
    if (!demo) return
    type Sub = BillingState['subscriptions'][number]
    const base = { id: 'demo-pedido-a1b2c3', name: 'Pro', plan: 'pro', amount: 119.99, api: true, models: [], status: 'approved', mode: 'pix', checkoutUrl: null } as unknown as Sub
    const pending = { ...base, active: false, expires: null } as unknown as Sub
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()
    const paid = { ...base, active: true, expires } as unknown as Sub
    const payment = { id: '1', subscription_id: base.id, status: 'approved', amount_cents: 11999, currency: 'BRL', approved_at: new Date().toISOString(), period_start: new Date().toISOString(), period_end: expires }
    sessionStorage.setItem(PENDING_ORDER, base.id)
    setData({ subscriptions: [pending], payments: [] })
    if (demo !== 'pago') return
    const timer = setTimeout(() => setData({ subscriptions: [paid], payments: [payment] }), 2500)
    return () => clearTimeout(timer)
  }, [demo])

  useEffect(() => {
    if (loading || demo) return
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
    // Voltou do pagamento: confere a cada 4 s até aprovar; fora disso, a cada 10 s.
    const timer = setInterval(() => void refresh(), orderId ? 4000 : 10000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [loading, session?.user.id, user?.hasCompletedOnboarding, navigate, orderId, demo])

  // Pedido que acabou de voltar do Mercado Pago: a maquininha espera o Pix e imprime a notinha quando aprova.
  const returning = Boolean(orderId) && (!data || !chosen || chosen.id === orderId)
  const justPaid = Boolean(chosen && orderId && chosen.id === orderId && chosen.active)
  const whatsappUrl = supportWhatsappLink('Olá! Quero falar sobre a minha assinatura SixtySix.')
  const [waitingSince] = useState(() => Date.now())
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!returning || justPaid) return
    const timer = setInterval(() => setTick((v) => v + 1), 15000)
    return () => clearInterval(timer)
  }, [returning, justPaid])
  const slow = returning && !justPaid && Date.now() - waitingSince > 120000
  useEffect(() => {
    if (!justPaid) return
    // Sem animação (movimento reduzido), os botões aparecem do mesmo jeito.
    const timer = setTimeout(() => setPrinted(true), 3600)
    if (!demo) sessionStorage.removeItem(PENDING_ORDER)
    return () => clearTimeout(timer)
  }, [justPaid, demo])
  const paidAt = chosen ? data?.payments.find((p) => p.subscription_id === chosen.id && p.status === 'approved' && !/^(affiliate|welcome)-/.test(String(p.id))) : undefined
  const receipt: Receipt | null =
    justPaid && chosen
      ? {
          plan: chosen.name,
          amount: chosen.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          method: chosen.mode === 'pix' ? 'Pix' : 'Cartão',
          date: new Date(paidAt?.approved_at || paidAt?.period_start || Date.now()).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          until: chosen.expires ? new Date(chosen.expires).toLocaleDateString('pt-BR') : '',
          order: '#' + chosen.id.replace(/-/g, '').slice(-6).toUpperCase(),
        }
      : null

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
        {returning ? (
          <div className="six-pay-return">
            <h1>
              {justPaid ? (
                <>
                  Pagamento <em>confirmado!</em>
                </>
              ) : (
                'Confirmando seu pagamento…'
              )}
            </h1>
            <p>{justPaid ? 'Tudo certo. Sua chave já está pronta no painel.' : 'Assim que o Mercado Pago confirmar, a notinha sai aqui. Pode levar alguns segundos.'}</p>
            {error && (
              <p role="alert" className="six-trial-error">
                {error}
              </p>
            )}
            <PaymentMachine state={justPaid ? 'aprovado' : 'aguardando'} receipt={receipt} onPrinted={() => setPrinted(true)} />
            {justPaid ? (
              <div className={`six-pay-actions${printed ? ' is-in' : ''}`}>
                <Link to={chosen?.api ? '/dashboard?aba=keys' : '/dashboard'} className="six-trial-primary">
                  {chosen?.api ? (
                    <>
                      <KeyRound size={18} /> Ver minha chave
                    </>
                  ) : (
                    <>
                      Abrir meu painel <ArrowRight size={18} />
                    </>
                  )}
                </Link>
                <Link to="/assinatura" className="six-trial-guide" onClick={() => sessionStorage.removeItem(PENDING_ORDER)}>
                  Ver detalhes da assinatura
                </Link>
              </div>
            ) : (
              <div className="six-pay-actions is-in">
                {slow && <p>Já pagou e ainda não confirmou? O Pix pode demorar alguns minutos. Se passar disso, fale com a gente.</p>}
                <button disabled={busy} className="six-trial-secondary" onClick={() => void update('sync')}>
                  <RefreshCw size={16} /> {busy ? 'Conferindo…' : 'Já paguei, conferir agora'}
                </button>
                {slow && (
                  <a className="six-trial-guide" href={whatsappUrl}>
                    <MessageCircle size={16} /> Falar no WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
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
              {chosen.api ? 'Sua chave fica no painel, em Chaves de API. Precisa de ajuda? Fale com a gente.' : 'Seu plano é usado pelo site. Precisa de ajuda? Fale com a gente.'}
            </p>
            <Link className="six-trial-primary" to={chosen.api ? '/dashboard?aba=keys' : '/dashboard'}>
              {chosen.api ? <><KeyRound size={18} /> Ver minha chave</> : <>Abrir meu painel <ArrowRight size={18} /></>}
            </Link>
            <a className="six-trial-secondary" href={whatsappUrl}>
              <MessageCircle size={16} /> Falar no WhatsApp
            </a>
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
                <strong>
                  {/^(affiliate|welcome)-/.test(String(p.id))
                    ? 'Bônus de indicação'
                    : (p.amount_cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
                <span>
                  {p.status === 'revoked'
                    ? 'Retirado'
                    : p.status === 'approved'
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
          </>
        )}
      </section>
    </main>
  )
}
