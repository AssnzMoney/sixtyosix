import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Marquee } from '@/components/ui/marquee'

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
  ['01', 'Preço Fixo em Reais', 'Sem surpresas de cotação de dólar ou IOF no cartão. Previsibilidade total para você codar sem pesar no bolso.'],
  ['02', 'Pronto pro Terminal', 'Sem burocracia nem enrolação. Uma chave na sua máquina e você já está codando direto no Claude Code.'],
  ['03', 'Poucos Minutos pra Ativar', 'Criou a conta, escolheu o plano e ativou. Suporte direto e rápido de dev para dev.'],
  ['04', 'API, CLI & +15 Modelos', 'Acesse Claude Opus 5.5, GPT Astra 6 e GLM-4 Plus com a mesma chave e controle total de consumo.'],
]

const faqs = [
  ['Como começo a usar?', 'Crie sua conta, escolha o plano e receba acesso imediatamente ao painel e às instruções de integração.'],
  ['Funciona com o Claude Code?', 'Sim. Os planos da Sixtysix são feitos para você usar o Claude Code diretamente no seu fluxo de desenvolvimento.'],
  ['Posso cancelar quando quiser?', 'Sim. Você controla sua assinatura diretamente pelo painel, sem burocracia.'],
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

const calcModels = [
  {
    id: 'opus',
    name: 'Claude Opus 5.5',
    shortName: 'Claude Opus 5.5',
    tag: 'Anthropic',
    inPrice: 5.0,
    outPrice: 25.0,
  },
  {
    id: 'astra',
    name: 'GPT Astra 6',
    shortName: 'GPT Astra 6',
    tag: 'OpenAI',
    inPrice: 2.5,
    outPrice: 12.0,
  },
  {
    id: 'glm',
    name: 'GLM-4 Plus',
    shortName: 'GLM-4 Plus',
    tag: 'Z.ai',
    inPrice: 1.5,
    outPrice: 3.0,
  },
]

const volumeLevels = [
  { label: '500 prompts', value: 500 },
  { label: '1.000 prompts', value: 1000 },
  { label: '2.000 prompts', value: 2000 },
  { label: '4.000 prompts', value: 4000 },
  { label: '8.000 prompts', value: 8000 },
  { label: '16.000 prompts', value: 16000 },
]

export default function App() {
  const [copied, setCopied] = useState(false)
  const [navTab, setNavTab] = useState<'login' | 'signup'>('signup')
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [handsAction, setHandsAction] = useState<'primary' | 'secondary'>('primary')
  const [integrationAction, setIntegrationAction] = useState<'primary' | 'secondary'>('primary')
  const [calcAction, setCalcAction] = useState<'primary' | 'secondary'>('primary')

  const [volIdx, setVolIdx] = useState(3)
  const [activeCalcModel, setActiveCalcModel] = useState('opus')
  const [volDropdownOpen, setVolDropdownOpen] = useState(false)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.phrase-dropdown-wrap')) {
        setModelDropdownOpen(false)
        setVolDropdownOpen(false)
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

  const currentVol = volumeLevels[volIdx].value
  const currentModel = calcModels.find((m) => m.id === activeCalcModel) || calcModels[0]
  const totalInputTokens = currentVol * 2000
  const totalOutputTokens = currentVol * 800
  const rawUsd = (totalInputTokens / 1_000_000) * currentModel.inPrice + (totalOutputTokens / 1_000_000) * currentModel.outPrice
  const officialTokenCostBrl = rawUsd * 6.16

  let sixPlanCost = 119
  let sixPlanSubtitle = 'Plano Pro — uso ilimitado'
  if (currentVol === 250) {
    sixPlanCost = 19
    sixPlanSubtitle = 'Plano Lite'
  } else if (currentVol === 500) {
    sixPlanCost = 39
    sixPlanSubtitle = 'Plano Starter'
  } else if (currentVol === 1000) {
    sixPlanCost = 79
    sixPlanSubtitle = 'Plano Dev'
  } else {
    sixPlanCost = 119
    sixPlanSubtitle = 'Plano Pro — uso ilimitado'
  }

  const calculatedSavings = Math.max(0, officialTokenCostBrl - sixPlanCost)
  const savingsMultiplier = officialTokenCostBrl > sixPlanCost 
    ? (officialTokenCostBrl / sixPlanCost).toFixed(1) 
    : '1.0'

  const sixBarPercentage = Math.min(100, Math.max(12, Math.round((sixPlanCost / officialTokenCostBrl) * 100)))

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const handleCopy = () => {
    navigator.clipboard.writeText('sixtysix.dev/quickstart')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <main>
      <header className={`nav-wrapper ${isScrolled ? 'nav-scrolled' : ''}`}>
        <nav className="nav">
          <a className="brand" href="#top" aria-label="Six, início">
            <img src="/assets/logo.webp" alt="Six" className="brand-logo-img" />
          </a>
          <div className="nav-links">
            <a href="#recursos">Recursos</a>
            <a href="#economia">Por que a Six</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#duvidas">Dúvidas</a>
          </div>
          <div 
            className="nav-pill-group"
            onMouseLeave={() => setNavTab('signup')}
          >
            <a
              href="#teste"
              className={`nav-pill-item ${navTab === 'login' ? 'active' : ''}`}
              onMouseEnter={() => setNavTab('login')}
              onClick={() => setNavTab('login')}
            >
              {navTab === 'login' && (
                <motion.div
                  layoutId="nav-pill-indicator"
                  className="nav-active-pill"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10">Entrar</span>
            </a>
            <a
              href="#teste"
              className={`nav-pill-item ${navTab === 'signup' ? 'active' : ''}`}
              onMouseEnter={() => setNavTab('signup')}
              onClick={() => setNavTab('signup')}
            >
              {navTab === 'signup' && (
                <motion.div
                  layoutId="nav-pill-indicator"
                  className="nav-active-pill"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                Criar conta grátis <Arrow />
              </span>
            </a>
          </div>
        </nav>
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
            href="#como-funciona"
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
              Ver como funciona <Arrow />
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
        <img className="hand hand-left" src="/assets/sixtysix-hand-reach.webp" alt="" />
        <img className="hand hand-right" src="/assets/sixtysix-hand-logo.webp" alt="" />
        <div className="hands-content shell">
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
          <div className="feature-grid">
            {features.map(([number, title, copy]) => (
              <article className="feature-card" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
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
          <div className="phone-card-wrapper">
            <div className="phone-glow" />
            <div className="phone-device">
              <div className="phone-notch-bar">
                <span>9:41</span>
                <div className="phone-notch" />
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <svg width="13" height="9" viewBox="0 0 14 10" fill="currentColor"><path d="M1 8h2v2H1V8zm3-3h2v5H4V5zm3-3h2v8H7V2zm3-2h2v10h-2V0z"/></svg>
                  <svg width="15" height="9" viewBox="0 0 16 9" fill="currentColor"><rect x="0.5" y="0.5" width="13" height="8" rx="2" fill="none" stroke="currentColor"/><rect x="2" y="2" width="9" height="5" rx="1"/><path d="M15 3.5v2" stroke="currentColor"/></svg>
                </div>
              </div>
              <div className="phone-nav-header">
                <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                <span>sixtysix.dev/cli</span>
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
              </div>
              <div className="phone-chat-body">
                <div className="chat-msg-user">
                  sixtysix.dev/quickstart
                </div>
                <div className="chat-msg-bot">
                  <div className="chat-bot-icon">
                    <img src="/assets/brands/claude.svg" alt="Claude" />
                  </div>
                  <p>
                    Ok, vamos fazer a integração à Sixtysix. Já vi toda a documentação!
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
          </div>

          <div className="integration-copy">
            <h2 className="integration-title">
              <span className="text-emerald">Integre do jeito que</span>
              <br />
              <span className="text-dark">você constrói.</span>
            </h2>
            <p>
              Code, vibe-code ou no-code dá no mesmo. Se você programa, tem
              SDK em Python, JavaScript, TypeScript e suporte nativo ao Claude
              Code e Cursor. Se travar, o suporte responde antes do teu café
              esfriar. Se você constrói com IA, copia o comando abaixo, cola no
              terminal e deixa ela programar por você.
            </p>
            <div className="snippet-box">
              <code>sixtysix.dev/quickstart</code>
              <button 
                type="button" 
                className="btn-copy" 
                onClick={handleCopy}
              >
                {copied ? <Check /> : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <div 
              className="hero-actions"
              onMouseLeave={() => setIntegrationAction('primary')}
            >
              <a
                href="#teste"
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
                  Integrar com AI <Arrow />
                </span>
              </a>

              <a
                href="#duvidas"
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
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="calc-phrase-section shell" id="economia">
        <div className="calc-phrase-wrap">
          <div className="calc-header">
            <h2 className="calc-title">
              Quanto você gastaria<br className="calc-title-br" /> pagando <em>direto por token?</em>
            </h2>
          </div>

          <div className="calc-phrase-heading">
            <span className="calc-phrase-line">
              Eu quero fazer{' '}
              <span className="phrase-dropdown-wrap">
                <button
                  type="button"
                  className="phrase-pill phrase-pill-amber"
                  onClick={(e) => {
                    e.stopPropagation()
                    setVolDropdownOpen(!volDropdownOpen)
                    setModelDropdownOpen(false)
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={volDropdownOpen}
                >
                  <span>{currentVol.toLocaleString('pt-BR')} prompts</span>
                  <svg className={`phrase-caret ${volDropdownOpen ? 'is-open' : ''}`} width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {volDropdownOpen && (
                  <div className="phrase-menu phrase-menu-amber">
                    {volumeLevels.map((lvl, index) => (
                      <button
                        key={lvl.label}
                        type="button"
                        className={`phrase-menu-item ${volIdx === index ? 'is-selected' : ''}`}
                        onClick={() => {
                          setVolIdx(index)
                          setVolDropdownOpen(false)
                        }}
                      >
                        <span>{lvl.value.toLocaleString('pt-BR')} prompts</span>
                        {volIdx === index && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </span>{' '}
              usando{' '}
              <span className="phrase-dropdown-wrap">
                <button
                  type="button"
                  className="phrase-pill phrase-pill-blue"
                  onClick={(e) => {
                    e.stopPropagation()
                    setModelDropdownOpen(!modelDropdownOpen)
                    setVolDropdownOpen(false)
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={modelDropdownOpen}
                >
                  <span>{currentModel.shortName}</span>
                  <svg className={`phrase-caret ${modelDropdownOpen ? 'is-open' : ''}`} width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {modelDropdownOpen && (
                  <div className="phrase-menu phrase-menu-blue">
                    {calcModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`phrase-menu-item ${activeCalcModel === m.id ? 'is-selected' : ''}`}
                        onClick={() => {
                          setActiveCalcModel(m.id)
                          setModelDropdownOpen(false)
                        }}
                      >
                        <div className="phrase-menu-model-info">
                          <strong>{m.name}</strong>
                          <small>${m.inPrice.toFixed(2)} / ${m.outPrice.toFixed(2)} por 1M</small>
                        </div>
                        {activeCalcModel === m.id && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            </span>
            <span className="calc-phrase-line">
              na Six, então vou pagar de taxa{' '}
              <span className="phrase-price-val">R$ {formatBRL(sixPlanCost)}.</span>
            </span>
          </div>

          <p className="calc-phrase-sub">
            Você economiza <strong className="phrase-green-num">R$ {formatBRL(calculatedSavings)}</strong>, cerca de{' '}
            {savingsMultiplier}x mais barato do que na API oficial.
          </p>

          <div 
            className="calc-phrase-action-wrap"
            onMouseLeave={() => setCalcAction('primary')}
          >
            <a
              href="#teste"
              className={`hero-action-pill ${calcAction === 'primary' ? 'is-active' : ''}`}
              onMouseEnter={() => setCalcAction('primary')}
              onClick={() => setCalcAction('primary')}
            >
              {calcAction === 'primary' && (
                <motion.div
                  layoutId="calc-pill-indicator"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Começar a codar agora <Arrow />
              </span>
            </a>

            <a
              href="#teste-gratis"
              className={`hero-action-pill ${calcAction === 'secondary' ? 'is-active' : ''}`}
              onMouseEnter={() => setCalcAction('secondary')}
              onClick={() => setCalcAction('secondary')}
            >
              {calcAction === 'secondary' && (
                <motion.div
                  layoutId="calc-pill-indicator"
                  className="hero-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="hero-pill-content">
                Testar 7 dias grátis <Arrow />
              </span>
            </a>
          </div>

          <p className="calc-phrase-footnote">
            Sem mensalidade surpresa. Cobrança em Reais via Pix.
          </p>
        </div>

        <img 
          src="/assets/calc-warrior.jpg" 
          alt="Guerreiro suplicando" 
          className="calc-warrior-img" 
          aria-hidden="true"
        />
      </section>

      <section className="faq shell" id="duvidas">
        <div>
          <span className="eyebrow">direto ao ponto</span>
          <h2>Dúvidas antes<br />de começar?</h2>
          <div className="faq-action">
            <a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="faq-support-btn">
              Fale com o suporte <Arrow />
            </a>
          </div>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}<span>+</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="pre-footer-cta shell">
        <h2 className="pre-footer-title">
          Você leu até aqui. <span className="pre-footer-green">Tá interessado né?</span>
        </h2>
        <p className="pre-footer-sub">
          Cadastro leva 2 minutos, a aprovação não leva semanas, e você começa a codar hoje ainda.
        </p>
        <div className="pre-footer-btn-wrap">
          <a href="#economia" className="pre-footer-btn">
            Vai, clica logo nesse botão
          </a>
        </div>
        <p className="pre-footer-footnote">
          Sem mensalidade. Aprovação não leva semanas.
        </p>
      </section>

      <footer className="footer-wrap">
        <div className="shell footer-columns-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Modelos</h4>
            <ul className="footer-link-list">
              <li><a href="#economia">Claude Opus 5.5</a></li>
              <li><a href="#economia">GPT Astra 6</a></li>
              <li><a href="#economia">GLM-4 Plus</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Produto</h4>
            <ul className="footer-link-list">
              <li><a href="#como-funciona">Claude Code CLI</a></li>
              <li><a href="#como-funciona">Integração no Terminal</a></li>
              <li><a href="#economia">Calculadora de Tokens</a></li>
              <li><a href="#recursos">Planos & Preços</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Suporte</h4>
            <ul className="footer-link-list">
              <li><a href="#duvidas">Dúvidas Frequentes</a></li>
              <li><a href="mailto:suporte@sixtysix.dev">Falar com Suporte</a></li>
              <li><a href="mailto:suporte@sixtysix.dev">suporte@sixtysix.dev</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Legal</h4>
            <ul className="footer-link-list">
              <li><a href="#duvidas">Termos de Uso</a></li>
              <li><a href="#duvidas">Política de Privacidade</a></li>
              <li><a href="#duvidas">Segurança</a></li>
            </ul>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div className="shell footer-bottom-bar">
          <div className="footer-brand-meta">
            <a className="brand footer-brand" href="#top" aria-label="Six, início">
              <img src="/assets/logo.webp" alt="Six" className="brand-logo-img brand-logo-footer" />
            </a>
            <span className="footer-copyright">
              © 2026 Sixtysix. Todos os direitos reservados.
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
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
              </svg>
            </a>
            <a href="https://discord.com" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="footer-social-icon">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
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
