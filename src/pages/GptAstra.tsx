import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus, Minus, ChevronDown, Check, X, DollarSign, LogOut } from 'lucide-react'
import { Slider } from '@/components/ui/slider-number-flow'
import NumberRoller from '@/components/ui/number-roller'
import PlanCardWaves from '@/components/ui/plan-card-waves'
import { useAuth } from '../lib/AuthContext'

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const astraFaqs = [
  ['O que significa GPT Astra 6?', 'É o perfil GPT Astra 6 que você seleciona no Codex. O identificador usado na configuração é gpt-6-astra.'],
  ['O GPT Astra 6 funciona no Codex?', 'Sim. No Codex, use o provedor personalizado Responses da SixtySix, a chave individual e o ID gpt-6-astra. Siga o arquivo config.toml mostrado nesta página.'],
  ['Posso usar GLM no Codex?', 'Não pela configuração atual do gateway. O catálogo do Codex aceita somente gpt-6-astra. O perfil GLM 5 é separado e deve ser usado no ZCode.'],
  ['Qual é a URL e como informo a chave?', 'A URL base é https://www.sixtysix.online/v1. Salve sua chave individual na variável SIXTYSIX_GATEWAY_API_KEY do Windows e referencie essa variável no config.toml; não cole a chave diretamente nesse arquivo.'],
  ['O Codex pode usar ferramentas?', 'A rota dá suporte a respostas em streaming e chamadas de ferramentas padrão. Recursos exclusivos da OpenAI, incluindo web search, imagem e áudio, não fazem parte desse perfil.'],
  ['Há limite de uso garantido?', 'Não há garantia de disponibilidade ou uso ilimitado. As cotas e o desempenho dependem do pool compartilhado e podem variar.'],
]

