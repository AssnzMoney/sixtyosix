import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { supportWhatsappLink } from '../lib/whatsapp'
import './trial.css'

const TRIAL_MESSAGE = 'Olá! Quero fazer o teste grátis de 3 horas da SixtySix.'

/** O teste grátis é pedido pelo WhatsApp: a chave de 3 horas é criada à mão no Roteador do admin. */
export default function TrialPage() {
  const link = supportWhatsappLink(TRIAL_MESSAGE)
  useEffect(() => {
    sessionStorage.removeItem('sixtysix_pending_trial')
    const timer = setTimeout(() => window.location.replace(link), 1200)
    return () => clearTimeout(timer)
  }, [link])

  return (
    <main className="six-trial-page">
      <section className="six-trial-card">
        <Link to="/" className="six-trial-brand">
          <img src="/assets/sidebar-logo.png" alt="" />
          <span>SixtySix</span>
        </Link>
        <h1>Teste grátis pelo WhatsApp.</h1>
        <p>Peça seu teste de 3 horas com a gente no WhatsApp. Enviamos a chave e a URL de configuração por lá.</p>
        <a className="six-trial-primary" href={link}>
          <MessageCircle size={17} aria-hidden="true" /> Pedir meu teste no WhatsApp
        </a>
        <Link to="/" className="six-trial-secondary">
          Voltar para o site
        </Link>
      </section>
    </main>
  )
}
