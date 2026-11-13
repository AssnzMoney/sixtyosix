import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CircleCheck, Gift, MessageCircle } from 'lucide-react'
import { captureReferral, REFERRAL_CODE } from '../lib/referral'
import { supportWhatsappLink } from '../lib/whatsapp'
import './trial.css'

/** "abrantes" → "Abrantes"; "joao-silva" → "Joao Silva". O código é o nome que o afiliado usa. */
const displayName = (code: string) => code.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

/**
 * Link de afiliado (www.sixtysix.online/convite/CODIGO). Guarda o convite no navegador e leva a pessoa direto para
 * o WhatsApp da SixtySix com a mensagem pronta e o código, para a venda pelo WhatsApp. Quem preferir assina pelo
 * site: o convite vale do mesmo jeito (src/lib/referral.ts). Indicado ganha `referredDays` na primeira assinatura.
 */
export default function InvitePage() {
  const { code: raw = '' } = useParams()
  const code = raw.trim().toLowerCase()
  const valid = REFERRAL_CODE.test(code)
  const [invite, setInvite] = useState<{ valid: boolean; referredDays?: number } | null>(null)

  useEffect(() => {
    if (!valid) return
    captureReferral(`?ref=${encodeURIComponent(code)}`)
    fetch(`/api/account/invite?code=${encodeURIComponent(code)}`)
      // Só "convite inativo" quando o servidor diz que o código não vale; numa falha passageira, segue com o convite.
      .then((r) => (r.ok ? r.json() : { valid: true }))
      .then(setInvite)
      .catch(() => setInvite({ valid: true }))
  }, [valid, code])

  const name = displayName(code)
  const days = invite?.referredDays || 0
  const message = `Olá! Vim pela indicação do ${name} (código ${code.toUpperCase()}) e quero assinar a SixtySix.${days ? ` Quero os ${days} dias de bônus.` : ''}`
  const whatsapp = supportWhatsappLink(message)

  // Abre o WhatsApp sozinho uma vez por visita; voltando para esta página, ela não abre de novo.
  useEffect(() => {
    if (!invite?.valid) return
    const flag = `six-invite-opened-${code}`
    if (sessionStorage.getItem(flag)) return
    const timer = setTimeout(() => {
      sessionStorage.setItem(flag, '1')
      window.location.assign(whatsapp)
    }, 2500)
    return () => clearTimeout(timer)
  }, [invite?.valid, code, whatsapp])

  if (!valid) return <Navigate to="/" replace />

  if (invite && !invite.valid) {
    return (
      <main className="six-trial-page">
        <section className="six-trial-card">
          <Link to="/" className="six-trial-brand">
            <img src="/assets/sidebar-logo.png" alt="" />
            <span>SixtySix</span>
          </Link>
          <h1>Este convite não está mais ativo.</h1>
          <p>Você ainda pode conhecer a SixtySix e assinar normalmente.</p>
          <Link to="/" className="six-trial-primary">
            Conhecer a SixtySix
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="six-trial-page">
      <section className="six-trial-card">
        <Link to="/" className="six-trial-brand">
          <img src="/assets/sidebar-logo.png" alt="" />
          <span>SixtySix</span>
        </Link>
        <span className="six-trial-pill">
          <Gift size={14} aria-hidden="true" /> Convite de {name}
        </span>
        <h1>
          Você foi convidado para a <em>SixtySix</em>.
        </h1>
        <p>
          <strong>{name}</strong> te indicou.{' '}
          {days ? (
            <>
              Assinando pelo convite, você ganha <strong>+{days} dias</strong> de bônus na sua primeira assinatura.
            </>
          ) : (
            'Fale com a gente para assinar com o convite.'
          )}
        </p>
        <ul className="six-trial-list">
          <li>
            <CircleCheck size={16} aria-hidden="true" /> Claude Code, Codex e os melhores modelos de IA numa chave só.
          </li>
          <li>
            <CircleCheck size={16} aria-hidden="true" /> Pague por Pix e receba a chave pelo WhatsApp, com o passo a passo.
          </li>
        </ul>
        <a className="six-trial-primary" href={whatsapp}>
          <MessageCircle size={17} aria-hidden="true" /> Falar no WhatsApp com o convite
        </a>
        <p className="six-trial-note" style={{ marginTop: 12 }}>
          <MessageCircle size={16} aria-hidden="true" /> Abrindo o WhatsApp com a mensagem pronta e o código <strong>{code.toUpperCase()}</strong>…
        </p>
        <Link to="/login?mode=cadastro" className="six-trial-secondary">
          Prefiro assinar pelo site
        </Link>
        <small>Pelo site, o convite fica salvo neste navegador por 30 dias. Você também pode digitar o código {code.toUpperCase()} na hora de pagar.</small>
      </section>
    </main>
  )
}
