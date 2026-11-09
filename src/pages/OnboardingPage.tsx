import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Sparkles, ArrowRight, ShieldCheck, Check } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

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
  const { user, loading, updateDisplayName } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extrai sugestão a partir do primeiro nome ou dados do provedor
  const suggestedName = user?.rawName
    ? user.rawName.trim().split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : 'Dev'

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
      return
    }

    if (!loading && user) {
      if (user.hasCompletedOnboarding && !isEditing) {
        navigate('/dashboard')
        return
      }
      setDisplayName(user.customName || suggestedName)
    }
  }, [user, loading, isEditing, navigate, suggestedName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('Por favor, informe como gostaria de ser chamado.')
      return
    }
    if (trimmed.length > 30) {
      setError('O nome de exibição deve ter no máximo 30 caracteres.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await updateDisplayName(trimmed)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar nome.')
      setSubmitting(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="onboarding-loading-screen">
        <div className="onboarding-loading-spinner" />
      </div>
    )
  }

  return (
    <div className="onboarding-wrapper">
      {/* Esfumado verde na base */}
      <img
        src="/assets/login-bottom-glow.webp"
        alt=""
        className="onboarding-bottom-glow"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="onboarding-card"
      >
        {/* Brand Header */}
        <div className="onboarding-header">
          <img src="/assets/sidebar-logo.png" alt="SixtySix" className="onboarding-brand-logo" />
        </div>

        {/* User Provider Avatar Pill */}
        <div className="onboarding-avatar-section">
          <div className="onboarding-avatar-wrap">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="onboarding-avatar-img" />
            ) : (
              <div className="onboarding-avatar-fallback">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className={`onboarding-provider-badge badge-${user.provider}`}>
              {user.provider === 'google' ? <GoogleIcon /> : <DiscordIcon />}
            </span>
          </div>

          <div className="onboarding-account-info">
            <span className="onboarding-account-pill">
              <ShieldCheck size={13} color="#22c55e" />
              Conta conectada via {user.provider === 'google' ? 'Google' : user.provider === 'discord' ? 'Discord' : 'E-mail'}
            </span>
            <span className="onboarding-account-email">{user.email}</span>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className="onboarding-text-group">
          <span className="onboarding-step-pill">
            <Sparkles size={13} color="#1f4647" />
            {isEditing ? 'Atualizar Perfil' : 'Primeiro Acesso • Quase Pronto'}
          </span>
          <h1 className="onboarding-title">Como gostaria de ser chamado?</h1>
          <p className="onboarding-sub">
            Personalize seu nome de desenvolvedor. Em vez de exibir o nome completo ou tag da conta, é assim que você será identificado na SixtySix e no seu painel.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-field">
            <label htmlFor="display-name-input" className="onboarding-label">
              Seu nome ou apelido de desenvolvedor
            </label>
            <div className="onboarding-input-wrap">
              <User size={18} className="onboarding-input-icon" />
              <input
                id="display-name-input"
                type="text"
                autoFocus
                maxLength={30}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder="Ex: Alysson, Neo, DevMax..."
                className="onboarding-input"
              />
              <span className="onboarding-char-count">{displayName.length}/30</span>
            </div>

            {/* Sugestões Rápidas */}
            <div className="onboarding-suggestions">
              <span className="onboarding-sugg-label">Sugestão:</span>
              <button
                type="button"
                className="onboarding-sugg-pill"
                onClick={() => setDisplayName(suggestedName)}
              >
                {suggestedName}
              </button>
              {user.rawName && user.rawName !== suggestedName && (
                <button
                  type="button"
                  className="onboarding-sugg-pill"
                  onClick={() => setDisplayName(user.rawName || '')}
                >
                  {user.rawName}
                </button>
              )}
            </div>

            {error && <p className="onboarding-error-msg">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting || !displayName.trim()}
            className="onboarding-submit-btn"
          >
            <span>{submitting ? 'Salvando...' : 'Continuar para a Plataforma'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="onboarding-footer-note">
          <Check size={14} color="#16a34a" />
          Você poderá alterar este nome a qualquer momento dentro das configurações da sua Dashboard.
        </p>
      </motion.div>
    </div>
  )
}
