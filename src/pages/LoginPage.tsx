import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check, Sparkles, TrendingUp, Cpu, Key, ShieldCheck, Zap, Activity, Users, ArrowUpRight } from 'lucide-react'

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

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep('code')
    }, 700)
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

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/')
    }, 900)
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
                    Conecte sua chave individual e desenvolva sem travas. Sem taxa de adesão, sem burocracia.
                  </p>

                  {/* Botão Entrar com Google */}
                  <button
                    type="button"
                    className="login-google-btn"
                    onClick={() => {
                      setLoading(true)
                      setTimeout(() => {
                        setLoading(false)
                        navigate('/')
                      }, 800)
                    }}
                  >
                    <GoogleIcon />
                    <span>Entrar com Google</span>
                  </button>

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
                      {loading ? 'Enviando código...' : 'Enviar código'}
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

        {/* Coluna Direita: Showcase com Mockup do Dashboard */}
        <div className="login-right-col">
          <div className="login-showcase-panel">
            {/* Mockup do Dashboard estilo AbacatePay */}
            <motion.div
              className="mockup-window"
              initial={{ opacity: 0, y: 25, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Mini Sidebar */}
              <div className="mockup-sidebar">
                <div className="mockup-sidebar-logo">
                  <div className="mockup-logo-dot" />
                </div>
                <div className="mockup-nav-icon active"><Activity size={16} /></div>
                <div className="mockup-nav-icon"><Cpu size={16} /></div>
                <div className="mockup-nav-icon"><Key size={16} /></div>
                <div className="mockup-nav-icon"><Zap size={16} /></div>
                <div className="mockup-nav-icon"><ShieldCheck size={16} /></div>
              </div>

              {/* Área Principal do Dashboard */}
              <div className="mockup-main">
                {/* Abas Superiores */}
                <div className="mockup-top-tabs">
                  <span className="mockup-tab">Hoje</span>
                  <span className="mockup-tab active">Esse Mês</span>
                  <span className="mockup-tab">Últimos 30 dias</span>
                  <span className="mockup-tab">Personalizar</span>
                </div>

                {/* Grid de KPIs Principais */}
                <div className="mockup-kpis-grid">
                  {/* Card 1: Requisições */}
                  <div className="mockup-kpi-card">
                    <span className="mockup-kpi-label">Requisições</span>
                    <div className="mockup-kpi-val-row">
                      <span className="mockup-kpi-val">8.940</span>
                      <span className="mockup-kpi-badge"><TrendingUp size={12} /> +5%</span>
                    </div>
                  </div>

                  {/* Card 2: Economia no Pix com Moedas 3D */}
                  <div className="mockup-kpi-card mockup-kpi-card-cash">
                    <img src="/assets/plan-cash.webp" alt="Cash" className="mockup-cash-icon" />
                    <div>
                      <span className="mockup-kpi-label">Economia no Pix</span>
                      <div className="mockup-kpi-val-row">
                        <span className="mockup-kpi-val highlight-green">R$ 3.500<small>,00</small></span>
                        <span className="mockup-kpi-badge"><TrendingUp size={12} /> +5%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Faixa Secundária de Métricas */}
                <div className="mockup-metrics-strip">
                  <div className="mockup-mini-metric">
                    <span className="mini-metric-label">Total de Prompts</span>
                    <strong className="mini-metric-val">10 <span className="mini-badge">+5%</span></strong>
                  </div>
                  <div className="mockup-mini-metric">
                    <span className="mini-metric-label">Novos Modelos</span>
                    <strong className="mini-metric-val">5 <span className="mini-badge">+5%</span></strong>
                  </div>
                  <div className="mockup-mini-metric">
                    <span className="mini-metric-label">Plano mais usado</span>
                    <strong className="mini-metric-val">Pro Ilimitado</strong>
                  </div>
                  <div className="mockup-mini-metric">
                    <span className="mini-metric-label">Uptime</span>
                    <strong className="mini-metric-val">99.9%</strong>
                  </div>
                  <div className="mockup-mini-metric">
                    <span className="mini-metric-label">Latência</span>
                    <strong className="mini-metric-val">25ms</strong>
                  </div>
                </div>

                {/* Mini Gráfico / Indicadores de Desempenho */}
                <div className="mockup-graph-card">
                  <div className="mockup-graph-header">
                    <span>Desempenho de requisições</span>
                    <span className="mockup-graph-tag">Em tempo real</span>
                  </div>
                  <div className="mockup-bars-wrap">
                    {[38, 52, 45, 68, 62, 85, 78, 92, 88, 100, 94, 98].map((h, i) => (
                      <div key={i} className="mockup-bar-col">
                        <div
                          className="mockup-bar"
                          style={{ height: `${h}%`, opacity: i >= 8 ? 1 : 0.45 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
                      Gerencie seu cluster inteiro, <br />
                      <span className="showcase-green">não só os pagamentos</span>
                    </h2>
                    <p className="showcase-sub">
                      Controle as principais métricas do seu negócio e modelos em tempo real.
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
                      <span className="showcase-green">um só ecossistema no Pix</span>
                    </h2>
                    <p className="showcase-sub">
                      Claude Fable 5.1, GPT Astra 6 e GLM-4 Plus sem limites e com latência recorde.
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
    </div>
  )
}
