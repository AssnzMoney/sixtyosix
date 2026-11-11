import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Phone, Mail, ArrowRight, ShieldCheck, Check } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { accountDestination } from '../lib/authDestination'
import { maskWhatsappInput, normalizeWhatsapp } from '../lib/whatsapp'
import './onboarding.css'

const GoogleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
      fill="#EA4335"
    />
  </svg>
)

const DiscordIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#5865F2">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isEditing = searchParams.get('edit') === 'true'
  const { user, loading, updateProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const filled = useRef(false)

  // Sugestão a partir do primeiro nome do provedor ou do e-mail
  const suggestedName = user?.rawName
    ? user.rawName.trim().split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : 'Dev'
  // Conta antiga: já escolheu o nome, falta só o WhatsApp
  const onlyWhatsapp = Boolean(user?.customName && !user?.whatsapp && !isEditing)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login')
      return
    }
    if (user.hasCompletedOnboarding && !isEditing) {
      navigate(accountDestination(true))
      return
    }
    if (!filled.current) {
      filled.current = true
      setDisplayName(user.customName || '')
      setWhatsapp(user.whatsapp ? maskWhatsappInput(user.whatsapp) : '')
    }
  }, [user, loading, isEditing, navigate])

  const phoneDigits = normalizeWhatsapp(whatsapp)
  const canSubmit = Boolean(displayName.trim()) && Boolean(phoneDigits) && !submitting

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setError('Informe como gostaria de ser chamado.')
      return
    }
    if (displayName.trim().length > 30) {
      setError('O nome pode ter no máximo 30 caracteres.')
      return
    }
    if (!phoneDigits) {
      setError('Informe um WhatsApp válido com DDD, por exemplo (81) 99237-6036.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await updateProfile({ name: displayName, whatsapp: phoneDigits })
      navigate(isEditing ? '/dashboard' : accountDestination(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar seus dados.')
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="six-onb-loading" role="status">
        <span className="six-onb-spinner" aria-hidden="true" />
        Carregando sua conta…
      </div>
    )
  }

  const providerLabel = user.provider === 'google' ? 'Google' : user.provider === 'discord' ? 'Discord' : 'e-mail'

  return (
    <main className="six-onb">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="six-onb-card"
        aria-labelledby="six-onb-title"
      >
        <img src="/assets/sidebar-logo.png" alt="SixtySix" className="six-onb-logo" />

        <div className="six-onb-account">
          <span className="six-onb-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              (user.name || 'U').charAt(0).toUpperCase()
            )}
            <span className="six-onb-provider" aria-hidden="true">
              {user.provider === 'google' ? <GoogleIcon /> : user.provider === 'discord' ? <DiscordIcon /> : <Mail size={11} />}
            </span>
          </span>
          <span className="six-onb-account-text">
            <small>
              <ShieldCheck size={13} /> Conectado com {providerLabel}
            </small>
            <strong>{user.email}</strong>
          </span>
        </div>

        <span className="six-onb-eyebrow">
          {isEditing ? 'seu perfil' : onlyWhatsapp ? 'falta pouco' : 'primeiro acesso'}
        </span>
        <h1 id="six-onb-title" className="six-onb-title">
          {isEditing ? (
            <>
              Seus <em>dados.</em>
            </>
          ) : onlyWhatsapp ? (
            <>
              Falta só seu <em>WhatsApp.</em>
            </>
          ) : (
            <>
              Como podemos <em>te chamar?</em>
            </>
          )}
        </h1>
        <p className="six-onb-sub">
          Seu nome aparece no painel. Seu WhatsApp é por onde entregamos sua chave, a URL de configuração e o suporte.
        </p>

        <form onSubmit={handleSubmit} className="six-onb-form" noValidate>
          <div className="six-onb-field">
            <label htmlFor="six-onb-name">Nome ou apelido</label>
            <div className="six-onb-input">
              <User size={18} aria-hidden="true" />
              <input
                id="six-onb-name"
                type="text"
                autoComplete="nickname"
                autoFocus={!onlyWhatsapp}
                maxLength={30}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Ex.: Alysson, Neo, DevMax"
              />
              <span className="six-onb-count">{displayName.length}/30</span>
            </div>
            {!displayName.trim() && (
              <div className="six-onb-suggestions">
                <span>Sugestão:</span>
                <button type="button" onClick={() => setDisplayName(suggestedName)}>
                  {suggestedName}
                </button>
                {user.rawName && user.rawName !== suggestedName && (
                  <button type="button" onClick={() => setDisplayName(user.rawName || '')}>
                    {user.rawName}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="six-onb-field">
            <label htmlFor="six-onb-whatsapp">Seu WhatsApp</label>
            <div className={`six-onb-input ${whatsapp && !phoneDigits ? 'is-invalid' : ''}`}>
              <Phone size={18} aria-hidden="true" />
              <input
                id="six-onb-whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus={onlyWhatsapp}
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(maskWhatsappInput(e.target.value))
                  if (error) setError(null)
                }}
                placeholder="(81) 99999-9999"
                aria-describedby="six-onb-whatsapp-help"
                aria-invalid={Boolean(whatsapp && !phoneDigits)}
              />
              {phoneDigits && <Check size={18} className="six-onb-ok" aria-label="Número válido" />}
            </div>
            <p id="six-onb-whatsapp-help" className="six-onb-help">
              Com DDD. Usamos para entregar sua chave e a URL de configuração, e para dar suporte.
            </p>
          </div>

          {error && (
            <p className="six-onb-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={!canSubmit} className="six-onb-submit">
            <span>{submitting ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Salvar e continuar'}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        <p className="six-onb-note">
          <Check size={14} aria-hidden="true" />
          <span>
            Seus dados são usados para entregar suas credenciais e dar suporte, conforme a{' '}
            <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">
              Política de Privacidade
            </a>
            . Você pode alterá-los a qualquer momento no seu painel.
          </span>
        </p>
      </motion.section>
    </main>
  )
}
