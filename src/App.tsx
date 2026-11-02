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

export default function App() {
  const [copied, setCopied] = useState(false)
  const [navTab, setNavTab] = useState<'login' | 'signup'>('signup')
  const [heroAction, setHeroAction] = useState<'primary' | 'secondary'>('primary')
  const [handsAction, setHandsAction] = useState<'primary' | 'secondary'>('primary')
  const [integrationAction, setIntegrationAction] = useState<'primary' | 'secondary'>('primary')
  const [finalAction, setFinalAction] = useState<'primary' | 'secondary'>('primary')

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
            <img src="/assets/logo.png" alt="Six" className="brand-logo-img" />
          </a>
          <div className="nav-links">
            <a href="#recursos">Recursos</a>
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
        <img className="hand hand-right" src="/assets/sixtysix-hand-logo.png" alt="" />
        <div className="hands-content shell">
          <div className="hands-eyebrow-container">
            <div className="hands-eyebrow-box">
              <span className="hands-eyebrow">
                mais código. pagando <strong>6x</strong> mais barato.
              </span>
              <svg 
                className="hands-curve-arrow" 
                width="42" 
                height="42" 
                viewBox="0 0 42 42" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                style={{ overflow: 'visible' }}
              >
                <path 
                  d="M18 2 C 28 8, 30 20, 19 32" 
                  stroke="currentColor" 
                  strokeWidth="2.6" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M12 25 L 18.5 33 L 26 27" 
                  stroke="currentColor" 
                  strokeWidth="2.6" 
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
            <img src="/assets/logo.png" alt="Six" className="brand-logo-img brand-logo-footer" />
          </a>
          <p>IA para quem constrói o futuro.</p>
          <span>© 2026 Sixtysix</span>
        </div>
      </footer>
    </main>
  )
}