export default function GptAstraPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const { user, signOut } = useAuth()
  const [calcUsd, setCalcUsd] = useState(100)
  const [devWithApi, setDevWithApi] = useState(false)

  // Cotação real do Dólar no cartão (comercial + IOF + Spread bancário):
  const commercialDollar = 5.85
  const iofRate = 0.0438
  const cardSpread = 0.045
  const effectiveDollarRate = commercialDollar * (1 + iofRate + cardSpread) // ~R$ 6.37

  const totalAnthropicBRL = calcUsd * effectiveDollarRate
  const sixtySixCost = calcUsd <= 60 ? (devWithApi ? 94.99 : 79.99) : 119
  const sixtySixPlanName = calcUsd <= 60 ? 'Dev' : 'Pro Ilimitado'

  const savingsBRL = Math.max(0, totalAnthropicBRL - sixtySixCost)
  const savingsPercent = Math.round((savingsBRL / totalAnthropicBRL) * 100)
  const savingsMultiplier = (totalAnthropicBRL / sixtySixCost).toFixed(1)

  const presetLevels = [
    { label: 'US$ 30', value: 30 },
    { label: 'US$ 60', value: 60 },
    { label: 'US$ 100', value: 100 },
    { label: 'US$ 150', value: 150 },
    { label: 'US$ 250', value: 250 },
  ]

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.nav-dropdown-trigger') && !target.closest('.mega-menu-panel')) {
        setMegaMenuOpen(false)
      }
      if (!target.closest('.nav-mobile-toggle') && !target.closest('.nav-mobile-drawer')) {
        setMobileMenuOpen(false)
      }
    }
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(text)
    setTimeout(() => {
      setCopiedSnippet(null)
    }, 2000)
  }

  return (
    <main>
      {/* Top Navbar */}
      <header
        className={`nav-wrapper ${isScrolled ? 'nav-scrolled' : ''}`}
        onMouseLeave={() => setMegaMenuOpen(false)}
      >
        <nav className="nav">
          <div className="nav-left">
            <Link className="brand" to="/" aria-label="SixtySix, início">
              <img src="/assets/sidebar-logo.png" alt="SixtySix" className="brand-logo-img" />
            </Link>
            <div className="nav-links">
              <div
                className="nav-dropdown-trigger"
                onMouseEnter={() => setMegaMenuOpen(true)}
              >
                <button
                  type="button"
                  className={`nav-link-dropdown ${megaMenuOpen ? 'active' : ''}`}
                  onClick={() => setMegaMenuOpen(!megaMenuOpen)}
                  aria-expanded={megaMenuOpen}
                >
                  Produtos
                  <ChevronDown className={`nav-chevron ${megaMenuOpen ? 'rotate' : ''}`} size={13} />
                </button>
              </div>
              <a href="#como-conectar-astra">Como conectar</a>
              <a href="#calculadora-astra">Calculadora</a>
              <a href="#planos-astra">Preço</a>
              <a href="#duvidas-astra">Dúvidas</a>
            </div>
          </div>
          <div className="nav-right">
            {user ? (
              <div className="nav-user-logged">
                <Link to="/login" className="nav-user-badge" title={`Conectado como ${user.email}`}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="nav-user-avatar" />
                  ) : (
                    <div className="nav-user-avatar-initial">{user.name.charAt(0)}</div>
                  )}
                  <span className="nav-user-name">{user.name.split(' ')[0]}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="nav-user-logout"
                  title="Sair da conta"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="nav-login-link">
                  Entrar
                </Link>
                <a href="#planos-astra" className="nav-cta-btn">
                  <span>Começar no Pix</span>
                  <Arrow />
                </a>
              </>
            )}
            <button
              className="nav-mobile-toggle"
              aria-label="Abrir menu de navegação"
              onClick={(e) => {
                e.stopPropagation()
                setMobileMenuOpen(!mobileMenuOpen)
              }}
            >
              <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </nav>

        {/* Drawer Mobile */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="nav-mobile-drawer"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="nav-mobile-drawer-inner">
                <div className="nav-mobile-top-brand">
                  <Link to="/" onClick={() => setMobileMenuOpen(false)}>
                    <img src="/assets/sidebar-logo.png" alt="SixtySix" className="sidebar-brand-logo" />
                  </Link>
                </div>
                <div className="nav-mobile-group">
                  <span className="nav-mobile-group-title">Perfis de IA</span>
                  <Link
                    to="/astra-6"
                    className="nav-mobile-item"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="nav-mobile-item-head">
                      <strong>GPT Astra 6</strong>
                    </div>
                    <small>Velocidade ultra-rápida e respostas de texto e ferramentas padrão</small>
                  </Link>
                  <Link
                    to="/claude-code"
                    className="nav-mobile-item"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="nav-mobile-item-head">
                      <strong>Claude Fable 5.1</strong>
                    </div>
                    <small>Raciocínio profundo e Claude Code ilimitado</small>
                  </Link>
                  <Link
                    to="/"
                    className="nav-mobile-item"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="nav-mobile-item-head">
                      <strong>Página Inicial</strong>
                    </div>
                    <small>Visão geral de todos os modelos e planos</small>
                  </Link>
                </div>

                <div className="nav-mobile-links">
                  <a
                    href="#como-conectar-astra"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Como conectar
                  </a>
                  <a
                    href="#calculadora-astra"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Calculadora Dólar vs Pix
                  </a>
                  <a
                    href="#planos-astra"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Planos GPT Astra 6
                  </a>
                  <a
                    href="#duvidas-astra"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dúvidas frequentes
                  </a>
                </div>

                <div className="nav-mobile-actions">
                  <a
                    href="#planos-astra"
                    className="nav-mobile-btn-primary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Garantir no Pix <Arrow />
                  </a>
                  <Link
                    to="/"
                    className="nav-mobile-btn-secondary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Entrar na plataforma
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mega Menu Dropdown */}
        {megaMenuOpen && (
          <div
            className="mega-menu-panel"
            onMouseEnter={() => setMegaMenuOpen(true)}
          >
            <div className="mega-menu-grid">
              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Perfis de IA</span>
                <div className="mega-menu-items">
                  <Link
                    to="/astra-6"
                    className="mega-menu-item"
                    onClick={() => {
                      setMegaMenuOpen(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <strong>GPT Astra 6</strong>
                    <span>Velocidade ultra-rápida e respostas de texto e ferramentas padrão.</span>
                  </Link>
                  <Link
                    to="/claude-code"
                    className="mega-menu-item"
                    onClick={() => {
                      setMegaMenuOpen(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <strong>Claude Fable 5.1</strong>
                    <span>Raciocínio profundo e código de alta complexidade.</span>
                  </Link>
                  <Link to="/glm-4" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GLM-4 Plus</strong>
                    <span>Excelente em refatoração, documentação e testes.</span>
                  </Link>
                  <a href="/#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Conexão pelo Gateway</strong>
                    <span>A disponibilidade e as cotas dependem do pool compartilhado.</span>
                  </a>
                </div>
              </div>

              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Onde Você Já Codifica</span>
                <div className="mega-menu-items">
                  <a href="#como-conectar-astra" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Cursor IDE</strong>
                    <span>Substitua sua chave de API e programe sem interrupção.</span>
                  </a>
                  <a href="#como-conectar-astra" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>VS Code (Cline & Roo)</strong>
                    <span>Suporte nativo aos melhores assistentes do mercado.</span>
                  </a>
                  <a href="#como-conectar-astra" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Codex & Terminal</strong>
                    <span>Ambientes de desenvolvimento com contexto estendido.</span>
                  </a>
                  <Link to="/claude-code" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Claude Code CLI</strong>
                    <span>Agentes autônomos no seu terminal sem travas de cotas.</span>
                  </Link>
                </div>
              </div>

              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Diferenciais SixtySix</span>
                <div className="mega-menu-items">
                  <a href="/#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Uso conforme cotas</strong>
                    <span>As cotas e a disponibilidade podem variar.</span>
                  </a>
                  <a href="/#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Zero Rateio & Chave Própria</strong>
                    <span>Sua chave individual, garantindo sigilo e estabilidade.</span>
                  </a>
                  <a href="#planos-astra" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Economia no Pix</strong>
                    <span>Preço fixo em Reais sem surpresas de cotação ou IOF.</span>
                  </a>
                  <a href="#duvidas-astra" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Suporte Humanizado</strong>
                    <span>Ajuda técnica rápida pelo WhatsApp quando precisar.</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="mega-menu-footer">
              <a href="#planos-astra" className="mega-footer-link" onClick={() => setMegaMenuOpen(false)}>
                Ver todos os planos disponíveis <Arrow />
              </a>
              <a href="#calculadora-astra" className="mega-footer-link" onClick={() => setMegaMenuOpen(false)}>
                Simular economia na calculadora de tokens <Arrow />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section no Estilo Exato da AbacatePay */}
      <section className="claude-hero-section shell">
        <div className="claude-hero-grid">
          {/* Coluna de Texto & Ações */}
          <motion.div
            className="claude-hero-content"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="hero-abacate-badge"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="hero-abacate-dot" />
              <span>GPT Astra 6 no Codex</span>
            </motion.div>

            <h1 className="hero-abacate-title">
              <motion.span
                className="hero-title-block"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                O poder total do <em>GPT Astra 6.</em>
              </motion.span>
              <motion.span
                className="hero-title-block"
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.0, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                Velocidade recorde no Cursor.
              </motion.span>
            </h1>

            <motion.p
              className="hero-abacate-subtitle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.0, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              Desenvolva com respostas de texto e ferramentas padrão ultra-rápida conectando sua chave individual SixtySix diretamente no <strong>Cursor</strong>, <strong>VS Code (Cline & Roo)</strong> ou <strong>Codex</strong>. As cotas e a disponibilidade podem variar e com preço fixo em Reais via Pix.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onMouseLeave={() => setHeroAction('primary')}
            >
              <a
                href="#planos-astra"
                className={`hero-action-pill ${heroAction === 'primary' ? 'is-active' : ''}`}
                onMouseEnter={() => setHeroAction('primary')}
                onClick={() => setHeroAction('primary')}
              >
                {heroAction === 'primary' && (
                  <motion.div
                    layoutId="astra-hero-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Começar no Pix <Arrow />
                </span>
              </a>

              <a
                href="#como-conectar-astra"
                className={`hero-action-pill ${heroAction === 'secondary' ? 'is-active' : ''}`}
                onMouseEnter={() => setHeroAction('secondary')}
                onClick={() => setHeroAction('secondary')}
              >
                {heroAction === 'secondary' && (
                  <motion.div
                    layoutId="astra-hero-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Ver comandos <Arrow />
                </span>
              </a>
            </motion.div>

            <motion.p
              className="hero-abacate-footnote"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.0, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              Sem mensalidade surpresa. Chave própria com Zero Rateio.
            </motion.p>
          </motion.div>

          {/* Coluna da Arte & Badges Flutuantes (Estilo AbacatePay) */}
          <motion.div
            className="hero-abacate-art-col"
            initial={{ opacity: 0, x: 80, scale: 0.93 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hero-art-stage">
              {/* Anotação estilo manuscrito com seta curvada */}
              <motion.div
                className="hero-handwritten-wrap hero-handwritten-astra"
                initial={{ opacity: 0, scale: 0.8, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="hero-handwritten-text">o segredo dos deuses:</span>
                <svg
                  className="hero-handwritten-arrow"
                  width="36"
                  height="46"
                  viewBox="0 0 36 46"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2 C 5 14, 7 28, 28 38"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19 38 L 29 38 L 28 27"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>

              {/* Arte Filósofo com Mascote SX */}
              <motion.img
                src="/assets/astra-statue.webp"
                alt="Filósofo com mascote SixtySix"
                className="hero-abacate-artwork"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.15, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              />

              {/* Badge Flutuante Esquerda */}
              <motion.div
                className="floating-badge floating-badge-left"
                initial={{ opacity: 0, y: 30, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.85, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="floating-badge-icon badge-icon-check">
                  <Check size={18} strokeWidth={2.5} />
                </div>
                <div className="floating-badge-copy">
                  <span className="floating-badge-label">GPT Astra 6 · agora</span>
                  <span className="floating-badge-val">
                    <strong>Cotas compartilhadas</strong>
                    <span className="badge-pill-green">Ativo</span>
                  </span>
                </div>
              </motion.div>

              {/* Badge Flutuante Direita */}
              <motion.div
                className="floating-badge floating-badge-right"
                initial={{ opacity: 0, y: 30, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.85, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="floating-badge-icon badge-icon-pix">
                  <DollarSign size={18} strokeWidth={2.4} />
                </div>
                <div className="floating-badge-copy">
                  <span className="floating-badge-label">Preço fixo no Pix</span>
                  <span className="floating-badge-val">
                    <strong>Sem IOF cambial</strong>
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Faixa de Métricas / Diferenciais estilo AbacatePay */}
      <section className="abacate-stats-section shell">
        <motion.div
          className="abacate-stats-strip"
          initial={{ opacity: 0, y: 40, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {[
            { val: 'Zero Rateio', desc: 'chave própria e individual' },
            { val: 'Codex Responses', desc: 'baixa latência no Cursor e IDEs' },
            { val: 'Protocolo Responses', desc: 'respostas em streaming e ferramentas padrão' },
            { val: 'No Pix', desc: 'preço fixo sem sustos em Dólar' },
          ].map((stat, i) => (
            <motion.div
              key={stat.val}
              className="abacate-stat-col"
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.85, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3 className="abacate-stat-val">{stat.val}</h3>
              <p className="abacate-stat-desc">{stat.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Guia Oficial de Conexão e Tutoriais */}
      <section className="claude-steps-section shell" id="como-conectar-astra">
        <motion.div
          className="claude-section-header"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">instruções de conexão</span>
          <h2 className="claude-section-title">
            Como conectar o <em>GPT Astra 6</em> no Codex.
          </h2>
          <p className="claude-section-subtitle">
            Configure o provedor Responses do Codex com a URL, o alias e sua chave individual.
          </p>
        </motion.div>

        <div className="tutorial-pane">
          <div className="tutorial-intro-card"><p>O perfil <strong>GPT Astra 6</strong> funciona no Codex pelo protocolo Responses. O identificador aceito é <code>gpt-6-astra</code>.</p></div>
          <div className="tutorial-steps-grid">
            <div className="claude-step-card tutorial-step-large">
              <div className="claude-step-top"><span className="claude-step-badge">Passo 01</span><h4>Guarde sua chave no Windows</h4></div>
              <p>Abra o PowerShell e execute o comando abaixo, trocando o texto pelo valor da sua chave individual. Feche e reabra o Codex depois.</p>
              <div className="code-block-box"><pre>{`setx SIXTYSIX_GATEWAY_API_KEY "SUA_CHAVE_INDIVIDUAL"`}</pre></div>
              <span className="tutorial-footnote">Não compartilhe a chave e não a coloque diretamente no config.toml.</span>
            </div>
            <div className="claude-step-card tutorial-step-large">
              <div className="claude-step-top"><span className="claude-step-badge">Passo 02</span><h4>Configure o Codex</h4></div>
              <p>Crie ou edite <code>%USERPROFILE%\.codex\config.toml</code>. Se já houver uma tabela <code>[model_providers.sixtysix]</code>, mescle os campos em vez de repetir a tabela.</p>
              <div className="code-block-box"><pre>{`model = "gpt-6-astra"
model_provider = "sixtysix"
web_search = "disabled"

[model_providers.sixtysix]
name = "Gateway"
base_url = "https://www.sixtysix.online/v1"
wire_api = "responses"
requires_openai_auth = false
env_http_headers = { "x-api-key" = "SIXTYSIX_GATEWAY_API_KEY" }
model_catalog_url = "https://www.sixtysix.online/api/codex/models"`}</pre></div>
            </div>
            <div className="claude-step-card">
              <div className="claude-step-top"><span className="claude-step-badge">Atenção</span><h4>GLM é outra configuração</h4></div>
              <p>GLM 5 não aparece no catálogo do Codex. Para usar esse perfil, configure-o no ZCode com <code>https://www.sixtysix.online/glm</code> e o ID <code>glm-5</code>.</p>
              
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Introdução ao Preço & Custos estilo AbacatePay */}
      <section className="claude-calc-dark-section" id="calculadora-astra">
        <div className="claude-price-intro-split">
          <motion.div
            className="claude-price-intro-col-left"
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">Preço</span>
            <h2 className="claude-price-intro-title">
              Quanto custa usar o <br />
              <span className="highlight-green-text">GPT Astra 6?</span>
            </h2>
            <p className="claude-price-intro-sub">
              A partir de <strong>R$ 79,99 fixos no Pix</strong> (ou <strong>teste 7 dias grátis</strong>), <strong>sem mensalidade surpresa</strong> e <strong>conforme cotas e disponibilidade</strong> a cada poucas horas.
              Diferente de assinar plataformas no cartão com IOF de 4,38% e taxa de câmbio abusiva, aqui o <strong>valor é previsível em Reais</strong>.
              Veja os <a href="#planos-astra">planos disponíveis</a> ou simule abaixo o quanto você economiza no seu fluxo de desenvolvimento.
            </p>
          </motion.div>

          <motion.div
            className="claude-price-intro-col-right"
            initial={{ opacity: 0, x: 75, scale: 0.94 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.25, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="claude-philosophers-card">
              <img
                src="/philosophers-glasses.png"
                alt="Platão e Aristóteles calculando a economia"
                className="claude-philosophers-img"
              />
            </div>
          </motion.div>
        </div>

        {/* Bloco Verde #1f4647 Preenchido com a Calculadora e Linhas Onduladas */}
        <motion.div
          className="claude-calc-dark-wrap"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Linhas onduladas fluidas em branco estilo AbacatePay */}
          <svg
            className="claude-calc-waves-bg"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
            viewBox="0 0 1200 600"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M-40 480 C 220 380, 420 560, 720 440 C 960 340, 1100 420, 1240 370"
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1.5"
            />
            <path
              d="M-40 515 C 240 410, 450 585, 760 465 C 1000 365, 1140 440, 1240 395"
              stroke="rgba(255, 255, 255, 0.09)"
              strokeWidth="1.5"
            />
            <path
              d="M-40 550 C 260 440, 480 610, 800 490 C 1040 390, 1170 460, 1240 420"
              stroke="rgba(255, 255, 255, 0.07)"
              strokeWidth="1.5"
            />
            <path
              d="M-40 440 C 190 350, 390 520, 680 410 C 920 310, 1060 390, 1240 340"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1.5"
            />
            <path
              d="M-40 400 C 160 320, 360 480, 640 380 C 880 280, 1020 360, 1240 310"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1.5"
            />
          </svg>

          {/* Header dentro da caixa verde */}
          <div className="claude-calc-dark-header">
            <h2 className="claude-calc-dark-title">
              Simule e veja quanto <br />
              você <span className="highlight-green">economiza de verdade.</span>
            </h2>
            <p className="claude-calc-dark-subtitle">
              Esqueça IOF de 4,38%, cotação oscilando e faturas surpresa no cartão de crédito. Compare os valores com a SixtySix no Pix.
            </p>

            {/* Presets no estilo AbacatePay */}
            <div className="claude-calc-dark-tabs">
              {presetLevels.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`claude-calc-dark-tab ${calcUsd === preset.value ? 'is-active' : ''}`}
                  onClick={() => setCalcUsd(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="claude-calc-dark-cards">
            {/* Card 1: Quanto você gasta em Dólar */}
            <div className="claude-glass-card">
              <span className="claude-glass-card-label">Quanto você consome em APIs em Dólar por mês?</span>
              <div className="claude-glass-big-val">
                <NumberRoller value={calcUsd} prefix="US$ " decimals={2} duration={0.45} />
                <span className="claude-glass-val-sep">/</span>
                <span className="claude-glass-val-secondary">
                  <NumberRoller value={totalAnthropicBRL} prefix="R$ " decimals={2} duration={0.45} />
                </span>
              </div>

              <div className="claude-glass-slider-wrap">
                <Slider
                  value={[calcUsd]}
                  onValueChange={(val) => setCalcUsd(val[0])}
                  min={20}
                  max={400}
                  step={10}
                  aria-label="Consumo estimado em Dólar"
                />
              </div>

              <div className="claude-glass-card-meta">
                <span>Câmbio base: R$ {commercialDollar.toFixed(2)}</span>
                <span>IOF: 4,38%</span>
                <span>Spread cartão: ~4,5%</span>
                <strong>Efetivo: R$ {effectiveDollarRate.toFixed(2)} / US$</strong>
              </div>
            </div>

            {/* Card 2: Você paga na SixtySix & Economia */}
            <div className="claude-glass-card">
              <span className="claude-glass-card-label">Você paga no Pix na SixtySix</span>
              <div className="claude-glass-big-val highlight-green">
                <NumberRoller value={sixtySixCost} prefix="R$ " decimals={2} duration={0.45} />
              </div>
              <span className="claude-glass-card-sub">
                Preço fixo no Pix ({sixtySixPlanName}) sem surpresas cambiais
              </span>

              <div className="claude-glass-card-divider" />

              <div className="claude-glass-rows">
                <div className="claude-glass-row">
                  <span className="glass-row-label">Fatura direta em Dólar (Cartão + IOF + Spread)</span>
                  <span className="glass-row-val text-red">
                    <NumberRoller value={totalAnthropicBRL} prefix="R$ " suffix=" / mês" decimals={2} duration={0.45} />
                  </span>
                </div>
                <div className="claude-glass-row">
                  <span className="glass-row-label">Economia líquida no seu bolso</span>
                  <span className="glass-row-val highlight-green">
                    <NumberRoller
                      value={savingsBRL}
                      prefix="R$ "
                      suffix={` / mês (-${savingsPercent}%)`}
                      decimals={2}
                      duration={0.45}
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Ação Verde Vibrante */}
          <div className="claude-calc-dark-action">
            <a href="#planos-astra" className="claude-calc-dark-btn">
              Garantir Preço Fixo no Pix <Arrow />
            </a>
            <p className="claude-calc-dark-footnote">
              Você economiza cerca de{' '}
              <strong>
                <NumberRoller
                  value={savingsBRL * 12}
                  prefix="R$ "
                  suffix=" por ano"
                  decimals={2}
                  duration={0.45}
                />
              </strong>{' '}
              ({savingsMultiplier}x mais barato do que na fatura em Dólar).
            </p>
          </div>
        </motion.div>
      </section>

      {/* Planos Destacados para GPT Astra 6 */}
      <section className="plans-section shell" id="planos-astra">
        <motion.div
          className="plans-header"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">acesso imediato</span>
          <h2 className="plans-title">
            Escolha seu plano para rodar <em>GPT Astra 6.</em>
          </h2>
          <p className="plans-subtitle">
            Teste gratuitamente por 7 dias ou garanta o acesso ilimitado com preço fixo no Pix.
          </p>
        </motion.div>

        <div className="plans-grid">
          {/* Teste Grátis */}
          <motion.div
            className="plan-card plan-card-trial"
            initial={{ opacity: 0, y: 45, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlanCardWaves cardIndex={0} />
            <div className="plan-card-top">
              <div className="plan-card-badge-wrap">
                <img src="/assets/plan-trial.webp" alt="Teste Grátis" className="plan-card-cash-icon" />
              </div>
              <h3 className="plan-name">Teste Grátis</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">0</span>
                <span className="plan-period">/7 dias</span>
              </div>
              <p className="plan-desc">Acesso total e irrestrito para testar o GPT Astra 6 na prática antes de decidir.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Direito a tudo liberado</strong></span></li>
              <li><Check /> <span><strong>GPT Astra 6</strong>, <strong>Claude Fable 5.1</strong> e <strong>GLM-4</strong></span></li>
              <li><Check /> <span><strong>Cursor</strong>, <strong>VS Code</strong> & <strong>Terminal</strong></span></li>
              <li><Check /> <span><strong>Chave individual</strong> (Zero Rateio)</span></li>
              <li><Check /> <span><strong>Sem cartão de crédito</strong> necessário</span></li>
            </ul>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="plan-btn">
              Começar Teste Grátis <Arrow />
            </a>
          </motion.div>

          {/* Dev */}
          <motion.div
            className="plan-card"
            initial={{ opacity: 0, y: 45, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.15, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlanCardWaves cardIndex={1} />
            <div className="plan-card-top">
              <div className="plan-card-badge-wrap">
                <img src="/assets/plan-cash.webp" alt="Dev" className="plan-card-cash-icon" />
              </div>
              <h3 className="plan-name">Dev</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">
                  <NumberRoller
                    value={devWithApi ? 94.99 : 79.99}
                    decimals={2}
                    duration={0.45}
                  />
                </span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Para desenvolvedores que criam e entregam software no dia a dia.</p>

              {/* Seletor Segmentado com rolagem e verde ativo */}
              <div className="plan-api-segmented">
                <button
                  type="button"
                  className={`plan-api-seg-btn ${!devWithApi ? 'is-active' : ''}`}
                  onClick={() => setDevWithApi(false)}
                >
                  Apenas no Site
                </button>
                <button
                  type="button"
                  className={`plan-api-seg-btn is-api-btn ${devWithApi ? 'is-active' : ''}`}
                  onClick={() => setDevWithApi(true)}
                >
                  + Chave de API <span className="plan-api-addon-pill">+R$ 15</span>
                </button>
              </div>
            </div>

            <ul className="plan-features">
              <li><Check size={14} /> <span><strong>GPT Astra 6</strong> & <strong>GLM-4 Plus</strong></span></li>
              {devWithApi ? (
                <>
                  <li><Check size={14} /> <span><strong>Chave de API individual</strong> (+ R$ 15/mês)</span></li>
                  <li><Check size={14} /> <span><strong>Cursor</strong>, <strong>VS Code</strong> & <strong>Terminal</strong></span></li>
                  <li><Check size={14} /> <span><strong>Chave individual própria</strong> sem rateio</span></li>
                </>
              ) : (
                <>
                  <li><Check size={14} /> <span><strong>Acesso 100% via plataforma web</strong></span></li>
                  <li>
                    <X size={14} className="text-red" />
                    <span className="plan-feature-muted">
                      <strong>Sem chave de API</strong> (apenas via plataforma no site)
                    </span>
                  </li>
                  <li><Check size={14} /> <span><strong>Ambiente próprio</strong> sem rateio</span></li>
                </>
              )}
              <li><Check size={14} /> <span><strong>Acesso ao gateway SixtySix</strong></span></li>
              <li><Check size={14} /> <span><strong>Cobrança fixa em Reais</strong> via Pix</span></li>
            </ul>
            <a
              href={`https://wa.me/5511999999999?text=${encodeURIComponent(
                devWithApi
                  ? 'Olá! Quero assinar o plano Dev COM CHAVE DE API (R$ 94,99/mês) para o GPT Astra 6.'
                  : 'Olá! Quero assinar o plano Dev APENAS VIA SITE (R$ 79,99/mês) para o GPT Astra 6.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="plan-btn"
            >
              {devWithApi ? 'Começar no Dev com API' : 'Começar no Dev (Via Site)'}
            </a>
          </motion.div>

          {/* Pro Ilimitado */}
          <motion.div
            className="plan-card plan-card-featured"
            initial={{ opacity: 0, y: 45, scale: 0.93 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.2, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <PlanCardWaves cardIndex={2} />
            <div className="plan-card-top">
              <div className="plan-card-badge-wrap">
                <img src="/assets/plan-cash.webp" alt="Pro" className="plan-card-cash-icon" />
              </div>
              <h3 className="plan-name">Pro Ilimitado</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">119</span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Acesso irrestrito aos modelos de ponta para quem constrói sem parar.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Acesso à API</strong> incluso</span></li>
              <li><Check /> <span><strong>Claude Fable 5.1</strong>, <strong>GPT Astra 6</strong> e <strong>GLM-4 Plus</strong></span></li>
              <li><Check /> <span><strong>Uso conforme cotas</strong> (sem travas diárias)</span></li>
              <li><Check /> <span><strong>Zero Rateio</strong> (chave oficial e segura)</span></li>
              <li><Check /> <span><strong>Perfis de acesso</strong> (disponibilidade variável)</span></li>
              <li><Check /> <span><strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>VS Code</strong>, <strong>Codex</strong></span></li>
              <li><Check /> <span><strong>Cobrança fixa em Reais</strong> sem IOF via Pix</span></li>
            </ul>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="plan-btn plan-btn-featured">
              Garantir Acesso Ilimitado <Arrow />
            </a>
          </motion.div>
        </div>
      </section>

      {/* FAQ GPT Astra 6 */}
      <section className="faq shell" id="duvidas-astra">
        <motion.div
          className="faq-intro"
          initial={{ opacity: 0, x: -60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="faq-title">
            <span className="faq-title-green">Dúvidas sobre</span><br />
            o GPT Astra 6.
          </h2>
          <p className="faq-subtitle">
            Tudo o que você precisa saber para plugar o GPT Astra 6 no Cursor, VS Code ou Terminal hoje mesmo.
          </p>
          <div className="faq-action">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="faq-support-btn">
              Falar conosco no WhatsApp
            </a>
            <span className="faq-footnote">Sem mensalidade surpresa. Ativação imediata.</span>
          </div>
        </motion.div>
        <motion.div
          className="faq-list"
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.2, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <AccordionPrimitive.Root type="single" collapsible className="faq-accordion-root">
            {astraFaqs.map(([question, answer], index) => (
              <motion.div
                key={question}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.85, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <AccordionPrimitive.Item value={`item-${index}`} className="faq-accordion-item">
                  <AccordionPrimitive.Header>
                    <AccordionPrimitive.Trigger className="faq-accordion-trigger">
                      <span>{question}</span>
                      <span className="faq-accordion-icon-wrap" aria-hidden="true">
                        <Plus className="faq-accordion-plus" size={19} strokeWidth={1.8} />
                        <Minus className="faq-accordion-minus" size={19} strokeWidth={1.8} />
                      </span>
                    </AccordionPrimitive.Trigger>
                  </AccordionPrimitive.Header>
                  <AccordionPrimitive.Content className="faq-accordion-content animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <p>{answer}</p>
                  </AccordionPrimitive.Content>
                </AccordionPrimitive.Item>
              </motion.div>
            ))}
          </AccordionPrimitive.Root>
        </motion.div>
      </section>

      {/* Pre-Footer CTA com os Anjos */}
      <section className="pre-footer-cta-wrap">
        <motion.img
          src="/assets/cherub-left.webp"
          alt="Anjo nas nuvens à esquerda"
          className="cherub-flank cherub-flank-left"
          initial={{ opacity: 0, x: -110, rotate: -6 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.img
          src="/assets/cherub-right.webp"
          alt="Anjo nas nuvens à direita"
          className="cherub-flank cherub-flank-right"
          initial={{ opacity: 0, x: 110, rotate: 6 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.div
          className="pre-footer-cta shell"
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">comece agora</span>
          <h2 className="pre-footer-title">
            Pronto para codar com GPT Astra 6 <span className="pre-footer-green">sem limites?</span>
          </h2>
          <p className="pre-footer-sub">
            Crie sua conta em 1 minuto, receba sua chave oficial e teste no Cursor hoje mesmo.
          </p>
          <div className="pre-footer-btn-wrap">
            <a href="#planos-astra" className="pre-footer-btn">
              Começar Teste de 7 Dias Grátis
            </a>
          </div>
          <p className="pre-footer-footnote">
            Sem cartão de crédito necessário. Ativação instantânea.
          </p>
        </motion.div>
      </section>

      {/* Footer Padrão SixtySix */}
      <footer className="footer-wrap">
        <div className="shell footer-columns-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Modelos</h4>
            <ul className="footer-link-list">
              <li><Link to="/astra-6" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>GPT Astra 6</Link></li>
              <li><Link to="/claude-code">Claude Fable 5.1</Link></li>
              <li><Link to="/glm-4">GLM-4 Plus</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Produto</h4>
            <ul className="footer-link-list">
              <li><Link to="/astra-6">GPT Astra 6</Link></li>
              <li><Link to="/claude-code">Claude Code CLI</Link></li>
              <li><a href="#como-conectar-astra">Integração no Cursor</a></li>
              <li><a href="#calculadora-astra">Calculadora de Tokens</a></li>
              <li><a href="#planos-astra">Planos & Preços</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Suporte</h4>
            <ul className="footer-link-list">
              <li><a href="#duvidas-astra">Dúvidas Frequentes</a></li>
              <li><a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">WhatsApp Oficial</a></li>
              <li><a href="mailto:suporte@sixtysix.dev">suporte@sixtysix.dev</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Legal</h4>
            <ul className="footer-link-list">
              <li><a href="/#duvidas">Termos de Uso</a></li>
              <li><a href="/#duvidas">Política de Privacidade</a></li>
              <li><a href="/#duvidas">Segurança</a></li>
            </ul>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div className="shell footer-bottom-bar">
          <div className="footer-brand-meta">
            <Link className="brand footer-brand" to="/" aria-label="SixtySix, início">
              <img src="/assets/sidebar-logo-white.png" alt="SixtySix" className="brand-logo-img brand-logo-footer" />
            </Link>
            <span className="footer-copyright">
              © 2026 Sixtysix · CNPJ 69.864.497/0001-92 · Todos os direitos reservados.
            </span>
          </div>

          <div className="footer-social-links">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X" className="footer-social-link">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer-social-link">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer-social-link">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="footer-social-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
