import { Fragment, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  CreditCard,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  Sparkles,
  Sun,
  Terminal,
  TriangleAlert,
  Zap,
} from 'lucide-react'
import { BENEFICIOS, CODIGO, FERRAMENTAS, MODELOS, SITE, TERMINAL, TEXTOS, type Formato } from './config'

/** "Você paga *caro*" → palavras soltas; as de *destaque* ganham a classe `acc`. */
export function Words({ text, className = '' }: { text: string; className?: string }) {
  const out: ReactNode[] = []
  let acc = false
  text.split(/(\*)/).forEach((part) => {
    if (part === '*') return void (acc = !acc)
    part.split(/(\s+)/).forEach((w) => {
      if (!w) return
      if (/^\s+$/.test(w)) out.push(' ')
      else out.push(<span key={out.length} className={`wi${acc ? ' acc' : ''}`}>{w}</span>)
    })
  })
  return <span className={`words ${className}`}>{out}</span>
}

/** Código com um <span> por caractere: a "digitação" só liga cada um no seu tempo. */
function Code({ lines, id }: { lines: [string, string][][]; id: string }) {
  return (
    <pre className="code" data-code={id}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line.map(([cls, txt], j) =>
            [...txt].map((ch, k) => (
              <span key={`${j}-${k}`} className={`ch t-${cls}`}>
                {ch}
              </span>
            )),
          )}
          {i < lines.length - 1 && <span className="ch nl">{'\n'}</span>}
        </Fragment>
      ))}
      <span className="caret" />
    </pre>
  )
}

function StatusBar() {
  return (
    <div className="ph-status">
      <span>9:41</span>
      <div className="ph-island" />
      <div className="ph-icons">
        <svg width="17" height="11" viewBox="0 0 14 10" fill="currentColor"><path d="M1 8h2v2H1V8zm3-3h2v5H4V5zm3-3h2v8H7V2zm3-2h2v10h-2V0z" /></svg>
        <svg width="19" height="11" viewBox="0 0 16 9" fill="currentColor"><rect x="0.5" y="0.5" width="13" height="8" rx="2" fill="none" stroke="currentColor" /><rect x="2" y="2" width="9" height="5" rx="1" /><path d="M15 3.5v2" stroke="currentColor" /></svg>
      </div>
    </div>
  )
}

/** iPhone com um app genérico de IA para programar (o "antes": frio e cinza). */
function Phone() {
  return (
    <div className="phone">
      <div className="ph-side" />
      <div className="ph-btn ph-btn-a" />
      <div className="ph-btn ph-btn-b" />
      <div className="ph-btn ph-btn-c" />
      <div className="ph-frame">
        <div className="ph-screen">
          <StatusBar />
          <div className="ph-app-head">
            <ChevronLeft size={22} />
            <div>
              <strong>Agente de código</strong>
              <span>projeto · loja-online</span>
            </div>
            <span className="ph-model">Pro</span>
          </div>
          <div className="ph-chat">
            <div className="ph-user">Implementa o checkout com Pix e o webhook de confirmação.</div>
            <div className="ph-bot">
              <span className="ph-bot-ico"><Sparkles size={13} /></span>
              <span className="ph-bot-txt">Claro. Vou criar o checkout com Pix e o webhook.</span>
            </div>
            <div className="ph-file">
              <div className="ph-file-head">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <b>checkout.ts</b>
                <span className="ph-live"><i />gerando</span>
              </div>
              <Code lines={CODIGO} id="phone" />
            </div>
          </div>
          <div className="ph-limit">
            <TriangleAlert size={16} />
            <span>Usage limit reached.</span>
          </div>
          <div className="ph-input">
            <span className="ph-input-txt">Pergunte qualquer coisa…</span>
            <span className="ph-input-off">Limite atingido</span>
            <span className="ph-send"><ArrowUpRight size={16} /></span>
          </div>
          <div className="ph-home" />
        </div>
        <div className="ph-gloss" />
      </div>
    </div>
  )
}

function FloatCards() {
  return (
    <>
      <div className="fc fc-a">
        <div className="fc-row"><span className="fc-file">TS</span><b>checkout.ts</b></div>
        <div className="fc-diff"><span className="add">+42</span><span className="del">−3</span><div className="fc-bars"><i /><i /><i /><i /><i className="g" /></div></div>
      </div>
      <div className="fc fc-b">
        <span className="fc-spin"><i /><i /><i /></span>
        <div>
          <b className="fc-state on">Gerando código</b>
          <b className="fc-state off">Interrompido</b>
          <span>Agente 1 · checkout</span>
        </div>
      </div>
      <div className="fc fc-c">
        <span className="fc-label">Tokens nesta sessão</span>
        <b className="fc-num" data-count="tokens">0</b>
      </div>
      <div className="fc fc-d">
        <span className="fc-label">Tarefa</span>
        <b>Integrar pagamento Pix</b>
        <div className="fc-prog"><i /></div>
      </div>
    </>
  )
}

