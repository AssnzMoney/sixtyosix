import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Marquee } from '@/components/ui/marquee'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus, Minus, ChevronDown, ArrowRight, LogOut } from 'lucide-react'
import { Slider } from '@/components/ui/slider-number-flow'
import NumberRoller from '@/components/ui/number-roller'
import PlanCardWaves from '@/components/ui/plan-card-waves'
import { useAuth } from '../lib/AuthContext'

const purchasePaths = {
  dev: '/comprar/dev',
  devApi: '/comprar/devApi',
  pro: '/comprar/pro',
}

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const Cross = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const features = [
  ['01', 'Zero Rateio & Chave Própria', 'Nada de contas compartilhadas que caem ou risco de vazar código confidencial. Você recebe sua chave de API individual e segura.'],
  ['02', 'Modelos Oficiais & Alta Estabilidade', 'Acesso direto aos modelos oficiais sem intermediários. Respostas originais na íntegra, latência ultrarrápida e sem erros 429.'],
  ['03', '100% Ilimitado de Verdade', 'Pode codar o dia todo, fazer refatorações pesadas e rodar agentes. Sem limite diário de prompts ou travamentos de cota.'],
  ['04', 'Claude Code, VS Code & Cursor', 'Conecte direto onde você já programa todo dia: Claude Code CLI, Roo Code, Cline, Cursor, Codex e Terminal.'],
]

const faqs = [
  [
    'Como funciona o acesso da SixtySix?',
    'A SixtySix fornece uma conexão dedicada e de alta velocidade para desenvolvedores utilizarem os modelos líderes (Claude Fable 5.1 e GPT Astra 6) no terminal (Claude Code), no VS Code e no Codex, com preço fixo em Reais pago via Pix, sem IOF e sem rateio.',
  ],
  [
    'Como funciona o teste de 7 dias grátis?',
    'Clique em Começar Teste Grátis, entre ou crie sua conta e escolha como deseja ser chamado. Sua chave individual é liberada automaticamente por 7 dias, sem cartão e sem cobrança automática. Cada conta pode ativar o teste uma vez.',
  ],
  [
    'Onde consigo minha chave individual de acesso?',
    'No teste grátis, sua chave é criada automaticamente e fica disponível na página do teste. O painel reúne suas chaves e o consumo da sua conta. Durante os 7 dias, você pode consultar a chave novamente para configurar suas ferramentas.',
  ],
  [
    'Posso usar no terminal, no VS Code e no Codex?',
    'Sim! O serviço possui suporte nativo ao Claude Code CLI no terminal (Prompt de Comando, PowerShell ou WSL), além de extensões no VS Code (Cline, Roo Code) e no Codex.',
  ],
  [
    'Posso usar no Claude direto pelo navegador (Claude.ai)?',
    'Não no site padrão claude.ai, pois a interface web da Anthropic não permite alterar o endpoint de API. Você pode usar no aplicativo Claude Desktop (quando a versão permitir gateway personalizado) ou no Claude Code diretamente no terminal.',
  ],
  [
    'Qual endereço (URL do gateway) e modelo devo configurar?',
    'O endereço base oficial do gateway é https://www.sixtysix.online para Claude Code e Claude Desktop (com modelo claude-fable-5-1). Para o Codex, a configuração aponta para https://www.sixtysix.online/v1 (com modelo gpt-6-astra).',
  ],
  [
    'A chave não funcionou ou deu erro. O que devo verificar?',
    'Verifique 5 pontos essenciais: 1) Se o endereço base está exatamente https://www.sixtysix.online; 2) Se o ID do modelo foi digitado corretamente (claude-fable-5-1 para Claude ou gpt-6-astra para Codex); 3) Se copiou a chave completa sem espaços antes ou depois; 4) Se as variáveis de ambiente foram aplicadas na janela aberta do CMD ou no sistema; 5) Se a sua chave continua ativa com o administrador. Se persistir, contate nosso suporte.',
  ],
]

