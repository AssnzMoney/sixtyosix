import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { CircleCheck, Gift } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { captureReferral, REFERRAL_CODE } from '../lib/referral'
import './trial.css'

/** "abrantes" → "Abrantes"; "joao-silva" → "Joao Silva". O código é o nome que o afiliado usa. */
const displayName = (code: string) => code.split('-').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

/**
 * Página do link de afiliado (www.sixtysix.online/convite/CODIGO). Guarda o convite no navegador e mostra
 * para quem chegou que ele foi convidado, com o caminho para criar a conta. Quando a pessoa entra na conta,
 * o site liga a conta ao afiliado (src/lib/referral.ts); só vale para quem ainda não é cliente.
 */
export default function InvitePage() {
  const { code: raw = '' } = useParams()
  const code = raw.trim().toLowerCase()
  const valid = REFERRAL_CODE.test(code)
  const { session } = useAuth()
  useEffect(() => {
    if (valid) captureReferral(`?ref=${encodeURIComponent(code)}`)
  }, [valid, code])
  if (!valid) return <Navigate to="/" replace />
  const name = displayName(code)

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
          <strong>{name}</strong> te indicou. Aqui você usa o Claude Code, o Codex e os melhores modelos de IA no seu terminal, com planos em
          reais.
        </p>
        <ul className="six-trial-list">
          <li>
            <CircleCheck size={16} aria-hidden="true" /> Fable 5.2, Opus 5.5, Astra 6 e Argon 4 numa chave só.
          </li>
          <li>
            <CircleCheck size={16} aria-hidden="true" /> Funciona no Claude Code, no app Claude, no Codex, no Cline e no OpenCode.
          </li>
          <li>
            <CircleCheck size={16} aria-hidden="true" /> Pague por Pix ou cartão. A chave chega pelo WhatsApp, com o passo a passo.
          </li>
        </ul>
        {session ? (
          <>
            <p className="six-trial-note">
              <CircleCheck size={16} aria-hidden="true" /> Você já está na sua conta. O convite vale para quem ainda não comprou nenhum plano: se
              for o seu caso, ele já foi registrado.
            </p>
            <Link to="/dashboard" className="six-trial-primary">
              Abrir meu painel
            </Link>
            <Link to="/#planos" className="six-trial-secondary">
              Ver os planos
            </Link>
          </>
        ) : (
          <>
            <Link to="/login?mode=cadastro" className="six-trial-primary">
              Criar minha conta
            </Link>
            <Link to="/#planos" className="six-trial-secondary">
              Ver os planos
            </Link>
            <small>O convite fica salvo neste navegador por 30 dias. Crie a conta por aqui para ele valer.</small>
          </>
        )}
      </section>
    </main>
  )
}
