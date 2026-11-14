import { type ReactNode } from 'react'
import { Check, MessageCircle, Search, ShieldCheck } from 'lucide-react'
import { FATURA, LETRA_MIUDA, PRECO, SITE } from './roteiro'

const A = '/assets'

/** "Tá pagando *caro*" → uma <span class="wi"> por palavra; as de *destaque* ganham `acc`. */
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

const Toggle = () => (
  <span className="toggle"><span className="knob" /></span>
)

export default function Criativo() {
  return (
    <div className="stage" id="stage">
      <div className="bg" />
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="dark" />
      <div className="camera">
        {/* 1. Gancho: a fatura em dólar */}
        <section className="cena c-gancho">
          <h1 className="titulo"><Words text="Tá pagando *caro* pra usar IA?" /></h1>
          <div className="fatura card3d">
            <div className="fat-top"><span className="fat-chip" /> Fatura do cartão</div>
            <div className="fat-linha"><span>Assinatura de IA</span><b>US$ {FATURA.usd},00</b></div>
            <div className="fat-linha"><span>Câmbio + IOF + spread</span><b className="sobe">+ 27%</b></div>
            <div className="fat-sep" />
            <div className="fat-total"><span>Total</span><b className="fat-valor">R$ 0</b></div>
          </div>
        </section>

        {/* 2. A dor: os custos caindo e empilhando */}
        <section className="cena c-dor">
          <div className="pilha">
            <div className="chip ch1">💵 Dólar</div>
            <div className="chip ch2">🧾 IOF</div>
            <div className="chip ch3">💳 Cartão internacional</div>
          </div>
        </section>

        {/* 3. A virada (cena escura) */}
        <section className="cena c-virada">
          <h1 className="titulo claro"><Words text="E se fosse em *reais?*" /></h1>
          <div className="brilho" />
        </section>

        {/* 4. O produto: celulares em perspectiva */}
        <section className="cena c-produto">
          <h1 className="titulo"><Words text="Com a *SixtySix* você usa" /></h1>
          <div className="trilho">
            <div className="fone f1">
              <div className="fone-tela">
                <div className="fone-head"><img src={`${A}/brands/claude.svg`} alt="" /> Claude Code</div>
                <div className="term"><i>$</i> claude<br /><span className="ok">✻</span> Pronto pra codar<br /><span className="dim">› crie a tela de login</span></div>
              </div>
              <div className="fone-nome">Claude Code</div>
            </div>
            <div className="fone f2">
              <div className="fone-tela">
                <div className="fone-head"><img className="inv" src={`${A}/brands/openai.svg`} alt="" /> Codex</div>
                <div className="term"><i>$</i> codex<br /><span className="ok">●</span> Lendo o projeto…<br /><span className="dim">› corrija os testes</span></div>
              </div>
              <div className="fone-nome">Codex</div>
            </div>
            <div className="fone f3">
              <div className="fone-tela">
                <div className="fone-head"><span className="key">⌘</span> API de IA</div>
                <div className="term">Sua chave<br /><span className="ok">sk-six-••••••••</span><br /><span className="dim">pronta pra usar</span></div>
              </div>
              <div className="fone-nome">API de IA</div>
            </div>
          </div>
        </section>

        {/* 5. Pix: comprovante + dinheiro 3D */}
        <section className="cena c-pix">
          <h1 className="titulo"><Words text="pagando no *Pix*" /></h1>
          <img className="pedestal" src={`${A}/pedestal-money-3d.png`} alt="" />
          <div className="recibo card3d">
            <div className="rec-ok"><Check size={64} strokeWidth={3.2} /></div>
            <div className="rec-tit">Pix enviado</div>
            <div className="rec-valor">{PRECO}</div>
            <div className="rec-linha"><span>Para</span><b>SixtySix</b></div>
            <div className="rec-linha"><span>Quando</span><b>Hoje, agora</b></div>
          </div>
        </section>

        {/* 6. Sem: interruptores ligando */}
        <section className="cena c-sem">
          {['Sem cartão gringo', 'Sem IOF', 'Sem susto'].map((t, i) => (
            <div key={t} className={`linha-sem s${i + 1}`}>
              <Toggle />
              <span className="sem-txt">{t}</span>
            </div>
          ))}
        </section>

        {/* 7. E o melhor (palavra empilhada) */}
        <section className="cena c-melhor">
          <div className="eco">
            <div className="eco-l e3">melhor</div>
            <div className="eco-l e2">melhor</div>
            <div className="eco-l e1"><Words text="E o *melhor*" /></div>
          </div>
        </section>

        {/* 8. Teste grátis: conversa */}
        <section className="cena c-teste">
          <div className="chat">
            <div className="chat-head"><b>Mensagens</b><span>Hoje 9:45</span></div>
            <div className="bolha esq m1">tá usando qual IA agora?</div>
            <div className="bolha dir m2">SixtySix, no Pix 😎</div>
            <div className="bolha esq m3">quanto pagou??</div>
            <div className="bolha dir m4">nada, 7 dias grátis</div>
            <div className="reacao">😳</div>
          </div>
          <img className="calendario" src={`${A}/plan-trial.png`} alt="" />
          <h1 className="titulo baixo"><Words text="7 dias *grátis*" /></h1>
        </section>

        {/* 9. Pilares: passam de lado */}
        <section className="cena c-pilares">
          <div className="pilar p1"><img src={`${A}/plan-cash.png`} alt="" /><span>Preço justo</span></div>
          <div className="pilar p2"><span className="ico verde"><ShieldCheck size={150} strokeWidth={2} /></span><span>Qualidade</span></div>
          <div className="pilar p3"><span className="ico zap"><MessageCircle size={140} strokeWidth={2.2} /></span><span>Suporte no WhatsApp</span></div>
        </section>

        {/* 10. Chamada final */}
        <section className="cena c-cta">
          <div className="botao">Saiba mais</div>
          <div className="toque" />
          <h1 className="titulo espera"><Words text="Tô te esperando lá 👀" /></h1>
          <img className="logo" src={`${A}/sixtysix-crowned-logo.png`} alt="SixtySix" />
          <div className="busca"><Search size={44} strokeWidth={2.6} /><span className="url">{[...SITE].map((c, i) => <span key={i} className="lt">{c}</span>)}</span><span className="cursor" /></div>
        </section>
      </div>
      <div className="miuda">{LETRA_MIUDA}</div>
      <div className="flash" />
    </div>
  )
}
