import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus, Minus, ChevronDown, Check, X, Terminal, ShieldCheck, Zap, DollarSign } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { Slider } from '@/components/ui/slider-number-flow'
import NumberRoller from '@/components/ui/number-roller'
import PlanCardWaves from '@/components/ui/plan-card-waves'

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Cross = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="cross-icon">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const astraFaqs = [
  [
    'O que é o GPT Astra 6 e quais são seus diferenciais?',
    'O GPT Astra 6 é o modelo de linguagem e visão de altíssima velocidade otimizado para desenvolvedores. Ele entrega respostas instantâneas, raciocínio avançado para engenharia de software e suporte nativo a leitura de imagens, mockups e interfaces, tudo conectado à sua chave SixtySix.',
  ],
  [
    'O GPT Astra 6 suporta entrada multimodal (visão e imagens)?',
    'Sim! O Astra 6 conta com inteligência multimodal nativa. Você pode enviar capturas de tela de bugs, diagramas de arquitetura, telas do Figma e mockups visuais diretamente no chat do Cursor ou assistentes do VS Code para gerar código correspondente instantaneamente.',
  ],
  [
    'Em quais ferramentas e IDEs posso utilizar o GPT Astra 6?',
    'Você pode utilizar no Cursor IDE, VS Code (via extensões Cline, Roo Code, Continue ou CodeGPT), Codex CLI, Prompt de Comando, PowerShell ou qualquer biblioteca compatível com a API padrão OpenAI (como a SDK oficial de Python e TypeScript).',
  ],
  [
    'Como funciona o teste de 7 dias grátis?',
    'Você pode testar o GPT Astra 6 sem compromisso. Crie sua conta, solicite sua chave individual de teste com o nosso suporte no WhatsApp e comece a rodar o modelo hoje mesmo, sem precisar cadastrar cartão de crédito.',
  ],
  [
    'Qual o endpoint de gateway e nome do modelo para configurar?',
    'O endpoint base padrão compatível é https://66cloud.vercel.app/v1 e o identificador do modelo é gpt-astra-6. O passo a passo com comandos para Cursor, VS Code e Terminal está detalhado na seção acima.',
  ],
  [
    'A SixtySix impõe limites de mensagens a cada poucas horas como no ChatGPT Plus?',
    'Não! Na SixtySix você tem acesso ilimitado sem cortes de cota a cada 3 ou 5 horas. Você pode codificar o dia todo com fluxo contínuo e previsibilidade de custo em Reais via Pix.',
  ],
  [
    'Posso usar minha chave simultaneamente no Cursor e no terminal?',
    'Sim, sua chave individual SixtySix é multi-ambiente. Você pode conectá-la simultaneamente no seu Cursor para pair programming visual e no seu terminal para automações e scripts.',
  ],
]