function LimitCard() {
  return (
    <div className="limit-card">
      <span className="lc-ico"><Gauge size={26} /></span>
      <b>You’ve reached your usage limit.</b>
      <span className="lc-sub">Your limit resets in 4h 59m.</span>
      <div className="lc-meter"><i /></div>
      <span className="lc-btn">Upgrade plan</span>
    </div>
  )
}

const NAV: [typeof LayoutDashboard, string][] = [
  [LayoutDashboard, 'Visão geral'],
  [Activity, 'Meu consumo'],
  [MessageSquare, 'Conversar no site'],
  [KeyRound, 'Chaves de API'],
  [Terminal, 'Como conectar'],
  [CreditCard, 'Plano e assinatura'],
]

const BARRAS = [34, 48, 41, 58, 52, 66, 61, 72, 64, 80, 74, 88, 79, 92]

/** O painel real da SixtySix (tema escuro), redesenhado em HTML para a câmera. */
function Dashboard() {
  return (
    <div className="dash">
      <aside className="d-side">
        <div className="d-brand"><img src="/assets/sidebar-logo-white.png" alt="" /><PanelLeftClose size={16} /></div>
        <span className="d-label">Plataforma</span>
        <nav className="d-nav">
          <span className="d-pill" />
          {NAV.map(([Icon, label]) => (
            <span key={label} className="d-item"><Icon size={17} /><em>{label}</em></span>
          ))}
        </nav>
        <div className="d-ready">
          <b>Pronto para criar?</b>
          <span>Sua próxima ideia começa com uma boa conexão.</span>
          <em>Conectar minha IDE <ArrowUpRight size={12} /></em>
        </div>
        <span className="d-item d-help"><CircleHelp size={17} /><em>Central de ajuda</em></span>
        <div className="d-user"><span>D</span><em><b>dev</b>Plano Pro</em><LogOut size={15} /></div>
      </aside>
      <main className="d-main">
        <div className="d-top">
          <span className="d-crumb">Workspace <ChevronRight size={12} /> <b className="crumb-a">Visão geral</b><b className="crumb-b">Como conectar</b></span>
          <span className="d-top-r"><span className="d-round"><Sun size={14} /></span><span className="d-doc"><BookOpen size={13} /> Documentação</span></span>
        </div>

        <section className="d-view d-overview">
          <span className="d-eyebrow">painel do cliente</span>
          <div className="d-hero">
            <h2>Olá, dev. <i>Bom te ver por aqui.</i></h2>
            <span className="d-cta"><Terminal size={14} /> Conectar ferramenta</span>
          </div>
          <p className="d-desc">Seu consumo, suas chaves e o passo a passo para conectar suas ferramentas, em um só lugar.</p>
          <div className="d-tabs"><span>Hoje</span><span>7 dias</span><span className="on">Últimos 30 dias</span><span>Personalizar</span></div>
          <div className="d-metrics">
            {[
              ['Tokens consumidos', '18,4', 'mi', 'tok'],
              ['Tokens de entrada', '15,1', 'mi', 'in'],
              ['Tokens de saída', '3,3', 'mi', 'out'],
              ['Solicitações concluídas', '2.418', '', 'req'],
            ].map(([label, value, unit, id]) => (
              <div key={id} className="d-metric">
                <span><Zap size={12} /> {label}</span>
                <b><em data-metric={id}>{value}</em> <small>{unit}</small></b>
              </div>
            ))}
          </div>
          <div className="d-chart">
            <div className="d-chart-head"><b>Consumo por dia</b><span>Todos os modelos</span></div>
            <div className="d-bars">
              {BARRAS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
            </div>
          </div>
        </section>

        <section className="d-view d-guides">
          <span className="d-eyebrow">Integração nativa</span>
          <h2 className="d-h-conn">Como <i>conectar.</i></h2>
          <div className="d-tools">
            {FERRAMENTAS.map(([title, desc, icon], i) => (
              <div key={title} className={`d-tool${i === 0 ? ' sel' : ''}`} data-tool={i}>
                <span className="d-tool-ico"><img src={`/assets/brands/${icon}.svg`} alt="" /></span>
                <b>{title}</b>
                <span>{desc}</span>
                {i === 0 && <CircleCheck size={15} className="d-check" />}
              </div>
            ))}
          </div>
          <div className="d-guide">
            <div className="d-guide-head">
              <span className="d-badge">Passo a passo</span>
              <b>Fable 5.2 no seu terminal</b>
            </div>
            <div className="d-segs">
              <div className="d-seg d-os"><span className="on">Windows · PowerShell</span><span>Windows · CMD</span><span>macOS / Linux</span></div>
              <div className="d-seg d-models">
                <span className="d-seg-pill" />
                {MODELOS.map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
            <div className="d-step"><span>01</span><b>Instale o Claude Code</b></div>
            <div className="d-term">
              <span className="d-term-h"><Terminal size={12} /> TERMINAL</span>
              <code>npm install -g @anthropic-ai/claude-code</code>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function TermWindow() {
  return (
    <div className="termwin">
      <div className="tw-head"><span className="dot" /><span className="dot" /><span className="dot" /><b>Windows PowerShell</b></div>
      <div className="tw-body">
        <Code lines={TERMINAL} id="term" />
        <div className="tw-out">
          <div className="tw-line l1"><span className="tw-ok">✓</span> Conectado em <b>sixtysix.online</b> · claude-fable-5-2</div>
          <div className="tw-line l2"><span className="tw-pr">&gt;</span> Continue o checkout com Pix de onde parou.</div>
          <div className="tw-line l3"><span className="tw-dim">  await</span> confirmarPagamento(pedido)</div>
          <div className="tw-line l4"><span className="tw-dim">  await</span> notificarCliente(pedido)</div>
          <div className="tw-line l5"><span className="tw-ok">✓</span> checkout.ts concluído · <span className="tw-dim">2 arquivos alterados</span></div>
        </div>
      </div>
    </div>
  )
}

const ICONES_BENEFICIO: Record<string, ReactNode> = {
  infinito: <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" /></svg>,
  chave: <KeyRound size={28} />,
  pix: <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" /><path d="M7.5 12h9M12 7.5v9" opacity=".0" /><path d="m8.5 9.5 3.5 3.5 3.5-3.5" /></svg>,
}

export default function Film({ formato }: { formato: Formato }) {
  return (
    <div className={`stage f${formato}`} id="stage">
      <div className="bg"><div className="bg-glow g1" /><div className="bg-glow g2" /><div className="bloom" /></div>
      <div className="camera">
        {/* Cenas 1 e 2 */}
        <div className="s1">
          <div className="headline">
            <h1 className="hl hl1"><Words text={TEXTOS.gancho1} /></h1>
            <h1 className="hl hl2"><Words text={TEXTOS.gancho2} /></h1>
          </div>
          <div className="space">
            <div className="phone-shadow" />
            <div className="phone-rig"><Phone /></div>
            <FloatCards />
            <LimitCard />
          </div>
        </div>

        {/* Cena 3 e o fim */}
        <div className="brand">
          <div className="logo"><img src="/assets/logo-white.png" alt="SixtySix" /><span className="logo-sheen" /></div>
          <h2 className="b-title"><Words text={TEXTOS.conheca} /></h2>
          <p className="b-tag"><Words text={TEXTOS.tagline} /></p>
          <h2 className="b-end"><Words text={TEXTOS.fim1} /></h2>
          <div className="b-cta"><span className="b-pill">{TEXTOS.cta} <ArrowRight size={22} /></span><span className="b-site">{SITE}</span></div>
        </div>

        {/* Cena 4 */}
        <div className="s4">
          <div className="captions">
            <h2 className="cap cap1"><Words text={TEXTOS.painel} /></h2>
            <h2 className="cap cap2"><Words text={TEXTOS.modelos} /></h2>
            <h2 className="cap cap3"><Words text={TEXTOS.conecte} /></h2>
          </div>
          <div className="dash-space">
            <div className="dash-rig">
              <div className="dash-shadow" />
              <Dashboard />
              <div className="lift-layer" />
              <TermWindow />
            </div>
          </div>
        </div>

        {/* Cena 5: diferenciais */}
        <div className="perks">
          {BENEFICIOS.map(([icon, title, sub]) => (
            <div key={title} className="perk">
              <span className="perk-ico">{ICONES_BENEFICIO[icon]}</span>
              <b>{title}</b>
              <span>{sub}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grain" />
      <div className="vignette" />
    </div>
  )
}
