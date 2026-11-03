import { useState } from 'react'
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
  ['04', 'API, CLI & +15 Modelos', 'Acesse Claude 3.7 Sonnet, GPT-4o e GLM com a mesma chave e controle total de consumo.'],
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
    id: 'sonnet',
    name: 'Claude 3.7 Sonnet',
    tag: 'Anthropic',
    inPrice: 3.0,
    outPrice: 15.0,
  },
  {
    id: 'haiku',
    name: 'Claude 3.5 Haiku',
    tag: 'Anthropic',
    inPrice: 0.8,
    outPrice: 4.0,
  },
  {
    id: 'gpt4o',
    name: 'GPT-4o',
    tag: 'OpenAI',
    inPrice: 2.5,
    outPrice: 10.0,
  },
  {
    id: 'glm',
    name: 'GLM-4',
    tag: 'Z.ai',
    inPrice: 1.0,
    outPrice: 2.0,
  },
]

const volumeLevels = [
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: '1k', value: 1000 },
  { label: '2k', value: 2000 },
  { label: '4k', value: 4000 },
  { label: '8k', value: 8000 },
  { label: '16k', value: 16000 },
]

export default function App() {
  const [copied, setCopied] = useState(false)
  const [navTab, setNavTab] = useState<'login' | 'signup'>('signup')
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [handsAction, setHandsAction] = useState<'primary' | 'secondary'>('primary')
  const [integrationAction, setIntegrationAction] = useState<'primary' | 'secondary'>('primary')
  const [finalAction, setFinalAction] = useState<'primary' | 'secondary'>('primary')

  const [volIdx, setVolIdx] = useState(4)
  const [activeCalcModel, setActiveCalcModel] = useState('sonnet')

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
      <header className="nav-wrapper">
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
          Planos acessíveis para usar Claude Code todos os dias.
          Crie, teste e entregue mais — pagando menos.
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

      <section className="calc-section-wrapper" id="economia">
        <div className="shell">
          <div className="calc-header">
            <span className="calc-badge">SIMULADOR DE ECONOMIA</span>
            <h2>
              Quanto você gastaria<br />
              pagando direto por token
            </h2>
            <p>
              Escolha o volume e o modelo para comparar o preço de tabela dos provedores em Dólar com a assinatura da Six em Reais. As premissas do cálculo estão à mostra — sem conta mágica.
            </p>
          </div>

          <div className="calc-card">
            <div className="calc-grid">
              {/* Coluna da Esquerda: Controles */}
              <div className="calc-left">
                <div className="calc-vol-header">
                  <span className="calc-field-label">MENSAGENS POR MÊS</span>
                  <span className="calc-vol-counter">{currentVol.toLocaleString('pt-BR')}</span>
                </div>

                <div className="calc-pills-row">
                  {volumeLevels.map((lvl, index) => (
                    <button
                      key={lvl.label}
                      type="button"
                      className={`calc-pill-btn ${volIdx === index ? 'is-active' : ''}`}
                      onClick={() => setVolIdx(index)}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>

                <div className="calc-slider-wrap">
                  <input
                    type="range"
                    min="0"
                    max={volumeLevels.length - 1}
                    step="1"
                    value={volIdx}
                    onChange={(e) => setVolIdx(Number(e.target.value))}
                    className="calc-range-slider"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 ${(volIdx / (volumeLevels.length - 1)) * 100}%, rgba(255, 255, 255, 0.12) ${(volIdx / (volumeLevels.length - 1)) * 100}%)`,
                    }}
                    aria-label="Volume de mensagens por mês"
                  />
                </div>

                <div className="calc-model-section">
                  <span className="calc-field-label">MODELO DE REFERÊNCIA</span>
                  <div className="calc-model-grid">
                    {calcModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`calc-model-card ${activeCalcModel === m.id ? 'is-active' : ''}`}
                        onClick={() => setActiveCalcModel(m.id)}
                      >
                        <div className="calc-model-icon">
                          <span>AI</span>
                        </div>
                        <div className="calc-model-info">
                          <strong>{m.name}</strong>
                          <small>${m.inPrice.toFixed(2)} / ${m.outPrice.toFixed(2)}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="calc-premises-note">
                  Considerando 2.000 tokens de entrada e 800 de saída por mensagem, ao preço de tabela de ${currentModel.inPrice.toFixed(2)}/${currentModel.outPrice.toFixed(2)} por 1M de tokens (dólar a R$ 5,85 + IOF de 5,38%).
                </p>
              </div>

              {/* Coluna da Direita: Comparativo e Economia */}
              <div className="calc-right">
                <div className="calc-bar-block">
                  <div className="calc-bar-header">
                    <span className="calc-field-label">PAGANDO POR TOKEN (OFICIAL)</span>
                    <span className="calc-price-token">R$ {formatBRL(officialTokenCostBrl)}</span>
                  </div>
                  <div className="calc-bar-track">
                    <div className="calc-bar-fill calc-fill-token" style={{ width: '100%' }} />
                  </div>
                  <span className="calc-bar-sub">≈ ${rawUsd.toFixed(2)} por mês</span>
                </div>

                <div className="calc-bar-block">
                  <div className="calc-bar-header">
                    <span className="calc-field-label">NA SIX</span>
                    <span className="calc-price-six">R$ {formatBRL(sixPlanCost)}</span>
                  </div>
                  <div className="calc-bar-track">
                    <div
                      className="calc-bar-fill calc-fill-six"
                      style={{ width: `${sixBarPercentage}%` }}
                    />
                  </div>
                  <span className="calc-bar-sub">{sixPlanSubtitle}</span>
                </div>

                <div className="calc-savings-box">
                  <span className="calc-savings-tag">VOCÊ ECONOMIZA</span>
                  <div className="calc-savings-number">R$ {formatBRL(calculatedSavings)}</div>
                  <span className="calc-savings-mult">{savingsMultiplier}× mais barato · por mês</span>
                  <a href="#teste" className="calc-cta-button">
                    Começar agora <Arrow />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="faq shell" id="duvidas">
        <div>
          <span className="eyebrow">direto ao ponto</span>
          <h2>Dúvidas antes<br />de começar?</h2>
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

      <section className="final-cta" id="teste">
        <div className="final-cta-glow" />
        <div className="shell">
          <span className="eyebrow">comece agora</span>
          <h2>Claude Code para construir mais.<br />Um plano para pagar menos.</h2>
          <div 
            className="final-cta-actions"
            onMouseLeave={() => setFinalAction('primary')}
          >
            <a
              href="#teste"
              className={`final-cta-pill ${finalAction === 'primary' ? 'is-active' : ''}`}
              onMouseEnter={() => setFinalAction('primary')}
              onClick={() => setFinalAction('primary')}
            >
              {finalAction === 'primary' && (
                <motion.div
                  layoutId="final-pill-indicator"
                  className="final-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="final-pill-content">
                Teste agora <Arrow />
              </span>
            </a>

            <a
              href="#duvidas"
              className={`final-cta-pill ${finalAction === 'secondary' ? 'is-active' : ''}`}
              onMouseEnter={() => setFinalAction('secondary')}
              onClick={() => setFinalAction('secondary')}
            >
              {finalAction === 'secondary' && (
                <motion.div
                  layoutId="final-pill-indicator"
                  className="final-active-pill-bg"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className="final-pill-content">
                Tirar dúvidas <Arrow />
              </span>
            </a>
          </div>
          <p>Ativação imediata · Cancele quando quiser</p>
        </div>
      </section>

      <footer className="footer-wrap">
        <div className="shell footer-inner">
          <a className="brand footer-brand" href="#top" aria-label="Six, início">
            <img src="/assets/logo.webp" alt="Six" className="brand-logo-img brand-logo-footer" />
          </a>
          <p>IA para quem constrói o futuro.</p>
          <span>© 2026 Sixtysix</span>
        </div>
      </footer>
    </main>
  )
}