const partners = [
  {
    id: 'claude-1',
    name: 'Claude',
    caption: 'Anthropic',
    logo: '/assets/brands/claude.svg',
  },
  {
    id: 'gpt-1',
    name: 'GPT',
    caption: 'OpenAI',
    logo: '/assets/brands/openai.svg',
  },
  {
    id: 'glm-1',
    name: 'GLM',
    caption: 'Z.ai',
    logo: '/assets/brands/glm.svg',
  },
  {
    id: 'vscode-1',
    name: 'VS Code',
    caption: 'Microsoft',
    logo: '/assets/brands/vscode.svg',
  },
  {
    id: 'claude-2',
    name: 'Claude',
    caption: 'Anthropic',
    logo: '/assets/brands/claude.svg',
  },
  {
    id: 'gpt-2',
    name: 'GPT',
    caption: 'OpenAI',
    logo: '/assets/brands/openai.svg',
  },
  {
    id: 'glm-2',
    name: 'GLM',
    caption: 'Z.ai',
    logo: '/assets/brands/glm.svg',
  },
  {
    id: 'vscode-2',
    name: 'VS Code',
    caption: 'Microsoft',
    logo: '/assets/brands/vscode.svg',
  },
]

const presetLevels = [
  { label: 'US$ 30', value: 30 },
  { label: 'US$ 60', value: 60 },
  { label: 'US$ 100', value: 100 },
  { label: 'US$ 150', value: 150 },
  { label: 'US$ 250', value: 250 },
]

