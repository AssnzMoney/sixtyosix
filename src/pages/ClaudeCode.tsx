import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus, Minus, ChevronDown, Check, Terminal, Copy, CheckCheck, Sparkles, ShieldCheck, Zap, DollarSign } from 'lucide-react'

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const claudeFaqs = [
  [
    'É o Claude Code CLI oficial da Anthropic?',
    'Sim! O Claude Code é o agente de terminal oficial lançado pela Anthropic. Você instala o pacote oficial via npm (@anthropic-ai/claude-code) e apenas conecta a sua chave de API exclusiva da SixtySix. Funciona de forma 100% nativa.',
  ],
  [
    'Por que usar na SixtySix em vez de pagar direto na Anthropic?',
    'Na API oficial da Anthropic, o Claude Code consome tokens muito rapidamente, resultando em faturas de centenas de Dólares no cartão de crédito, cobrança de IOF cambial e travamentos frequentes por limite de cota diária. Na SixtySix você tem uso liberado com preço fixo em Reais no Pix.',
  ],
  [
    'Funciona em quais sistemas operacionais?',
    'Funciona nativamente em macOS (Apple Silicon e Intel), Linux (qualquer distribuição moderna) e Windows via WSL2 (Windows Subsystem for Linux) ou terminal Node.js.',
  ],
  [
    'Como funciona o Teste Grátis de 7 dias?',
    'Você cria sua conta em menos de 1 minuto, recebe sua chave individual exclusiva e já começa a rodar o Claude Code no seu terminal. Não pedimos cartão de crédito nem fidelidade.',
  ],
  [
    'Meus códigos e dados de repositório estão seguros?',
    'Absolutamente. Zero rateio. A sua chave é individual e a comunicação é criptografada de ponta a ponta. Nenhum dado de código ou prompt é retido ou utilizado para treinamento de inteligência artificial.',
  ],
]

