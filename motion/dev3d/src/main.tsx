import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { montarCena } from './cena3d'
import { AGENDA, DURACAO, FALAS } from './roteiro'
import './dev3d.css'

const params = new URLSearchParams(location.search)
const RENDER = params.has('render')
const [W, H] = params.get('formato') === '16x9' ? [1920, 1080] : [1080, 1920]

declare global {
  interface Window {
    __film?: { pronto: boolean; duracao: number; ir: (t: number) => void; meta?: unknown }
  }
}

// Sons sintetizados pelo mixar.mjs: um whoosh em cada troca de cena e um ding no deploy e no final.
const SONS = AGENDA.flatMap((a, i) => {
  const s: { t: number; tipo: string }[] = []
  if (i === 0 || AGENDA[i - 1].cena !== a.cena) s.push({ t: Math.max(0, a.em - 0.35), tipo: 'whoosh' })
  if (a.cena === 'deploy' && AGENDA[i - 1]?.cena !== 'deploy') s.push({ t: a.em + 1.2, tipo: 'ding' })
  s.push({ t: a.em + 0.05, tipo: 'pop' })
  return s
})

/** "Programa *com* você." → palavras entre * ganham destaque. */
function Legenda({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*[^*]+\*)/).map((p, i) =>
        p.startsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>,
      )}
    </>
  )
}

function App() {
  const host = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)
  const [escala, setEscala] = useState(0.4)
  const cenaRef = useRef<ReturnType<typeof montarCena> | null>(null)

  useEffect(() => {
    const cena = montarCena(host.current!, W, H)
    cenaRef.current = cena
    cena.ir(0)
    const meta = { agenda: AGENDA, sons: SONS, duracao: DURACAO }
    ;(window as unknown as { __criativo: unknown }).__criativo = meta
    document.fonts.ready.then(() => {
      if (RENDER) window.__film = { pronto: true, duracao: DURACAO, meta, ir: (s) => { cena.ir(s); setT(s) } }
    })
    let raf = 0
    if (!RENDER) {
      const inicio = performance.now()
      const loop = () => {
        const s = ((performance.now() - inicio) / 1000) % DURACAO
        cena.ir(s)
        setT(s)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      const ajustar = () => setEscala(Math.min(innerWidth / W, innerHeight / H) * 0.95)
      ajustar()
      addEventListener('resize', ajustar)
    }
    return () => { cancelAnimationFrame(raf); cena.limpar() }
  }, [])

  const atual = AGENDA.find((a) => t >= a.em - 0.2 && t < a.ate)
  const fala = atual && FALAS.find((f) => f.id === atual.id)
  const entra = atual ? Math.min(1, (t - atual.em + 0.2) / 0.35) : 0
  const sai = atual ? Math.min(1, (atual.ate - t) / 0.3) : 0
  const vis = Math.max(0, Math.min(entra, sai))

  return (
    <div className={RENDER ? 'raiz render' : 'raiz'}>
      <div className="stage" style={{ width: W, height: H, transform: RENDER ? undefined : `scale(${escala})` }}>
        <div ref={host} className="gl" />
        <div className={`legenda ${H > W ? 'vertical' : ''}`} style={{ opacity: vis, transform: `translateY(${(1 - vis) * 30}px)` }}>
          {fala && <Legenda texto={fala.tela} />}
        </div>
        {fala?.cena === 'final' && <div className="marca">Claude</div>}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)