export default function App() {
  const [copied, setCopied] = useState(false)
  const [navTab, setNavTab] = useState<'login' | 'signup'>('signup')
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [handsAction, setHandsAction] = useState<'primary' | 'secondary'>('primary')
  const [integrationAction, setIntegrationAction] = useState<'primary' | 'secondary'>('primary')

  const { user, signOut } = useAuth()
  const [calcUsd, setCalcUsd] = useState(100)
  const [devWithApi, setDevWithApi] = useState(false)

  // Cotação real do Dólar no cartão (comercial + IOF + Spread bancário):
  const commercialDollar = 5.85
  const iofRate = 0.0438
  const cardSpread = 0.045
  const effectiveDollarRate = commercialDollar * (1 + iofRate + cardSpread) // ~R$ 6.37

  const totalAnthropicBRL = calcUsd * effectiveDollarRate
  const sixtySixCost = calcUsd <= 60 ? 79 : 119
  const sixtySixPlanName = calcUsd <= 60 ? 'Dev' : 'Pro Ilimitado'

  const savingsBRL = Math.max(0, totalAnthropicBRL - sixtySixCost)
  const savingsPercent = Math.round((savingsBRL / totalAnthropicBRL) * 100)
  const savingsMultiplier = (totalAnthropicBRL / sixtySixCost).toFixed(1)

  const [isScrolled, setIsScrolled] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      if (window.scrollY > 20) {
        setMegaMenuOpen(false)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText('set ANTHROPIC_BASE_URL=https://www.sixtysix.online')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main>
      <header
        className={`nav-wrapper ${isScrolled ? 'nav-scrolled' : ''}`}
        onMouseLeave={() => setMegaMenuOpen(false)}
      >
        <nav className="nav">
          <div className="nav-left">
            <a className="brand" href="#top" aria-label="SixtySix, início">
              <img src="/assets/sidebar-logo.png" alt="SixtySix" className="brand-logo-img" />
            </a>
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
              <a href="#recursos">Recursos</a>
              <a href="#economia">Calculadora</a>
              <a href="#planos">Preço</a>
              <a href="#duvidas">Dúvidas</a>
            </div>
          </div>

          <div className="nav-right">
            {user ? (
              <div className="nav-user-logged">
                <Link to="/dashboard" className="nav-user-badge" title={`Conectado como ${user.email} - Acessar Dashboard`}>
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
                <Link to="/criar-conta" className="nav-cta-btn">
                  Criar conta grátis
                </Link>
              </>
            )}
            <button
              type="button"
              className="nav-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f4647" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1f4647" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="9" y1="17" x2="20" y2="17" />
                </svg>
              )}
            </button>
          </div>
        </nav>

        {/* Drawer Mobile estilo AbacatePay */}
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
                  <a href="#top" onClick={() => setMobileMenuOpen(false)}>
                    <img src="/assets/sidebar-logo.png" alt="SixtySix" className="sidebar-brand-logo" />
                  </a>
                </div>
                <div className="nav-mobile-group">
                  <span className="nav-mobile-group-title">Modelos Oficiais de IA</span>
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
                    to="/astra-6"
                    className="nav-mobile-item"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="nav-mobile-item-head">
                      <strong>GPT Astra 6</strong>
                    </div>
                    <small>Velocidade ultra-rápida e inteligência multimodal</small>
                  </Link>
                  <Link
                    to="/glm-4"
                    className="nav-mobile-item"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div className="nav-mobile-item-head">
                      <strong>GLM-4 Plus</strong>
                    </div>
                    <small>Refatoração avançada e geração de código</small>
                  </Link>
                </div>

                <div className="nav-mobile-links">
                  <a
                    href="#recursos"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Recursos
                  </a>
                  <a
                    href="#economia"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Calculadora
                  </a>
                  <a
                    href="#planos"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Planos & Preço
                  </a>
                  <a
                    href="#duvidas"
                    className="nav-mobile-link"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dúvidas frequentes
                  </a>
                </div>

                <div className="nav-mobile-actions">
                  <Link
                    to="/criar-conta"
                    className="nav-mobile-btn-primary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Criar conta grátis <Arrow />
                  </Link>
                  <Link
                    to="/login"
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

        {/* Mega Menu Dropdown estilo AbacatePay */}
        {megaMenuOpen && (
          <div
            className="mega-menu-panel"
            onMouseEnter={() => setMegaMenuOpen(true)}
          >
            <div className="mega-menu-grid">
              {/* Coluna 1: Modelos Oficiais */}
              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Modelos Oficiais de IA</span>
                <div className="mega-menu-items">
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
                  <Link to="/astra-6" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GPT Astra 6</strong>
                    <span>Velocidade ultra-rápida e inteligência multimodal.</span>
                  </Link>
                  <Link to="/glm-4" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GLM-4 Plus</strong>
                    <span>Excelente em refatoração, documentação e testes.</span>
                  </Link>
                  <a href="#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Conexão Direta Oficial</strong>
                    <span>Sem intermediários, sem compressão e sem erros 429.</span>
                  </a>
                </div>
              </div>

              {/* Coluna 2: Onde Você Codifica */}
              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Onde Você Já Codifica</span>
                <div className="mega-menu-items">
                  <Link
                    to="/claude-code"
                    className="mega-menu-item"
                    onClick={() => {
                      setMegaMenuOpen(false)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  >
                    <strong>Claude Code CLI</strong>
                    <span>Agentes autônomos no seu terminal sem travas de cotas.</span>
                  </Link>
                  <a href="#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Cursor IDE</strong>
                    <span>Substitua sua chave de API e programe sem interrupção.</span>
                  </a>
                  <a href="#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>VS Code (Cline & Roo)</strong>
                    <span>Suporte nativo aos melhores assistentes do mercado.</span>
                  </a>
                  <a href="#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Codex & Terminal</strong>
                    <span>Ambientes de desenvolvimento com contexto estendido.</span>
                  </a>
                </div>
              </div>

              {/* Coluna 3: Diferenciais */}
              <div className="mega-menu-col">
                <span className="mega-menu-col-title">Diferenciais SixtySix</span>
                <div className="mega-menu-items">
                  <a href="#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Uso 100% Ilimitado</strong>
                    <span>Sem limites diários de prompts ou cortes de velocidade.</span>
                  </a>
                  <a href="#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Zero Rateio & Chave Própria</strong>
                    <span>Sua chave individual, garantindo sigilo e estabilidade.</span>
                  </a>
                  <a href="#planos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Preço Fixo em Reais (Pix)</strong>
                    <span>Esqueça IOF e variações do Dólar na fatura do cartão.</span>
                  </a>
                  <a href="#economia" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Alta Estabilidade 99.9%</strong>
                    <span>Respostas rápidas sem travamentos no meio do deploy.</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Barra Inferior com Call-to-action */}
            <div className="mega-menu-bottom">
              <a href="#planos" className="mega-menu-bottom-link" onClick={() => setMegaMenuOpen(false)}>
                Ver todos os planos disponíveis <ArrowRight size={15} />
              </a>
              <a href="#economia" className="mega-menu-bottom-link-secondary" onClick={() => setMegaMenuOpen(false)}>
                Simular economia na calculadora de tokens →
              </a>
            </div>
          </div>
        )}
      </header>

      <header className="hero shell" id="top">
        <div className="hero-trust-badge">
          <div className="trust-badges-row">
            <div className="trust-badge badge-claude"><img src="/assets/brands/claude.svg" alt="Claude" /></div>
            <div className="trust-badge badge-glm"><img src="/assets/brands/glm.svg" alt="GLM" /></div>
            <div className="trust-badge badge-openai"><img src="/assets/brands/openai.svg" alt="GPT" /></div>
            <div className="trust-badge badge-vscode"><img src="/assets/brands/vscode.svg" alt="VS Code" /></div>
          </div>
          <span>Integre com IA em minutos</span>
        </div>

        <h1>Seu próximo grande projeto começa com <em><span className="marker-word">6x</span> mais impulso.</em></h1>
        <p>
          Planos acessíveis para usar Claude Code todos os dias.{' '}
          <strong className="hero-highlight-phrase">Crie, teste e entregue mais — pagando menos.</strong>
        </p>
        <div
          className="hero-actions"
          onMouseLeave={() => setHeroAction('primary')}
        >
          <a
            href="#teste"
            className={`hero-action-pill ${heroAction === 'primary' ? 'is-active' : ''}`}
            onMouseEnter={() => setHeroAction('primary')}
            onClick={() => setHeroAction('primary')}
          >
            {heroAction === 'primary' && (
              <motion.div
                layoutId="hero-pill-indicator"
                className="hero-active-pill-bg"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="hero-pill-content">
              Teste agora <Arrow />
            </span>
          </a>

          <a
            href="#planos"
            className={`hero-action-pill ${heroAction === 'secondary' ? 'is-active' : ''}`}
            onMouseEnter={() => setHeroAction('secondary')}
            onClick={() => setHeroAction('secondary')}
          >
            {heroAction === 'secondary' && (
              <motion.div
                layoutId="hero-pill-indicator"
                className="hero-active-pill-bg"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="hero-pill-content">
              Ver planos <Arrow />
            </span>
          </a>
        </div>
        <div className="partners">
          <span className="partners-label">Trabalhe com os modelos que lideram o mercado</span>
          <Marquee pauseOnHover speed={22} className="partners-marquee">
            {partners.map((partner) => (
              <div className="partner-item" key={partner.id}>
                <span className={`partner-mark ${partner.name.toLowerCase() === 'glm' ? 'partner-glm' : ''}`}>
                  <img src={partner.logo} alt="" />
                </span>
                <span className="partner-copy">
                  <strong>{partner.name}</strong>
                  <small>{partner.caption}</small>
                </span>
              </div>
            ))}
          </Marquee>
        </div>
      </header>

      <section className="hands-section" id="recursos">
        <img
          className="hand hand-left"
          src="/assets/sixtysix-hand-reach.webp"
          alt="Mão alcançando"
          loading="eager"
          decoding="async"
        />
        <img
          className="hand hand-right"
          src="/assets/sixtysix-hand-logo.webp"
          alt="Mão com logo"
          loading="eager"
          decoding="async"
        />
        <div className="hands-content shell">
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="hands-eyebrow-container">
              <div className="hands-eyebrow-box">
                <span className="hands-eyebrow">
                  mais código. pagando <strong>6x</strong> mais barato.
                </span>
                <svg
                  className="hands-curve-arrow"
                  width="34"
                  height="38"
                  viewBox="0 0 34 38"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ overflow: 'visible' }}
                >
                  <path
                    d="M8 3 C 24 9, 21 23, 20 34"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M13 26 L 20 34 L 27 26"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <h2>Claude Code todos os dias, sempre <em>na sua mão.</em></h2>
            <p>Da primeira linha ao deploy. A Sixtysix oferece planos acessíveis para você usar Claude Code com simplicidade e cobrança previsível.</p>
          </motion.div>

          <div className="feature-grid">
            {features.map(([number, title, copy], i) => (
              <motion.article
                className="feature-card"
                key={number}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 1.05, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              >
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </motion.article>
            ))}
          </div>
          <div
            className="hero-actions hands-actions-center"
            onMouseLeave={() => setHandsAction('primary')}
          >
            <a
              href="#teste"
              className={`hero-action-pill ${handsAction === 'primary' ? 'is-active' : ''}`}
              onMouseEnter={() => setHandsAction('primary')}
              onClick={() => setHandsAction('primary')}
            >
              {handsAction === 'primary' && (
                <motion.div
                  layoutId="hands-pill-indicator"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Quero testar agora <Arrow />
              </span>
            </a>

            <a
              href="#como-funciona"
              className={`hero-action-pill ${handsAction === 'secondary' ? 'is-active' : ''}`}
              onMouseEnter={() => setHandsAction('secondary')}
              onClick={() => setHandsAction('secondary')}
            >
              {handsAction === 'secondary' && (
                <motion.div
                  layoutId="hands-pill-indicator"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Ver demonstração <Arrow />
              </span>
            </a>
          </div>
        </div>
      </section>

      <section className="integration-section shell" id="como-funciona">
        <div className="integration-grid">
          <motion.div
            className="phone-card-wrapper"
            initial={{ opacity: 0, x: -70, scale: 0.94 }}
            whileInView={{ opacity: 1, x: 0, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="phone-glow" />
            <div className="phone-device">
              <div className="phone-notch-bar">
                <span>9:41</span>
                <div className="phone-notch" />
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <svg width="13" height="9" viewBox="0 0 14 10" fill="currentColor"><path d="M1 8h2v2H1V8zm3-3h2v5H4V5zm3-3h2v8H7V2zm3-2h2v10h-2V0z" /></svg>
                  <svg width="15" height="9" viewBox="0 0 16 9" fill="currentColor"><rect x="0.5" y="0.5" width="13" height="8" rx="2" fill="none" stroke="currentColor" /><rect x="2" y="2" width="9" height="5" rx="1" /><path d="M15 3.5v2" stroke="currentColor" /></svg>
                </div>
              </div>
              <div className="phone-nav-header">
                <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                <span>www.sixtysix.online</span>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>
              </div>
              <div className="phone-chat-body">
                <div className="chat-msg-user">
                  <span className="chat-cmd-line">set ANTHROPIC_BASE_URL=</span>
                  <span className="chat-cmd-url">https://www.sixtysix.online</span>
                </div>
                <div className="chat-msg-bot">
                  <div className="chat-bot-icon">
                    <img src="/assets/brands/claude.svg" alt="Claude" />
                  </div>
                  <p>
                    Conexão ao SixtySix pronta! Modelo ativo: <strong>claude-fable-5-1</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="phone-model-badges">
              <div className="badges-row">
                <div className="badge-circle badge-claude" title="Claude (Anthropic)">
                  <img src="/assets/brands/claude.svg" alt="Claude" />
                </div>
                <div className="badge-circle badge-glm" title="GLM (Z.ai)">
                  <img src="/assets/brands/glm.svg" alt="GLM" />
                </div>
                <div className="badge-circle badge-openai" title="GPT (OpenAI)">
                  <img src="/assets/brands/openai.svg" alt="GPT" />
                </div>
                <div className="badge-circle badge-vscode" title="VS Code">
                  <img src="/assets/brands/vscode.svg" alt="VS Code" />
                </div>
              </div>
              <span className="badges-caption">Integre com IA em minutos</span>
            </div>
          </motion.div>

          <motion.div
            className="integration-copy"
            initial={{ opacity: 0, x: 70 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">integração nativa</span>
            <h2 className="integration-title">
              <span className="text-emerald">Integre do jeito que</span>
              <br />
              <span className="text-dark">você constrói.</span>
            </h2>
            <p>
              Code, vibe-code ou no-code dá no mesmo. Se você programa, tem
              suporte direto ao Claude Code CLI, Cursor e Codex no Windows via Prompt de Comando (CMD).
              Conecte sua chave individual, aponte a URL base oficial e codifique sem interrupções.
            </p>
            <div className="snippet-box">
              <code>set ANTHROPIC_BASE_URL=https://www.sixtysix.online</code>
              <button
                type="button"
                className="btn-copy"
                onClick={handleCopy}
              >
                {copied ? <Check /> : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <div
              className="hero-actions"
              onMouseLeave={() => setIntegrationAction('primary')}
            >
              <Link
                to="/claude-code"
                className={`hero-action-pill ${integrationAction === 'primary' ? 'is-active' : ''}`}
                onMouseEnter={() => setIntegrationAction('primary')}
                onClick={() => setIntegrationAction('primary')}
              >
                {integrationAction === 'primary' && (
                  <motion.div
                    layoutId="integration-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Integrar com Claude <Arrow />
                </span>
              </Link>

              <Link
                to="/claude-code#passo-a-passo"
                className={`hero-action-pill ${integrationAction === 'secondary' ? 'is-active' : ''}`}
                onMouseEnter={() => setIntegrationAction('secondary')}
                onClick={() => setIntegrationAction('secondary')}
              >
                {integrationAction === 'secondary' && (
                  <motion.div
                    layoutId="integration-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Ver documentação <Arrow />
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Seção de Introdução ao Preço & Custos estilo AbacatePay */}
      <section className="claude-calc-dark-section" id="economia">
        <div className="claude-price-intro-split">
          <motion.div
            className="claude-price-intro-col-left"
            initial={{ opacity: 0, x: -60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">simulador de custos</span>
            <h2 className="claude-price-intro-title">
              Quanto custa usar o <br />
              <span className="highlight-green-text">Claude Code?</span>
            </h2>
            <p className="claude-price-intro-sub">
              A partir de <strong>R$ 79,00 fixos no Pix</strong> (ou <strong>teste 7 dias grátis</strong>), <strong>sem mensalidade surpresa</strong> e <strong>sem limites de cota</strong> a cada 5 horas.
              Diferente da Anthropic que cobra em Dólar com IOF de 4,38% e taxa de câmbio abusiva no cartão, aqui o <strong>valor é previsível em Reais</strong>.
              Veja os <a href="#planos">planos disponíveis</a> ou simule abaixo o quanto você economiza no seu fluxo de desenvolvimento.
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
          {/* Linhas onduladas fluidas em branco estilo AbacatePay - Absolute para não ocupar espaço no fluxo */}
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
            {/* Card 1: Quanto você consome na Anthropic por mês? */}
            <div className="claude-glass-card">
              <span className="claude-glass-card-label">Quanto você consome na Anthropic por mês?</span>
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
            <a href="#planos" className="claude-calc-dark-btn">
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

      {/* SEÇÃO DE PLANOS & DIFERENCIAIS (TOTALMENTE UNIFICADA NO PADRÃO DO SITE) */}
      <section className="plans-section shell" id="planos">
        <motion.div
          className="plans-header"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">modelos oficiais · zero rateio</span>
          <h2 className="plans-title">
            Planos com uso <em>100% ilimitado.</em>
          </h2>
          <p className="plans-subtitle">
            Esqueça contas compartilhadas que caem no meio do raciocínio ou surpresas na fatura em Dólar. Conecte sua chave no <strong>Claude Code</strong>, <strong>VS Code</strong>, <strong>Cursor</strong> ou <strong>Codex</strong> e programe com preço fixo no Pix.
          </p>
        </motion.div>

        <span id="teste" style={{ display: 'block', position: 'relative', top: '-110px', visibility: 'hidden' }} />
        <div className="plans-grid">
          {/* Teste Grátis */}
          <motion.div
            className="plan-card plan-card-trial"
            id="teste-gratis"
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
              <p className="plan-desc">Acesso total e irrestrito para testar tudo na prática antes de decidir.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Direito a tudo liberado</strong></span></li>
              <li><Check /> <span><strong>Claude Fable 5.1</strong>, <strong>GPT Astra 6</strong> e <strong>GLM-4</strong></span></li>
              <li><Check /> <span><strong>Claude Code</strong>, <strong>Cursor</strong> & <strong>VS Code</strong></span></li>
              <li><Check /> <span><strong>Chave oficial própria</strong> (Zero Rateio)</span></li>
              <li><Check /> <span><strong>Sem cartão de crédito</strong> necessário</span></li>
            </ul>
            <Link to="/teste-gratis" className="plan-btn">
              Começar Teste Grátis <Arrow />
            </Link>
          </motion.div>

          {/* Dev */}
          <motion.div
            className="plan-card"
            initial={{ opacity: 0, y: 45, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.15, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
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

              {/* Opção de Ganhar a Chave de API (+ R$ 15) */}
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
              <li><Check /> <span><strong>GPT Astra 6</strong> & <strong>GLM-4 Plus</strong></span></li>
              {devWithApi ? (
                <>
                  <li><Check /> <span><strong>Chave de API oficial inclusa</strong> (+ R$ 15/mês)</span></li>
                  <li><Check /> <span><strong>Claude Code</strong>, <strong>Cursor</strong> & <strong>VS Code</strong></span></li>
                  <li><Check /> <span><strong>Chave individual própria</strong> sem rateio</span></li>
                </>
              ) : (
                <>
                  <li><Check /> <span><strong>Acesso 100% via plataforma web</strong></span></li>
                  <li>
                    <Cross />
                    <span className="plan-feature-muted">
                      <strong>Sem chave de API</strong> (apenas via plataforma no site)
                    </span>
                  </li>
                  <li><Check /> <span><strong>Ambiente próprio</strong> sem rateio</span></li>
                </>
              )}
              <li><Check /> <span><strong>Conexão direta</strong> aos modelos oficiais</span></li>
              <li><Check /> <span><strong>Cobrança fixa em Reais</strong> via Pix</span></li>
            </ul>
            <Link to={devWithApi ? purchasePaths.devApi : purchasePaths.dev} className="plan-btn">
              {devWithApi ? 'Começar no Dev com API' : 'Começar no Dev (Via Site)'}
            </Link>
          </motion.div>

          {/* Pro Ilimitado */}
          <motion.div
            className="plan-card plan-card-featured"
            initial={{ opacity: 0, y: 45, scale: 0.94 }}
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
                <span className="plan-val">119,99</span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Acesso irrestrito aos modelos de ponta para quem constrói sem parar.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Acesso à API</strong> incluso</span></li>
              <li><Check /> <span><strong>Claude Fable 5.1</strong>, <strong>GPT Astra 6</strong> e <strong>GLM-4 Plus</strong></span></li>
              <li><Check /> <span><strong>Uso 100% Ilimitado</strong> (sem travas diárias)</span></li>
              <li><Check /> <span><strong>Zero Rateio</strong> (chave oficial e segura)</span></li>
              <li><Check /> <span><strong>Modelos Oficiais</strong> (99.9% uptime)</span></li>
              <li><Check /> <span><strong>Claude Code</strong>, <strong>Cursor</strong>, <strong>VS Code</strong>, <strong>Codex</strong></span></li>
              <li><Check /> <span><strong>Cobrança fixa em Reais</strong> sem IOF via Pix</span></li>
            </ul>
            <Link to={purchasePaths.pro} className="plan-btn plan-btn-featured">
              Garantir Acesso Ilimitado <Arrow />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="faq shell" id="duvidas">
        <motion.div
          className="faq-intro"
          initial={{ opacity: 0, x: -60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="faq-title">
            <span className="faq-title-green">Tem dúvidas?</span> Relaxa,<br />
            nós temos as respostas.
          </h2>
          <p className="faq-subtitle">
            Selecionamos algumas dúvidas que recebemos com frequência sobre nossos serviços, elas podem ser úteis para você!
          </p>
          <div className="faq-action">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="faq-support-btn">
              Falar conosco
            </a>
            <span className="faq-footnote">Sem burocracia. Chave individual com ativação imediata.</span>
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
            {faqs.map(([question, answer], index) => (
              <AccordionPrimitive.Item key={question} value={`item-${index}`} className="faq-accordion-item">
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
            ))}
          </AccordionPrimitive.Root>
        </motion.div>
      </section>

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
            Você leu até aqui. <span className="pre-footer-green">Tá interessado né?</span>
          </h2>
          <p className="pre-footer-sub">
            Cadastro leva 2 minutos, sem dificuldades, e você começa a codar hoje ainda.
          </p>
          <div className="pre-footer-btn-wrap">
            <a href="#economia" className="pre-footer-btn">
              Vai, clica logo nesse botão
            </a>
          </div>
          <p className="pre-footer-footnote">
            Preço fixo no Pix. Chave individual com Zero Rateio.
          </p>
        </motion.div>
      </section>

      <footer className="footer-wrap">
        <div className="shell footer-columns-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Modelos</h4>
            <ul className="footer-link-list">
              <li><Link to="/claude-code">Claude Fable 5.1</Link></li>
              <li><Link to="/astra-6">GPT Astra 6</Link></li>
              <li><Link to="/glm-4">GLM-4 Plus</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Produto</h4>
            <ul className="footer-link-list">
              <li><Link to="/claude-code">Claude Code CLI</Link></li>
              <li><a href="#como-funciona">Integração no Terminal</a></li>
              <li><a href="#economia">Calculadora de Tokens</a></li>
              <li><a href="#recursos">Planos & Preços</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Suporte</h4>
            <ul className="footer-link-list">
              <li><a href="#duvidas">Dúvidas Frequentes</a></li>
              <li><a href="/reembolso.html">Falar com Suporte</a></li>
              <li><a href="/reembolso.html">Atendimento e privacidade</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Legal</h4>
            <ul className="footer-link-list">
              <li><a href="/termos.html">Termos de Uso</a></li>
              <li><a href="/privacidade.html">Privacidade e LGPD</a></li>
              <li><a href="/reembolso.html">Cancelamento e Reembolso</a></li>
              <li><a href="/seguranca.html">Segurança</a></li>
            </ul>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div className="shell footer-bottom-bar">
          <div className="footer-brand-meta">
            <a className="brand footer-brand" href="#top" aria-label="SixtySix, início">
              <img src="/assets/sidebar-logo-white.png" alt="SixtySix" className="brand-logo-img brand-logo-footer" />
            </a>
            <span className="footer-copyright">
              © 2026 Sixtysix · CNPJ 69.864.497/0001-92 · Todos os direitos reservados.
            </span>
          </div>

          <div className="footer-social-links">
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="footer-social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer-social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76c.92 0 1.66-.74 1.66-1.66s-.74-1.66-1.66-1.66c-.92 0-1.66.74-1.66 1.66s.74 1.66 1.66 1.66m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer-social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="footer-social-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <div className="shell footer-legal-wrap">
          <p className="footer-legal-copy">
            A Sixtysix é uma plataforma de tecnologia que gerencia tokens e provê infraestrutura de modelos de IA de fronteira para desenvolvedores. Cobrança transparente em Reais com previsibilidade total via Pix.
          </p>
        </div>
      </footer>
    </main>
  )
}
