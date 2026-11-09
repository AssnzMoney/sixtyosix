import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  Sparkles,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

const GoogleIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const {
    user,
    isConfigured,
    signInWithGoogle,
    signInWithDiscord,
    signInWithEmail,
    verifyEmailOtp,
    signOut,
    demoLogin,
  } = useAuth()

  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)

  const handleGoogleLogin = async () => {
    setErrorMsg(null)
    setLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setLoading(false)
      if (error.message.includes('CONFIG_NEEDED')) {
        setShowConfigModal(true)
      } else {
        setErrorMsg(error.message)
      }
    }
  }

  const handleDiscordLogin = async () => {
    setErrorMsg(null)
    setLoading(true)
    const { error } = await signInWithDiscord()
    if (error) {
      setLoading(false)
      if (error.message.includes('CONFIG_NEEDED')) {
        setShowConfigModal(true)
      } else {
        setErrorMsg(error.message)
      }
    }
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setErrorMsg(null)
    setLoading(true)

    if (!isConfigured) {
      // Simulação rápida para feedback imediato
      setTimeout(() => {
        setLoading(false)
        setStep('code')
      }, 600)
      return
    }

    const { error } = await signInWithEmail(email)
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      setStep('code')
    }
  }

  const handleCodeChange = (index: number, val: string) => {
    if (val.length > 1) val = val[val.length - 1]
    const newCode = [...code]
    newCode[index] = val
    setCode(newCode)

    // Auto focus next input
    if (val && index < 5) {
      const nextInput = document.getElementById(`digit-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    const token = code.join('')
    if (!isConfigured) {
      setTimeout(() => {
        demoLogin('google')
        setLoading(false)
        navigate('/')
      }, 700)
      return
    }

    const { error } = await verifyEmailOtp(email, token)
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="login-page-wrap">
      <div className="login-split-grid">
        {/* Coluna Esquerda: Formulário de Autenticação */}
        <div className="login-left-col">
          <div className="login-form-box">
            {/* Top Logo */}
            <div className="login-brand-header">
              <Link to="/" className="login-brand-link" aria-label="Voltar para a página inicial">
                <img src="/assets/sidebar-logo.png" alt="SixtySix" className="login-brand-logo" />
              </Link>
            </div>

            {errorMsg && (
              <div className="login-alert-error">
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {user ? (
              /* Usuário já conectado */
              <div className="login-logged-card">
                <div className="login-logged-avatar-wrap">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="login-logged-avatar" />
                  ) : (
                    <div className="login-logged-avatar-fallback">{user.name.charAt(0)}</div>
                  )}
                  <span className={`login-provider-tag tag-${user.provider}`}>
                    {user.provider === 'google' ? 'Google' : user.provider === 'discord' ? 'Discord' : 'E-mail'}
                  </span>
                </div>

                <h1 className="login-title">Olá, {user.name}!</h1>
                <p className="login-sub">
                  Você já está autenticado na SixtySix com a conta <strong>{user.email}</strong>.
                </p>

                <div className="login-logged-actions">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="login-submit-btn is-ready"
                  >
                    Acessar Plataforma
                  </button>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="login-signout-btn"
                  >
                    <LogOut size={16} />
                    <span>Desconectar desta conta</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Login */
              <AnimatePresence mode="wait">
                {step === 'email' ? (
                  <motion.div
                    key="step-email"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h1 className="login-title">Boas vindas à SixtySix</h1>
                    <p className="login-sub">
                      Acesse sua chave individual e programe sem travas diárias. Todos os seus modelos oficiais conectados em um só lugar.
                    </p>

                    {/* Botões Sociais: Google & Discord */}
                    <div className="login-social-group">
                      <button
                        type="button"
                        className="login-google-btn"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                      >
                        <GoogleIcon />
                        <span>Entrar com Google</span>
                      </button>

                      <button
                        type="button"
                        className="login-discord-btn"
                        onClick={handleDiscordLogin}
                        disabled={loading}
                      >
                        <DiscordIcon />
                        <span>Entrar com Discord</span>
                      </button>
                    </div>

                    <div className="login-divider">
                      <span>Ou entre com e-mail</span>
                    </div>

                    {/* Formulário com E-mail */}
                    <form onSubmit={handleSendCode} className="login-form">
                      <div className="login-input-group">
                        <label htmlFor="login-email" className="login-label">
                          E-mail de acesso
                        </label>
                        <input
                          id="login-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="voce@exemplo.com"
                          className="login-input"
                          autoComplete="email"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !email.includes('@')}
                        className={`login-submit-btn ${email.includes('@') ? 'is-ready' : ''}`}
                      >
                        {loading ? 'Processando...' : 'Enviar código'}
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-code"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      type="button"
                      className="login-back-btn"
                      onClick={() => setStep('email')}
                    >
                      <ArrowLeft size={16} />
                      <span>Alterar e-mail</span>
                    </button>

                    <h1 className="login-title">Código de Acesso</h1>
                    <p className="login-sub">
                      Enviamos um código de 6 dígitos para <strong>{email}</strong>.
                    </p>

                    <form onSubmit={handleVerify} className="login-form">
                      <div className="login-digits-row">
                        {code.map((digit, idx) => (
                          <input
                            key={idx}
                            id={`digit-${idx}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && !code[idx] && idx > 0) {
                                const prev = document.getElementById(`digit-${idx - 1}`)
                                prev?.focus()
                              }
                            }}
                            className="login-digit-input"
                          />
                        ))}
                      </div>

                      <button
                        type="submit"
                        disabled={loading || code.some((d) => !d)}
                        className={`login-submit-btn ${code.every((d) => d) ? 'is-ready' : ''}`}
                      >
                        {loading ? 'Verificando...' : 'Acessar Plataforma'}
                      </button>

                      <div className="login-resend-row">
                        <button
                          type="button"
                          onClick={handleSendCode}
                          className="login-resend-btn"
                        >
                          Não recebeu? Reenviar código
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <p className="login-footer-terms">
              Ao criar uma conta, você concorda com nossos{' '}
              <a href="/#duvidas" target="_blank" rel="noopener noreferrer">termos e condições</a>.
            </p>

            <div className="login-return-box">
              <Link to="/" className="login-return-link">
                ← Voltar para o site
              </Link>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Showcase com Arte Renascentista estilo AbacatePay */}
        <div className="login-right-col">
          <div className="login-showcase-panel">
            {/* Pill superior estilo AbacatePay */}
            <div className="login-art-pill">
              Sem mensalidade em Dólar. Aprovação imediata no Pix.
            </div>

            {/* Composição Clássica estilo AbacatePay (As duas donzelas com a SixtySix) */}
            <motion.div
              className="login-art-stage"
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <img
                src="/assets/login-artwork-composite.webp"
                alt="Composição Renascentista SixtySix"
                className="login-art-composite-img"
              />
            </motion.div>

            {/* Texto de Impacto Inferior com Slides */}
            <div className="showcase-bottom-copy">
              <AnimatePresence mode="wait">
                {activeSlide === 0 ? (
                  <motion.div
                    key="slide-0"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="showcase-headline">
                      Codifique sem cortes de cota, <br />
                      <span className="showcase-green">direto na sua IDE favorita</span>
                    </h2>
                    <p className="showcase-sub">
                      Conecte sua chave própria no Cursor, Claude Code ou VS Code com latência mínima e preço fixo no Pix.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="slide-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h2 className="showcase-headline">
                      Três modelos de ponta, <br />
                      <span className="showcase-green">zero rateio de chave</span>
                    </h2>
                    <p className="showcase-sub">
                      Claude Fable 5.1, GPT Astra 6 e GLM-4 Plus com estabilidade de 99.9% e sem surpresas na fatura em Dólar.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dots de Paginação */}
              <div className="showcase-dots">
                <button
                  type="button"
                  aria-label="Slide 1"
                  className={`showcase-dot ${activeSlide === 0 ? 'is-active' : ''}`}
                  onClick={() => setActiveSlide(0)}
                />
                <button
                  type="button"
                  aria-label="Slide 2"
                  className={`showcase-dot ${activeSlide === 1 ? 'is-active' : ''}`}
                  onClick={() => setActiveSlide(1)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Conexão das Chaves / Modo de Teste */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="login-modal-overlay" onClick={() => setShowConfigModal(false)}>
            <motion.div
              className="login-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
            >
              <div className="login-modal-header">
                <div className="login-modal-badge">
                  <Sparkles size={16} />
                  <span>Conectar OAuth Real</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="login-modal-close"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="login-modal-title">Como ativar o Google & Discord Oficial</h3>
              <p className="login-modal-desc">
                O código de autenticação já está 100% pronto! Para login real com suas contas, adicione as chaves gratuitas do Supabase:
              </p>

              <div className="login-modal-codeblock">
                <code>
                  VITE_SUPABASE_URL=https://seu-projeto.supabase.co<br />
                  VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
                </code>
              </div>

              <div className="login-modal-steps">
                <div className="login-modal-step">
                  <strong>1. Supabase Dashboard:</strong> Acesse Authentication &gt; Providers e ative <strong>Google</strong> e <strong>Discord</strong>.
                </div>
                <div className="login-modal-step">
                  <strong>2. Vercel / .env:</strong> Cole as 2 variáveis de ambiente no projeto.
                </div>
              </div>

              <div className="login-modal-divider">ou experimente o fluxo agora</div>

              <div className="login-modal-demo-btns">
                <button
                  type="button"
                  onClick={() => {
                    demoLogin('google')
                    setShowConfigModal(false)
                    navigate('/')
                  }}
                  className="login-google-btn"
                >
                  <GoogleIcon />
                  <span>Testar Login com Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    demoLogin('discord')
                    setShowConfigModal(false)
                    navigate('/')
                  }}
                  className="login-discord-btn"
                >
                  <DiscordIcon />
                  <span>Testar Login com Discord</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