export default function ClaudeCodePage() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false)
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [copiedTerminal, setCopiedTerminal] = useState(false)

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

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedTerminal(true)
    setTimeout(() => setCopiedTerminal(false), 2000)
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
            <a className="brand" href="/" aria-label="Six, início">
              <img src="/assets/logo.webp" alt="Six" className="brand-logo-img" />
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
              <a href="/#como-funciona">Como funciona</a>
              <a href="/#economia">Calculadora</a>
              <a href="#planos-claude">Preço</a>
              <a href="#duvidas-claude">Dúvidas</a>
            </div>
          </div>

          <div className="nav-right">
            <a href="/#planos" className="nav-login-link">
              Entrar
            </a>
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
                  <a href="/#planos" className="mega-menu-item" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Claude Fable 5.1</strong>
                    <span>Raciocínio profundo e código de alta complexidade.</span>
                  </a>
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
                  <a href="/claude-code" className="mega-menu-item mega-menu-item-active" onClick={() => setMegaMenuOpen(false)}>
                    <strong>Claude Code CLI</strong>
                    <span>Agentes autônomos no seu terminal sem travas de cotas.</span>
                  </a>
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

      {/* Hero Section */}
      <section className="claude-hero-section shell">
        <div className="claude-hero-top">
          <div className="claude-hero-pill-badge">
            <span className="claude-hero-pill-dot" />
            <span>AGENTE DE TERMINAL OFICIAL · ZERO COTAS DIÁRIAS</span>
          </div>

          <h1 className="claude-hero-title">
            O poder total do <em>Claude Code.</em><br />
            Sem sustos na fatura em Dólar.
          </h1>

          <p className="claude-hero-subtitle">
            Programe com o agente autônomo mais avançado do mundo direto no seu terminal.
            Conecte sua chave própria da SixtySix, esqueça limites diários e codifique com preço fixo no Pix.
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
                  layoutId="claude-hero-pill"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Começar Teste de 7 Dias <Arrow />
              </span>
            </a>

            <a
              href="#terminal-guide"
              className={`hero-action-pill ${heroAction === 'secondary' ? 'is-active' : ''}`}
              onMouseEnter={() => setHeroAction('secondary')}
              onClick={() => setHeroAction('secondary')}
            >
              {heroAction === 'secondary' && (
                <motion.div
                  layoutId="claude-hero-pill"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Ver Guia de Instalação <Terminal size={16} />
              </span>
            </a>
          </div>

          <div className="claude-trust-row">
            <span className="claude-trust-item"><ShieldCheck size={16} /> Chave Individual (Zero Rateio)</span>
            <span className="claude-trust-sep">·</span>
            <span className="claude-trust-item"><Zap size={16} /> Resposta Instantânea</span>
            <span className="claude-trust-sep">·</span>
            <span className="claude-trust-item"><DollarSign size={16} /> Cobrança Fixa em Reais</span>
          </div>
        </div>

        {/* Central Epic Visual Showcase */}
        <div className="claude-showcase-grid">
          {/* Card com a Obra de Arte "Claude Code ou Morte" */}
          <div className="claude-art-card">
            <div className="claude-art-glow" />
            <div className="claude-art-frame">
              <span className="claude-art-badge">
                <Sparkles size={13} /> O MANIFESTO DO DEV BRASILEIRO
              </span>
              <img
                src="/assets/claude-code-ou-morte.jpg"
                alt="Napoleão no cavalo pensando: Claude Code ou Morte"
                className="claude-art-img"
              />
              <div className="claude-art-caption">
                <strong>Claude Code ou morte.</strong>
                <span>A revolução dos agentes autônomos no seu terminal sem travas de cota.</span>
              </div>
            </div>
          </div>

          {/* Interactive Terminal Mockup */}
          <div className="claude-terminal-card" id="terminal-guide">
            <div className="claude-terminal-header">
              <div className="terminal-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <span className="terminal-title">bash — claude-code-cli · 80x24</span>
              <button
                type="button"
                className="terminal-copy-btn"
                onClick={() => copyCommand('npm install -g @anthropic-ai/claude-code && claude')}
                title="Copiar comando de instalação"
              >
                {copiedTerminal ? (
                  <>
                    <CheckCheck size={14} className="text-emerald" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="claude-terminal-body">
              <div className="t-line t-comment"># 1. Instale o CLI oficial da Anthropic</div>
              <div className="t-line t-prompt">
                <span className="t-user">dev@sixtysix</span>:<span className="t-path">~/projeto</span>$ npm install -g @anthropic-ai/claude-code
              </div>
              <div className="t-line t-muted">added 1 package in 2.1s</div>

              <div className="t-line t-comment t-mt"># 2. Conecte sua chave própria SixtySix</div>
              <div className="t-line t-prompt">
                <span className="t-user">dev@sixtysix</span>:<span className="t-path">~/projeto</span>$ export ANTHROPIC_BASE_URL="https://api.sixtysix.dev/v1"
              </div>
              <div className="t-line t-prompt">
                <span className="t-user">dev@sixtysix</span>:<span className="t-path">~/projeto</span>$ export ANTHROPIC_API_KEY="six_live_c18f..."
              </div>

              <div className="t-line t-comment t-mt"># 3. Inicie o agente e construa</div>
              <div className="t-line t-prompt">
                <span className="t-user">dev@sixtysix</span>:<span className="t-path">~/projeto</span>$ claude
              </div>

              <div className="t-banner">
                <div className="t-banner-title">╭─ Claude Code CLI v1.2.0 · SixtySix Connected ─╮</div>
                <div className="t-banner-row">│  Model: <strong>Claude Fable 5.1 (Anthropic)</strong></div>
                <div className="t-banner-row">│  Cluster: <strong>SixtySix FastPipe · 99.9% Uptime</strong></div>
                <div className="t-banner-row">│  Status: <span className="t-green">● 100% Ilimitado · Zero Rateio</span></div>
                <div className="t-banner-title">╰────────────────────────────────────────────────╯</div>
              </div>

              <div className="t-response">
                <span className="t-bot-tag">Claude</span>
                <span className="t-bot-text">
                  Varri os 48 arquivos do seu repositório. Encontrei 3 rotas de API para otimizar e terminei a suíte de testes unitários. Posso subir o commit?
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparativo de Dores */}
      <section className="claude-compare-section shell">
        <div className="claude-section-header">
          <span className="eyebrow">liberdade de codar</span>
          <h2 className="claude-section-title">
            Por que programadores trocam a API oficial pela <em>SixtySix?</em>
          </h2>
          <p className="claude-section-subtitle">
            O Claude Code é incrível, mas as limitações da conta oficial travam a produtividade de qualquer desenvolvedor sério.
          </p>
        </div>

        <div className="claude-compare-grid">
          <div className="claude-compare-card card-pain">
            <span className="compare-badge pain-badge">Direto na Anthropic</span>
            <h3 className="compare-title">Fatura imprevisível em Dólar</h3>
            <ul className="compare-list">
              <li>✕ Dólar alto com IOF de 4.38% e taxa de câmbio abusiva</li>
              <li>✕ Limites diários de tokens que travam no meio da tarde</li>
              <li>✕ Erros 429 ("Rate limit exceeded") no ápice do deploy</li>
              <li>✕ Faturas surpresa de R$ 800+ no fim do mês</li>
            </ul>
          </div>

          <div className="claude-compare-card card-gain">
            <span className="compare-badge gain-badge">Na SixtySix</span>
            <h3 className="compare-title">Uso liberado com Preço Fixo no Pix</h3>
            <ul className="compare-list">
              <li><Check /> Cobrança previsível em Reais, paga via Pix sem cartão</li>
              <li><Check /> Conexão aos modelos oficiais mais avançados (Claude Fable 5.1)</li>
              <li><Check /> Chave própria individual com zero rateio de conta</li>
              <li><Check /> Alta estabilidade com cluster dedicado de 99.9% uptime</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Planos Destacados para Claude Code */}
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
              <span className="plan-tag">Recomendado para Claude Code</span>
              <h3 className="plan-name">Pro Ilimitado</h3>
              <div className="plan-price">
                <span className="plan-curr">R$</span>
                <span className="plan-val">119</span>
                <span className="plan-period">/mês</span>
              </div>
              <p className="plan-desc">Acesso irrestrito aos modelos de ponta para rodar Claude Code sem parar.</p>
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
              Garantir Claude Code Ilimitado <Arrow />
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
          <AccordionPrimitive.Root type="single" collapsible defaultValue="item-0" className="faq-accordion-root">
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

      {/* Footer */}
      <footer className="footer-wrap">
        <div className="shell footer-top-grid">
          <div className="footer-brand-pane">
            <a href="/" className="footer-logo-link">
              <img src="/assets/logo.webp" alt="SixtySix" className="footer-logo-img" />
            </a>
            <p className="footer-brand-desc">
              O maior cluster de infraestrutura para desenvolvedores de IA do Brasil.
              Potência sem travas, zero rateio e cobrança fixa em Reais via Pix.
            </p>
          </div>

          <div className="footer-columns-grid">
            <div className="footer-col">
              <h4>Produtos</h4>
              <ul>
                <li><a href="/claude-code">Claude Code CLI</a></li>
                <li><a href="/#como-funciona">Cursor IDE</a></li>
                <li><a href="/#como-funciona">VS Code & Cline</a></li>
                <li><a href="/#como-funciona">Codex & Terminal</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Modelos</h4>
              <ul>
                <li><a href="/#planos">Claude Fable 5.1</a></li>
                <li><a href="/#planos">GPT Astra 6</a></li>
                <li><a href="/#planos">GLM-4 Plus</a></li>
                <li><a href="/#recursos">Conexão Direta</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Links Rápidos</h4>
              <ul>
                <li><a href="/#como-funciona">Como funciona</a></li>
                <li><a href="/#economia">Simulador de Economia</a></li>
                <li><a href="/#planos">Preços & Planos</a></li>
                <li><a href="/#duvidas">Perguntas Frequentes</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Atendimento</h4>
              <ul>
                <li><a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer">WhatsApp Oficial</a></li>
                <li><a href="mailto:suporte@sixtysix.dev">suporte@sixtysix.dev</a></li>
                <li><span className="footer-status-pill">● Todos os sistemas operacionais</span></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="shell footer-legal-wrap">
          <p className="footer-legal-copy">
            A SixtySix é uma plataforma independente de infraestrutura e conectividade de inteligência artificial.
            Marcas registradas como Claude, Anthropic, OpenAI, GPT, Cursor, VS Code e outras pertencem a seus respectivos titulares e são citadas unicamente para fins de identificação de compatibilidade técnica.
          </p>
        </div>

        <div className="shell footer-bottom-bar">
          <span className="footer-copyright">
            © 2026 SixtySix Tecnologia Ltda. Todos os direitos reservados. CNPJ 69.864.497/0001-92
          </span>
          <div className="footer-social-icons">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="X" className="footer-social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer-social-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
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
      </footer>
    </main>
  )
}
