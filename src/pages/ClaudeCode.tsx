import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus, Minus, ChevronDown, Check, Terminal, ShieldCheck, Zap, DollarSign } from 'lucide-react'

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const claudeFaqs = [
  [
    'Como funciona o acesso ao Claude Code pela SixtySix?',
    'Você utiliza o Claude Code CLI oficial da Anthropic no seu terminal conectado ao nosso cluster dedicado com Claude Fable 5.1. Você programa sem cortes de cotas de 5 horas, sem surpresas de IOF ou oscilação do Dólar na fatura, pagando valor fixo e previsível em Reais via Pix.',
  ],
  [
    'Como funciona o teste de 7 dias grátis?',
    'Você pode testar o Claude Code no seu terminal sem compromisso. Crie sua conta, solicite sua chave individual com nosso suporte e comece a rodar o agente hoje mesmo, sem precisar cadastrar cartão de crédito.',
  ],
  [
    'Onde consigo minha chave individual de acesso para o Claude?',
    'Sua chave individual é gerada com exclusividade e entregue diretamente pelo administrador. Cada usuário possui sua própria chave isolada, garantindo total privacidade, zero rateio e alta estabilidade de conexão.',
  ],
  [
    'Em quais terminais e ambientes posso rodar o Claude Code?',
    'Você pode rodar o Claude Code CLI nativamente no Prompt de Comando (CMD), PowerShell, WSL ou no terminal integrado do VS Code e Cursor. Basta configurar as variáveis de ambiente com a sua chave e executar o comando claude.',
  ],
  [
    'Posso usar no Claude direto pelo navegador (Claude.ai)?',
    'Não no site padrão claude.ai, pois a interface web da Anthropic não permite alterar o endpoint de API. Você pode usar no aplicativo Claude Desktop (quando a versão permitir gateway personalizado) ou no Claude Code diretamente no seu terminal.',
  ],
  [
    'Qual endereço (URL do gateway) e modelo devo configurar para o Claude?',
    'O endereço base oficial é https://66cloud.vercel.app e o identificador do modelo é claude-fable-5-1. O passo a passo completo com os comandos prontos para colar no seu Prompt de Comando está disponível na seção de tutorial passo a passo acima.',
  ],
  [
    'A chave não funcionou no Claude Code. O que devo verificar?',
    'Verifique 5 pontos simples: 1) Se o endereço base é exatamente https://66cloud.vercel.app; 2) Se o modelo foi digitado como claude-fable-5-1; 3) Se copiou a chave completa sem espaços antes ou depois; 4) Se as variáveis foram aplicadas na mesma janela aberta do CMD; 5) Se a sua chave continua ativa com o administrador. Se precisar de ajuda, nosso suporte está disponível via WhatsApp.',
  ],
]