export default function GptAstraPage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<'cursor' | 'vscode' | 'terminal'>('cursor')
  const [calcUsd, setCalcUsd] = useState(100)
  const [devWithApi, setDevWithApi] = useState(false)

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

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
  const sixBarPercentage = Math.min(100, Math.max(12, Math.round((sixtySixCost / totalAnthropicBRL) * 100)))

  const presetLevels = [
    { label: 'US$ 30', value: 30 },
    { label: 'US$ 60', value: 60 },
    { label: 'US$ 100', value: 100 },
    { label: 'US$ 150', value: 150 },
    { label: 'US$ 250', value: 250 },
  ]

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
    }
    document.addEventListener('click', handleOutsideClick)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      document.removeEventListener('click', handleOutsideClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(text)
    setTimeout(() => {
      setCopiedSnippet(null)
    }, 2000)
  }

  return (
    <main>
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
                  className={`nav-dropdown-btn ${megaMenuOpen ? 'is-open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMegaMenuOpen(!megaMenuOpen)
                  }}
                  aria-expanded={megaMenuOpen}
                >
                  Modelos & Integrações <ChevronDown size={14} className="dropdown-chevron" />
                </button>
              </div>
              <a href="#como-conectar-astra" className="nav-link">
                Como Conectar
              </a>
              <a href="#calculadora-astra" className="nav-link">
                Simulador de Custo
              </a>
              <a href="#planos-astra" className="nav-link">
                Planos & Preços
              </a>
              <a href="#duvidas-astra" className="nav-link">
                Dúvidas
              </a>
            </div>
          </div>
          <div className="nav-right">
            <Link to="/" className="nav-login-link">
              Entrar
            </Link>
            <a href="#planos-astra" className="btn btn-primary nav-cta">
              Começar no Pix <Arrow />
            </a>
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
                  <span className="nav-mobile-group-title">Modelos Oficiais de IA</span>
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
                <span className="mega-menu-col-title">Modelos Oficiais de IA</span>
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
                    <span>Velocidade ultra-rápida e inteligência multimodal.</span>
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
                  <Link to="/" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GLM-4 Plus</strong>
                    <span>Excelente em refatoração, documentação e testes.</span>
                  </Link>
                  <a href="/#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Conexão Direta Oficial</strong>
                    <span>Sem intermediários, sem compressão e sem erros 429.</span>
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
                    <strong>Uso 100% Ilimitado</strong>
                    <span>Sem limites diários de prompts ou cortes de velocidade.</span>
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
          </div>
        )}
      </header>

      {/* Hero GPT Astra 6 */}
      <section className="claude-hero-wrap shell">
        <motion.div
          className="claude-hero"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">modelo oficial · velocidade extrema & multimodal</span>
          <h1 className="claude-hero-title">
            GPT Astra 6 sem limites. <br />
            Velocidade recorde no <span className="highlight-green-text">Cursor e Terminal.</span>
          </h1>
          <p className="claude-hero-sub">
            Desenvolva com inteligência multimodal ultra-rápida conectando sua chave individual SixtySix diretamente no <strong>Cursor</strong>, <strong>VS Code (Cline & Roo)</strong> ou <strong>Codex</strong>. Sem cortes de cotas a cada poucas horas e com preço fixo em Reais via Pix.
          </p>

          <div className="hero-action-slot">
            <AnimatePresence mode="wait">
              {heroAction === 'primary' ? (
                <motion.div
                  key="primary"
                  className="hero-action-state"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <a href="#planos-astra" className="hero-cta-btn">
                    Começar no Astra 6 <Arrow />
                  </a>
                  <p className="hero-footnote">
                    Acesso imediato no Pix · Chave individual sem rateio
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="secondary"
                  className="hero-action-state"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                >
                  <a href="#como-conectar-astra" className="hero-cta-btn hero-cta-btn-alt">
                    Ver Tutorial de Conexão <Arrow />
                  </a>
                  <p className="hero-footnote">
                    Configuração em 2 minutos no Cursor, VS Code e Terminal
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hero-action-toggles">
            <button
              type="button"
              className={`hero-toggle-pill ${heroAction === 'primary' ? 'is-active' : ''}`}
              onClick={() => setHeroAction('primary')}
            >
              Garantir no Pix
            </button>
            <button
              type="button"
              className={`hero-toggle-pill ${heroAction === 'secondary' ? 'is-active' : ''}`}
              onClick={() => setHeroAction('secondary')}
            >
              Ver Tutorial Passo a Passo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Grid de Diferenciais Astra 6 */}
      <section className="claude-cards-section shell">
        <div className="claude-cards-grid">
          <motion.div
            className="claude-feature-card"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="claude-card-icon-wrap">
              <Zap className="claude-card-icon" />
            </div>
            <h3 className="claude-card-title">Velocidade Instantânea</h3>
            <p className="claude-card-desc">
              Geração de tokens em alta velocidade com baixíssima latência. Perfeito para autocompletar código em tempo real no Cursor e refatorações instantâneas.
            </p>
          </motion.div>

          <motion.div
            className="claude-feature-card"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.1, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="claude-card-icon-wrap">
              <ShieldCheck className="claude-card-icon" />
            </div>
            <h3 className="claude-card-title">Inteligência Multimodal</h3>
            <p className="claude-card-desc">
              Analise capturas de tela, designs do Figma e diagramas de arquitetura diretamente no prompt para transformar imagens em código funcional sem esforço.
            </p>
          </motion.div>

          <motion.div
            className="claude-feature-card"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 1.1, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="claude-card-icon-wrap">
              <Terminal className="claude-card-icon" />
            </div>
            <h3 className="claude-card-title">Compatível com OpenAI SDK</h3>
            <p className="claude-card-desc">
              Integração transparente com qualquer ferramenta compatível com a API OpenAI: Cursor, Cline, Roo Code, Continue, scripts Python e automações no terminal.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tutorial Passo a Passo com Abas Interativas */}
      <section className="claude-tutorial-section shell" id="como-conectar-astra">
        <motion.div
          className="claude-tutorial-header"
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow">tutorial de integração oficial</span>
          <h2 className="claude-tutorial-title">
            Como conectar o GPT Astra 6 no seu ambiente
          </h2>
          <p className="claude-tutorial-sub">
            Em menos de 2 minutos você aponta o gateway oficial da SixtySix na sua ferramenta favorita e começa a codificar com uso ilimitado.
          </p>

          <div className="claude-app-selector">
            <button
              type="button"
              className={`claude-app-btn ${selectedApp === 'cursor' ? 'is-active' : ''}`}
              onClick={() => setSelectedApp('cursor')}
            >
              Cursor IDE
            </button>
            <button
              type="button"
              className={`claude-app-btn ${selectedApp === 'vscode' ? 'is-active' : ''}`}
              onClick={() => setSelectedApp('vscode')}
            >
              VS Code (Cline / Roo)
            </button>
            <button
              type="button"
              className={`claude-app-btn ${selectedApp === 'terminal' ? 'is-active' : ''}`}
              onClick={() => setSelectedApp('terminal')}
            >
              Terminal & Scripts
            </button>
          </div>
        </motion.div>

        {/* Conteúdo da Aba Selecionada */}
        <div className="claude-tutorial-body">
          {selectedApp === 'cursor' && (
            <motion.div
              key="cursor"
              className="claude-tutorial-steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 1</span>
                <h4 className="claude-step-title">Abra as configurações de modelo no Cursor</h4>
                <p className="claude-step-desc">
                  No Cursor, clique no ícone de engrenagem no canto superior direito e selecione a aba <strong>Models</strong>.
                </p>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 2</span>
                <h4 className="claude-step-title">Configure a Base URL do Gateway SixtySix</h4>
                <p className="claude-step-desc">
                  Na seção <strong>OpenAI API Key</strong>, ative a opção <strong>Override OpenAI Base URL</strong> e insira o endereço do gateway:
                </p>
                <div className="claude-code-box">
                  <code>https://66cloud.vercel.app/v1</code>
                  <button
                    type="button"
                    className="claude-copy-btn"
                    onClick={() => copyToClipboard('https://66cloud.vercel.app/v1')}
                  >
                    {copiedSnippet === 'https://66cloud.vercel.app/v1' ? <Check size={14} /> : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 3</span>
                <h4 className="claude-step-title">Adicione o modelo e cole sua chave individual</h4>
                <p className="claude-step-desc">
                  Adicione o modelo com o nome exato <code>gpt-astra-6</code> e insira sua chave fornecida pela SixtySix no campo de chave. Clique em salvar e aproveite o modelo com velocidade máxima!
                </p>
              </div>
            </motion.div>
          )}

          {selectedApp === 'vscode' && (
            <motion.div
              key="vscode"
              className="claude-tutorial-steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 1</span>
                <h4 className="claude-step-title">Abra as configurações do seu assistente (Cline ou Roo Code)</h4>
                <p className="claude-step-desc">
                  Na barra lateral do VS Code, abra o Cline ou Roo Code e clique no ícone de engrenagem para acessar as configurações do provedor de IA.
                </p>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 2</span>
                <h4 className="claude-step-title">Selecione o provedor OpenAI-Compatible</h4>
                <p className="claude-step-desc">
                  Selecione o provedor <strong>OpenAI Compatible</strong> e configure a URL base:
                </p>
                <div className="claude-code-box">
                  <code>https://66cloud.vercel.app/v1</code>
                  <button
                    type="button"
                    className="claude-copy-btn"
                    onClick={() => copyToClipboard('https://66cloud.vercel.app/v1')}
                  >
                    {copiedSnippet === 'https://66cloud.vercel.app/v1' ? <Check size={14} /> : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 3</span>
                <h4 className="claude-step-title">Configure o Model ID como gpt-astra-6</h4>
                <p className="claude-step-desc">
                  Digite <code>gpt-astra-6</code> no campo Model ID e insira sua chave individual. Pronto! Suas tarefas de código rodarão sem paradas de cota.
                </p>
              </div>
            </motion.div>
          )}

          {selectedApp === 'terminal' && (
            <motion.div
              key="terminal"
              className="claude-tutorial-steps"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 1</span>
                <h4 className="claude-step-title">Defina as variáveis no Prompt de Comando (Windows)</h4>
                <p className="claude-step-desc">
                  Abra o Prompt de Comando (CMD) e defina a Base URL e a chave da SixtySix:
                </p>
                <div className="claude-code-box">
                  <code>setx OPENAI_BASE_URL "https://66cloud.vercel.app/v1"</code>
                  <button
                    type="button"
                    className="claude-copy-btn"
                    onClick={() => copyToClipboard('setx OPENAI_BASE_URL "https://66cloud.vercel.app/v1"')}
                  >
                    {copiedSnippet === 'setx OPENAI_BASE_URL "https://66cloud.vercel.app/v1"' ? <Check size={14} /> : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 2</span>
                <h4 className="claude-step-title">Configure a Chave Individual de API</h4>
                <p className="claude-step-desc">
                  Substitua pelo token exclusivo recebido no seu WhatsApp e execute:
                </p>
                <div className="claude-code-box">
                  <code>setx OPENAI_API_KEY "SUA_CHAVE_INDIVIDUAL"</code>
                  <button
                    type="button"
                    className="claude-copy-btn"
                    onClick={() => copyToClipboard('setx OPENAI_API_KEY "SUA_CHAVE_INDIVIDUAL"')}
                  >
                    {copiedSnippet === 'setx OPENAI_API_KEY "SUA_CHAVE_INDIVIDUAL"' ? <Check size={14} /> : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="claude-step-card">
                <span className="claude-step-badge">Passo 3</span>
                <h4 className="claude-step-title">Reabra o terminal e utilize com qualquer script ou CLI</h4>
                <p className="claude-step-desc">
                  Feche e reabra o terminal para carregar as variáveis. Agora você pode chamar o modelo <code>gpt-astra-6</code> em qualquer biblioteca oficial da OpenAI!
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Bloco Simulador de Custos Dólar vs Pix */}
      <section className="claude-price-intro-wrap shell" id="calculadora-astra">
        <div className="claude-price-intro">
          <motion.div
            className="claude-price-intro-col-left"
            initial={{ opacity: 0, x: -75 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="eyebrow">simulador de custos</span>
            <h2 className="claude-price-intro-title">
              Quanto custa usar o <br />
              <span className="highlight-green-text">GPT Astra 6?</span>
            </h2>
            <p className="claude-price-intro-sub">
              A partir de <strong>R$ 79,99 fixos no Pix</strong> (ou <strong>teste 7 dias grátis</strong>), <strong>sem mensalidade surpresa</strong> e <strong>sem limites de cota</strong>.
              Diferente de assinar plataformas no cartão com IOF e spread abusivo em Dólar, aqui você tem previsibilidade total.
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

        {/* Bloco Verde Preenchido da Calculadora */}
        <motion.div
          className="claude-calc-dark-wrap"
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="claude-calc-dark-header">
            <span className="claude-calc-dark-badge">Simulação em Tempo Real</span>
            <h3 className="claude-calc-dark-title">Quanto você gastaria na fatura em Dólar?</h3>
            <p className="claude-calc-dark-sub">
              Arraste o slider para simular seu consumo mensal ou escolha um patamar rápido:
            </p>
          </div>

          <div className="claude-calc-dark-presets">
            {presetLevels.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                className={`claude-calc-dark-pill ${calcUsd === lvl.value ? 'is-active' : ''}`}
                onClick={() => setCalcUsd(lvl.value)}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <div className="claude-calc-dark-slider-box">
            <div className="claude-calc-dark-slider-meta">
              <span className="slider-label">Seu consumo mensal estimado em Dólar:</span>
              <span className="slider-value">
                <NumberRoller value={calcUsd} prefix="US$ " decimals={2} duration={0.45} />
                <span className="slider-brl">
                  ≈{' '}
                  <NumberRoller value={totalAnthropicBRL} prefix="R$ " decimals={2} duration={0.45} />
                </span>
              </span>
            </div>

            <Slider
              value={[calcUsd]}
              min={20}
              max={300}
              step={5}
              onValueChange={(val) => setCalcUsd(val[0])}
              className="claude-calc-slider-custom"
            />
          </div>

          <div className="claude-calc-dark-cards-grid">
            <div className="claude-calc-glass-card">
              <div className="claude-glass-card-header">
                <span className="glass-card-tag">Plano Recomendado</span>
                <h4 className="glass-card-title">{sixtySixPlanName} SixtySix</h4>
              </div>

              <div className="claude-glass-card-price">
                <span className="glass-price-curr">R$</span>
                <span className="glass-price-num">
                  <NumberRoller value={sixtySixCost} prefix="R$ " decimals={2} duration={0.45} />
                </span>
                <span className="glass-price-period">/ mês no Pix</span>
              </div>

              <span className="glass-card-desc">
                {calcUsd <= 60
                  ? 'Acesso completo ao GPT Astra 6 e GLM-4 Plus com preço fixo sem surpresas cambiais.'
                  : 'Acesso total e irrestrito ao GPT Astra 6, Claude Fable 5.1 e GLM-4 Plus.'}
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

      {/* Planos Oficiais */}
      <section className="plans-section shell" id="planos-astra">
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
            Conecte sua chave no <strong>Cursor</strong>, <strong>VS Code</strong> ou <strong>Codex</strong> e programe com preço fixo no Pix, sem bloqueios de cota e sem oscilação cambial.
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
              <li><Check /> <span><strong>GPT Astra 6</strong>, <strong>Claude Fable</strong> e <strong>GLM-4</strong></span></li>
              <li><Check /> <span><strong>Cursor</strong>, <strong>VS Code</strong> & <strong>Terminal</strong></span></li>
              <li><Check /> <span><strong>Chave oficial própria</strong> (Zero Rateio)</span></li>
              <li><Check /> <span><strong>Sem cartão de crédito</strong> necessário</span></li>
            </ul>
            <a href="#duvidas-astra" className="plan-btn">
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

              {/* Seletor de Opção de API */}
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
                  <li><Check /> <span><strong>Cursor</strong>, <strong>VS Code</strong> & <strong>Terminal</strong></span></li>
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
              <li><Check /> <span><strong>Uso 100% Ilimitado</strong> (sem travas diárias)</span></li>
              <li><Check /> <span><strong>Zero Rateio</strong> (chave oficial e segura)</span></li>
              <li><Check /> <span><strong>Modelos Oficiais</strong> (99.9% uptime)</span></li>
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
            <span className="faq-title-green">Dúvidas sobre o GPT Astra 6?</span> <br />
            Nós temos as respostas.
          </h2>
          <p className="faq-subtitle">
            Veja as respostas mais comuns sobre velocidade, tokens, visão multimodal e integração do Astra 6 com as IDEs.
          </p>
          <div className="faq-action">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="faq-support-btn">
              Falar no WhatsApp com Suporte <Arrow />
            </a>
            <span className="faq-support-hint">Atendimento de Seg a Dom</span>
          </div>
        </motion.div>

        <motion.div
          className="faq-list"
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <AccordionPrimitive.Root type="single" collapsible defaultValue="item-0">
            {astraFaqs.map(([question, answer], idx) => (
              <AccordionPrimitive.Item key={idx} value={`item-${idx}`} className="faq-item">
                <AccordionPrimitive.Header>
                  <AccordionPrimitive.Trigger className="faq-question">
                    <span>{question}</span>
                    <span className="faq-icon-box">
                      <Plus className="faq-icon-plus" />
                      <Minus className="faq-icon-minus" />
                    </span>
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <AccordionPrimitive.Content className="faq-answer">
                  <div className="faq-answer-inner">{answer}</div>
                </AccordionPrimitive.Content>
              </AccordionPrimitive.Item>
            ))}
          </AccordionPrimitive.Root>
        </motion.div>
      </section>

      {/* Pre-Footer CTA */}
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
            <a href="#planos-astra" className="pre-footer-btn">
              Vai, clica logo nesse botão
            </a>
          </div>
          <p className="pre-footer-footnote">
            Preço fixo no Pix. Chave individual com Zero Rateio.
          </p>
        </motion.div>
      </section>

      {/* Rodapé Oficial em 2 Colunas no Mobile */}
      <footer className="footer-wrap">
        <div className="shell footer-columns-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Modelos</h4>
            <ul className="footer-link-list">
              <li><Link to="/astra-6">GPT Astra 6</Link></li>
              <li><Link to="/claude-code">Claude Fable 5.1</Link></li>
              <li><Link to="/">GLM-4 Plus</Link></li>
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
              <li><a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">Suporte no WhatsApp</a></li>
              <li><a href="/#como-funciona">Status do Cluster</a></li>
              <li><a href="mailto:suporte@sixtysix.dev">suporte@sixtysix.dev</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Legal & Termos</h4>
            <ul className="footer-link-list">
              <li><a href="/#duvidas">Termos de Uso</a></li>
              <li><a href="/#duvidas">Política de Privacidade</a></li>
              <li><a href="/#duvidas">Garantia 7 Dias</a></li>
              <li><a href="/#duvidas">CNPJ 69.864.497/0001-92</a></li>
            </ul>
          </div>
        </div>

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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="footer-social-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