export default function ClaudeCodePage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [selectedApp, setSelectedApp] = useState<'claude-code' | 'claude-desktop' | 'codex'>('claude-code')
  const [calcUsd, setCalcUsd] = useState(100)

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Cotação real do Dólar no cartão (comercial + IOF + Spread bancário):
  const commercialDollar = 5.85
  const iofRate = 0.0438
  const cardSpread = 0.045
  const effectiveDollarRate = commercialDollar * (1 + iofRate + cardSpread) // ~R$ 6.37

  const totalAnthropicBRL = calcUsd * effectiveDollarRate
  const sixtySixCost = calcUsd <= 35 ? 39 : calcUsd <= 65 ? 79 : 119
  const sixtySixPlanName = calcUsd <= 35 ? 'Starter' : calcUsd <= 65 ? 'Dev' : 'Pro Ilimitado'

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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
      if (window.scrollY > 20) {
        setMegaMenuOpen(false)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSnippet(text)
    setTimeout(() => setCopiedSnippet(null), 2000)
  }

  return (
    <main className="claude-code-page">
      {/* Header & Navbar */}
      <header
        className={`nav-wrapper ${isScrolled ? 'nav-scrolled' : ''}`}
        onMouseLeave={() => setMegaMenuOpen(false)}
      >
        <nav className="nav">
          <div className="nav-left">
            <Link className="brand" to="/" aria-label="Six, início">
              <img src="/assets/logo.webp" alt="Six" className="brand-logo-img" />
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
              <a href="/#como-funciona">Como funciona</a>
              <a href="/#economia">Calculadora</a>
              <a href="#planos-claude">Preço</a>
              <a href="#duvidas-claude">Dúvidas</a>
            </div>
          </div>

          <div className="nav-right">
            <Link to="/" className="nav-login-link">
              Entrar
            </Link>
            <a href="#planos-claude" className="nav-cta-btn">
              Testar Claude Code
            </a>
          </div>
        </nav>

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
                  <a href="/#planos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GPT Astra 6</strong>
                    <span>Velocidade ultra-rápida e inteligência multimodal.</span>
                  </a>
                  <a href="/#planos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>GLM-4 Plus</strong>
                    <span>Excelente em refatoração, documentação e testes.</span>
                  </a>
                  <a href="/#recursos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Conexão Direta Oficial</strong>
                    <span>Sem intermediários, sem compressão e sem erros 429.</span>
                  </a>
                </div>
              </div>

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
                  <a href="/#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Cursor IDE</strong>
                    <span>Substitua sua chave de API e programe sem interrupção.</span>
                  </a>
                  <a href="/#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>VS Code (Cline & Roo)</strong>
                    <span>Suporte nativo aos melhores assistentes do mercado.</span>
                  </a>
                  <a href="/#como-funciona" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Codex & Terminal</strong>
                    <span>Ambientes de desenvolvimento com contexto estendido.</span>
                  </a>
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
                  <a href="/#planos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Preço Fixo em Reais (Pix)</strong>
                    <span>Esqueça IOF e variações do Dólar na fatura do cartão.</span>
                  </a>
                  <a href="/#economia" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Alta Estabilidade 99.9%</strong>
                    <span>Respostas rápidas sem travamentos no meio do deploy.</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="mega-menu-footer">
              <a href="/#planos" className="mega-footer-link" onClick={() => setMegaMenuOpen(false)}>
                Ver todos os planos disponíveis <Arrow />
              </a>
              <a href="/#economia" className="mega-footer-link" onClick={() => setMegaMenuOpen(false)}>
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
          <div className="claude-hero-content">
            <div className="hero-abacate-badge">
              <span className="hero-abacate-dot" />
              <span>Claude Code CLI SixtySix</span>
            </div>

            <h1 className="hero-abacate-title">
              <span className="hero-title-block">
                O poder total do <em>Claude Code.</em>
              </span>
              <span className="hero-title-block">
                Sem sustos na fatura em Dólar.
              </span>
            </h1>

            <p className="hero-abacate-subtitle">
              Programe com o agente autônomo mais avançado do mundo direto no seu terminal.
              Conecte sua chave própria da SixtySix, esqueça limites diários de cotas e codifique com preço fixo no Pix.
            </p>

            <div
              className="hero-actions"
              onMouseLeave={() => setHeroAction('primary')}
            >
              <a
                href="#planos-claude"
                className={`hero-action-pill ${heroAction === 'primary' ? 'is-active' : ''}`}
                onMouseEnter={() => setHeroAction('primary')}
                onClick={() => setHeroAction('primary')}
              >
                {heroAction === 'primary' && (
                  <motion.div
                    layoutId="claude-hero-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Testar 7 dias grátis <Arrow />
                </span>
              </a>

              <a
                href="#passo-a-passo"
                className={`hero-action-pill ${heroAction === 'secondary' ? 'is-active' : ''}`}
                onMouseEnter={() => setHeroAction('secondary')}
                onClick={() => setHeroAction('secondary')}
              >
                {heroAction === 'secondary' && (
                  <motion.div
                    layoutId="claude-hero-pill-indicator"
                    className="hero-active-pill-bg"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="hero-pill-content">
                  Ver comandos <Arrow />
                </span>
              </a>
            </div>

            <p className="hero-abacate-footnote">
              Sem mensalidade surpresa. Chave própria com Zero Rateio.
            </p>
          </div>

          {/* Coluna da Arte & Badges Flutuantes (Estilo AbacatePay) */}
          <div className="hero-abacate-art-col">
            <div className="hero-art-stage">
              {/* Anotação estilo manuscrito com seta apontando bem pertinho da nuvem de pensamento */}
              <div className="hero-handwritten-wrap">
                <span className="hero-handwritten-text">já dizia napoleão:</span>
                <svg
                  className="hero-handwritten-arrow"
                  width="40"
                  height="26"
                  viewBox="0 0 40 26"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M2 13 C 14 5, 26 7, 36 15"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M27 11 L 36 15 L 29 23"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Imagem do Napoleão recortada transparente */}
              <img
                src="/assets/claude-code-ou-morte.webp"
                alt="Napoleão: claude code ou morte"
                className="hero-abacate-artwork"
              />

              {/* Badge Flutuante Esquerda */}
              <div className="floating-badge floating-badge-left">
                <div className="floating-badge-icon badge-icon-check">
                  <Check size={18} strokeWidth={2.5} />
                </div>
                <div className="floating-badge-copy">
                  <span className="floating-badge-label">Claude Code CLI · agora</span>
                  <span className="floating-badge-val">
                    <strong>100% Ilimitado</strong>
                    <span className="badge-pill-green">Ativo</span>
                  </span>
                </div>
              </div>

              {/* Badge Flutuante Direita */}
              <div className="floating-badge floating-badge-right">
                <div className="floating-badge-icon badge-icon-pix">
                  <DollarSign size={18} strokeWidth={2.4} />
                </div>
                <div className="floating-badge-copy">
                  <span className="floating-badge-label">Preço fixo no Pix</span>
                  <span className="floating-badge-val">
                    <strong>Sem IOF cambial</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa de Métricas / Diferenciais estilo AbacatePay */}
      <section className="abacate-stats-section shell">
        <div className="abacate-stats-strip">
          <div className="abacate-stat-col">
            <h3 className="abacate-stat-val">Zero Rateio</h3>
            <p className="abacate-stat-desc">chave própria e individual</p>
          </div>
          <div className="abacate-stat-col">
            <h3 className="abacate-stat-val">Segundos</h3>
            <p className="abacate-stat-desc">do comando à resposta no terminal</p>
          </div>
          <div className="abacate-stat-col">
            <h3 className="abacate-stat-val">24 × 7</h3>
            <p className="abacate-stat-desc">sem travas por limites de 5 horas</p>
          </div>
          <div className="abacate-stat-col">
            <h3 className="abacate-stat-val">No Pix</h3>
            <p className="abacate-stat-desc">preço fixo sem sustos em Dólar</p>
          </div>
        </div>
      </section>

      {/* Guia Oficial de Conexão e Tutoriais */}
      <section className="claude-steps-section shell" id="passo-a-passo">
        <div className="claude-section-header">
          <span className="eyebrow">instruções de conexão</span>
          <h2 className="claude-section-title">
            Como conectar suas ferramentas ao gateway <em>SixTySix.</em>
          </h2>
          <p className="claude-section-subtitle">
            Instruções oficiais e passo a passo simples para configurar Claude Code, Claude Desktop e Codex no Windows.
          </p>
        </div>

        {/* Seletor de Aplicativo estilo Pílula */}
        <div className="tutorial-tabs-wrap">
          <div className="tutorial-tabs">
            <button
              type="button"
              className={`tutorial-tab-btn ${selectedApp === 'claude-code' ? 'active' : ''}`}
              onClick={() => setSelectedApp('claude-code')}
            >
              <Terminal size={15} />
              <span>Claude Code (Terminal CMD)</span>
            </button>
            <button
              type="button"
              className={`tutorial-tab-btn ${selectedApp === 'claude-desktop' ? 'active' : ''}`}
              onClick={() => setSelectedApp('claude-desktop')}
            >
              <span>Claude Desktop</span>
            </button>
            <button
              type="button"
              className={`tutorial-tab-btn ${selectedApp === 'codex' ? 'active' : ''}`}
              onClick={() => setSelectedApp('codex')}
            >
              <span>Codex (Windows)</span>
            </button>
          </div>
        </div>

        {/* Aba 1: Claude Code no terminal do Windows (CMD) */}
        {selectedApp === 'claude-code' && (
          <div className="tutorial-pane">
            <div className="tutorial-intro-card">
              <p>
                No Windows, abra a janela do <strong>Prompt de Comando (CMD)</strong> e configure as variáveis de ambiente antes de rodar o agente.
                As variáveis definidas com o comando <code>set</code> valem especificamente para aquela janela do CMD aberta.
                Substitua <code>SUA_CHAVE_INDIVIDUAL</code> pela sua chave individual fornecida pelo administrador.
              </p>
            </div>

            <div className="tutorial-steps-grid">
              <div className="claude-step-card">
                <div className="claude-step-top">
                  <span className="claude-step-badge">Passo 01</span>
                  <h4>Instale o CLI Oficial</h4>
                </div>
                <p>Se ainda não tiver instalado, instale o pacote oficial da Anthropic globalmente pelo npm:</p>
                <div className="snippet-box">
                  <code>npm install -g @anthropic-ai/claude-code</code>
                  <button
                    type="button"
                    className="btn-copy"
                    onClick={() => copyText('npm install -g @anthropic-ai/claude-code')}
                  >
                    {copiedSnippet === 'npm install -g @anthropic-ai/claude-code' ? <Check /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                    <span>{copiedSnippet === 'npm install -g @anthropic-ai/claude-code' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="claude-step-card tutorial-step-large">
                <div className="claude-step-top">
                  <span className="claude-step-badge">Passo 02</span>
                  <h4>Defina as Variáveis no CMD e Inicie</h4>
                </div>
                <p>Execute exatamente o bloco de comandos abaixo na sua janela do Prompt de Comando (CMD):</p>
                <div className="code-block-box">
                  <pre>
{`set ANTHROPIC_BASE_URL=https://66cloud.vercel.app
set ANTHROPIC_API_KEY=SUA_CHAVE_INDIVIDUAL
set ANTHROPIC_MODEL=claude-fable-5-1
claude --model claude-fable-5-1`}
                  </pre>
                  <button
                    type="button"
                    className="code-block-copy-btn"
                    onClick={() => copyText(`set ANTHROPIC_BASE_URL=https://66cloud.vercel.app\nset ANTHROPIC_API_KEY=SUA_CHAVE_INDIVIDUAL\nset ANTHROPIC_MODEL=claude-fable-5-1\nclaude --model claude-fable-5-1`)}
                  >
                    {copiedSnippet?.includes('set ANTHROPIC_BASE_URL') ? (
                      <>
                        <Check size={14} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        <span>Copiar Comandos CMD</span>
                      </>
                    )}
                  </button>
                </div>
                <span className="tutorial-footnote">
                  Importante: substitua <code>SUA_CHAVE_INDIVIDUAL</code> pela sua própria chave. As variáveis definidas com <code>set</code> valem para aquela janela do CMD. Se abrir outra janela, repita os comandos.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Aba 2: Claude Desktop */}
        {selectedApp === 'claude-desktop' && (
          <div className="tutorial-pane">
            <div className="tutorial-intro-card">
              <p>
                O aplicativo <strong>Claude Desktop</strong> pode utilizar a opção de inferência por gateway de terceiros quando ela estiver disponível naquela versão instalada. Caso a opção de inferência personalizada esteja disponível na sua versão (ela pode aparecer com outro nome conforme a versão instalada), preencha os parâmetros abaixo:
              </p>
            </div>

            <div className="tutorial-desktop-grid">
              <div className="desktop-param-card">
                <span className="desktop-param-label">Endereço Base (Base URL)</span>
                <code className="desktop-param-val">https://66cloud.vercel.app</code>
              </div>
              <div className="desktop-param-card">
                <span className="desktop-param-label">Autenticação</span>
                <code className="desktop-param-val">Cabeçalho x-api-key</code>
              </div>
              <div className="desktop-param-card">
                <span className="desktop-param-label">Chave de API Individual</span>
                <code className="desktop-param-val">SUA_CHAVE_INDIVIDUAL</code>
              </div>
              <div className="desktop-param-card">
                <span className="desktop-param-label">Identificador do Modelo</span>
                <code className="desktop-param-val">claude-fable-5-1</code>
              </div>
            </div>

            <div className="tutorial-notice-box">
              <strong>Atenção:</strong> Essa configuração é exclusiva para o aplicativo Claude Desktop. No site claude.ai tradicional via navegador comum não é possível alterar o endpoint da API.
            </div>
          </div>
        )}

        {/* Aba 3: Codex para Windows */}
        {selectedApp === 'codex' && (
          <div className="tutorial-pane">
            <div className="tutorial-intro-card">
              <p>
                O <strong>Codex para Windows</strong> conecta ao gateway SixTySix através da Responses API e cabeçalho <code>x-api-key</code>. Siga os 3 passos simples abaixo:
              </p>
            </div>

            <div className="tutorial-codex-grid">
              <div className="claude-step-card">
                <div className="claude-step-top">
                  <span className="claude-step-badge">Passo 01</span>
                  <h4>Configure a Variável de Ambiente</h4>
                </div>
                <p>
                  No Windows, configure a sua chave individual em uma variável de ambiente chamada <code>SIXTYSIX_GATEWAY_API_KEY</code> (substitua <code>SUA_CHAVE_INDIVIDUAL</code> pela sua chave):
                </p>
                <div className="snippet-box">
                  <code>setx SIXTYSIX_GATEWAY_API_KEY "SUA_CHAVE_INDIVIDUAL"</code>
                  <button
                    type="button"
                    className="btn-copy"
                    onClick={() => copyText('setx SIXTYSIX_GATEWAY_API_KEY "SUA_CHAVE_INDIVIDUAL"')}
                  >
                    {copiedSnippet === 'setx SIXTYSIX_GATEWAY_API_KEY "SUA_CHAVE_INDIVIDUAL"' ? <Check /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                    <span>{copiedSnippet === 'setx SIXTYSIX_GATEWAY_API_KEY "SUA_CHAVE_INDIVIDUAL"' ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="claude-step-card tutorial-step-large">
                <div className="claude-step-top">
                  <span className="claude-step-badge">Passo 02</span>
                  <h4>Mescle no arquivo config.toml</h4>
                </div>
                <p>
                  Abra o arquivo <code>%USERPROFILE%\.codex\config.toml</code> e acrescente estas opções, mesclando com o conteúdo existente sem apagar outras configurações nem duplicar tabelas:
                </p>
                <div className="code-block-box">
                  <pre>
{`model = "gpt-6-astra"
model_provider = "sixtysix"
web_search = "disabled"

[model_providers.sixtysix]
name = "Gateway"
base_url = "https://66cloud.vercel.app/v1"
wire_api = "responses"
requires_openai_auth = false
env_http_headers = { "x-api-key" = "SIXTYSIX_GATEWAY_API_KEY" }
model_catalog_url = "https://66cloud.vercel.app/api/codex/models"`}
                  </pre>
                  <button
                    type="button"
                    className="code-block-copy-btn"
                    onClick={() => copyText(`model = "gpt-6-astra"\nmodel_provider = "sixtysix"\nweb_search = "disabled"\n\n[model_providers.sixtysix]\nname = "Gateway"\nbase_url = "https://66cloud.vercel.app/v1"\nwire_api = "responses"\nrequires_openai_auth = false\nenv_http_headers = { "x-api-key" = "SIXTYSIX_GATEWAY_API_KEY" }\nmodel_catalog_url = "https://66cloud.vercel.app/api/codex/models"`)}
                  >
                    {copiedSnippet?.includes('model = "gpt-6-astra"') ? (
                      <>
                        <Check size={14} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        <span>Copiar Bloco TOML</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="claude-step-card">
                <div className="claude-step-top">
                  <span className="claude-step-badge">Passo 03</span>
                  <h4>Salve e Reinicie o Codex</h4>
                </div>
                <p>
                  Salve as alterações no arquivo <code>config.toml</code> e reinicie o aplicativo Codex para que a conexão com o gateway e o modelo <strong>GPT-6 Astra</strong> sejam ativados.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Calculadora Interativa Dólar vs Real (Pix) */}
      <section className="claude-compare-section shell" id="calculadora-dolar">
        <div className="claude-section-header">
          <span className="eyebrow">simulador de custos · dólar vs real</span>
          <h2 className="claude-section-title">
            Converta sua fatura em Dólar e veja a economia na <em>SixtySix.</em>
          </h2>
          <p className="claude-section-subtitle">
            O Claude Code é incrível, mas a fatura em Dólar com IOF de 4,38% e spread bancário assusta no fim do mês. Compare seu consumo na Anthropic com o valor fixo no Pix.
          </p>
        </div>

        {/* Calculadora Interativa Dólar vs Real */}
        <div className="claude-calc-card">
          <div className="claude-calc-grid">
            {/* Coluna 1: Controles de Dólar */}
            <div className="claude-calc-controls">
              <div className="claude-calc-control-top">
                <span className="claude-calc-label">Consumo estimado em Dólar</span>
                <span className="claude-calc-usd-val">US$ {calcUsd}</span>
              </div>

              <div className="claude-calc-slider-wrap">
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="10"
                  value={calcUsd}
                  onChange={(e) => setCalcUsd(Number(e.target.value))}
                  className="claude-calc-slider"
                  aria-label="Gasto mensal em Dólar"
                />
              </div>

              <div className="claude-calc-presets">
                {presetLevels.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`claude-calc-chip ${calcUsd === preset.value ? 'is-active' : ''}`}
                    onClick={() => setCalcUsd(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="claude-calc-exchange-info">
                <span>Câmbio base: R$ {commercialDollar.toFixed(2)}</span>
                <span>IOF: 4,38%</span>
                <span>Spread cartão: ~4,5%</span>
                <strong>Efetivo: R$ {effectiveDollarRate.toFixed(2)} / US$</strong>
              </div>
            </div>

            {/* Coluna 2: Resultado Comparado & Economia */}
            <div className="claude-calc-results">
              <div className="claude-calc-comparison-bars">
                {/* Linha Anthropic */}
                <div className="claude-calc-bar-item">
                  <div className="claude-calc-bar-meta">
                    <span className="claude-calc-bar-name">Direto na Anthropic (Cartão + IOF)</span>
                    <span className="claude-calc-bar-price price-anthropic">R$ {formatBRL(totalAnthropicBRL)} / mês</span>
                  </div>
                  <div className="claude-calc-track">
                    <div className="claude-calc-fill-anthropic" />
                  </div>
                </div>

                {/* Linha SixtySix */}
                <div className="claude-calc-bar-item">
                  <div className="claude-calc-bar-meta">
                    <span className="claude-calc-bar-name">Na SixtySix (Plano {sixtySixPlanName})</span>
                    <span className="claude-calc-bar-price price-sixtysix">R$ {sixtySixCost},00 / mês</span>
                  </div>
                  <div className="claude-calc-track">
                    <div
                      className="claude-calc-fill-sixtysix"
                      style={{ width: `${sixBarPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Caixa de Economia em Destaque */}
              <div className="claude-calc-savings-box">
                <div className="claude-calc-savings-top">
                  <span className="claude-calc-savings-label">Economia líquida no seu bolso</span>
                  <span className="claude-calc-savings-badge">-{savingsPercent}% no custo</span>
                </div>
                <div className="claude-calc-savings-val">
                  R$ {formatBRL(savingsBRL)} <span style={{ fontSize: '15px', fontWeight: 600 }}>/ mês</span>
                </div>
                <p className="claude-calc-savings-desc">
                  Você economiza <strong>R$ {formatBRL(savingsBRL * 12)} por ano</strong>. Isso é cerca de <strong>{savingsMultiplier}x mais barato</strong> do que continuar pagando na fatura em Dólar.
                </p>
              </div>

              <a href="#planos-claude" className="claude-calc-cta">
                Garantir Preço Fixo no Pix <Arrow />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Planos Destacados para Claude Code (Exatamente os 3 aprovados) */}
      <section className="plans-section shell" id="planos-claude">
        <div className="plans-header">
          <span className="eyebrow">acesso imediato</span>
          <h2 className="plans-title">
            Escolha seu plano para rodar <em>Claude Code.</em>
          </h2>
          <p className="plans-subtitle">
            Teste gratuitamente por 7 dias ou garanta o acesso ilimitado com preço fixo no Pix.
          </p>
        </div>

        <div className="plans-grid">
          {/* Teste Grátis */}
          <div className="plan-card plan-card-trial">
            <div className="plan-card-top">
              <span className="plan-tag plan-tag-green">7 dias grátis</span>
              <h3 className="plan-name">Teste Grátis</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">0</span>
                <span className="plan-period">/7 dias</span>
              </div>
              <p className="plan-desc">Acesso total e irrestrito para testar o Claude Code na prática antes de decidir.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Direito a tudo liberado</strong></span></li>
              <li><Check /> <span><strong>Claude Fable 5.1</strong>, <strong>GPT Astra 6</strong> e <strong>GLM-4</strong></span></li>
              <li><Check /> <span>Claude Code, Cursor & VS Code</span></li>
              <li><Check /> <span>Chave oficial própria (Zero Rateio)</span></li>
              <li><Check /> <span>Sem cartão de crédito necessário</span></li>
            </ul>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="plan-btn">
              Começar Teste Grátis <Arrow />
            </a>
          </div>

          {/* Dev */}
          <div className="plan-card">
            <div className="plan-card-top">
              <span className="plan-tag">Mais versátil</span>
              <h3 className="plan-name">Dev</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">79</span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Para desenvolvedores que criam e entregam software no dia a dia.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span>GPT Astra 6 & GLM-4 Plus</span></li>
              <li><Check /> <span>Claude Code, Cursor & VS Code</span></li>
              <li><Check /> <span>Chave própria para modelos oficiais</span></li>
              <li><Check /> <span>Conexão direta aos modelos oficiais</span></li>
              <li><Check /> <span>Cobrança fixa em Reais via Pix</span></li>
            </ul>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="plan-btn">
              Começar no Dev
            </a>
          </div>

          {/* Pro Ilimitado */}
          <div className="plan-card plan-card-featured">
            <div className="plan-card-top">
              <span className="plan-tag">Mais completo</span>
              <h3 className="plan-name">Pro Ilimitado</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">119</span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Acesso irrestrito aos modelos de ponta para quem constrói sem parar.</p>
            </div>
            <ul className="plan-features">
              <li><Check /> <span><strong>Claude Fable 5.1</strong>, <strong>GPT Astra 6</strong> e <strong>GLM-4 Plus</strong></span></li>
              <li><Check /> <span><strong>Uso 100% Ilimitado</strong> (sem travas diárias)</span></li>
              <li><Check /> <span><strong>Zero Rateio</strong> (chave oficial e segura)</span></li>
              <li><Check /> <span><strong>Modelos Oficiais</strong> (99.9% uptime)</span></li>
              <li><Check /> <span>Claude Code, Cursor, VS Code, Codex</span></li>
              <li><Check /> <span>Cobrança fixa em Reais sem IOF via Pix</span></li>
            </ul>
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="plan-btn plan-btn-featured">
              Garantir Acesso Ilimitado <Arrow />
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Claude Code */}
      <section className="faq shell" id="duvidas-claude">
        <div className="faq-intro">
          <h2 className="faq-title">
            <span className="faq-title-green">Dúvidas sobre</span><br />
            o Claude Code.
          </h2>
          <p className="faq-subtitle">
            Tudo o que você precisa saber para plugar o Claude Code no seu terminal hoje mesmo.
          </p>
          <div className="faq-action">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="faq-support-btn">
              Falar conosco no WhatsApp
            </a>
            <span className="faq-footnote">Sem mensalidade surpresa. Ativação imediata.</span>
          </div>
        </div>
        <div className="faq-list">
          <AccordionPrimitive.Root type="single" collapsible className="faq-accordion-root">
            {claudeFaqs.map(([question, answer], index) => (
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
        </div>
      </section>

      {/* Pre-Footer CTA com os Anjos */}
      <section className="pre-footer-cta-wrap">
        <img
          src="/assets/cherub-left.webp"
          alt="Anjo nas nuvens à esquerda"
          className="cherub-flank cherub-flank-left"
        />
        <img
          src="/assets/cherub-right.webp"
          alt="Anjo nas nuvens à direita"
          className="cherub-flank cherub-flank-right"
        />
        <div className="pre-footer-cta shell">
          <span className="eyebrow">comece agora</span>
          <h2 className="pre-footer-title">
            Pronto para codar com Claude Code <span className="pre-footer-green">sem limites?</span>
          </h2>
          <p className="pre-footer-sub">
            Crie sua conta em 1 minuto, receba sua chave oficial e teste no seu terminal hoje mesmo.
          </p>
          <div className="pre-footer-btn-wrap">
            <a href="#planos-claude" className="pre-footer-btn">
              Começar Teste de 7 Dias Grátis
            </a>
          </div>
          <p className="pre-footer-footnote">
            Sem cartão de crédito necessário. Ativação instantânea.
          </p>
        </div>
      </section>

      {/* Footer Padrão SixtySix */}
      <footer className="footer-wrap">
        <div className="shell footer-columns-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Modelos</h4>
            <ul className="footer-link-list">
              <li><Link to="/claude-code" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Claude Fable 5.1</Link></li>
              <li><a href="/#economia">GPT Astra 6</a></li>
              <li><a href="/#economia">GLM-4 Plus</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Produto</h4>
            <ul className="footer-link-list">
              <li><Link to="/claude-code">Claude Code CLI</Link></li>
              <li><a href="/#como-funciona">Integração no Terminal</a></li>
              <li><a href="/#economia">Calculadora de Tokens</a></li>
              <li><a href="/#recursos">Planos & Preços</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Suporte</h4>
            <ul className="footer-link-list">
              <li><a href="#duvidas-claude">Dúvidas Frequentes</a></li>
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
            <Link className="brand footer-brand" to="/" aria-label="Six, início">
              <img src="/assets/logo.webp" alt="Six" className="brand-logo-img brand-logo-footer" />
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
