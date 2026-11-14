import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Criativo from './Criativo'
import { montar, type Filme } from './timeline'
import './criativo.css'

const RENDER = new URLSearchParams(location.search).has('render')

declare global {
  interface Window {
    __film?: { pronto: boolean; duracao: number; ir: (t: number) => void; meta?: unknown }
  }
}

async function carregado(stage: HTMLElement) {
  await Promise.all(['800 40px Fustat', '700 40px Fustat', 'italic 400 40px "Instrument Serif"', '600 20px Manrope', '700 20px Manrope', '400 20px "DM Mono"'].map((f) => document.fonts.load(f)))
  await document.fonts.ready
  // Espera as imagens decodificadas (com erro ou não), sem travar se alguma demorar.
  const imagens = Promise.all([...stage.querySelectorAll('img')].map((img) => img.decode().catch(() => null)))
  await Promise.race([imagens, new Promise((r) => setTimeout(r, 8000))])
}

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

function App() {
  const [filme, setFilme] = useState<Filme | null>(null)
  const [tempo, setTempo] = useState(0)
  const [tocando, setTocando] = useState(!RENDER)
  const [escala, setEscala] = useState(0.4)
  const viewport = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    let vivo = true
    let atual: Filme | null = null
    const stage = document.getElementById('stage')!
    carregado(stage).then(() => {
      if (!vivo) return
      atual = montar(stage)
      const { tl } = atual
      tl.totalTime(0, false)
      tl.eventCallback('onUpdate', () => setTempo(tl.totalTime()))
      tl.eventCallback('onComplete', () => setTocando(false))
      setFilme(atual)
      const meta = { agenda: atual.agenda, sons: atual.sons, duracao: atual.duracao }
      ;(window as unknown as { __criativo: unknown }).__criativo = meta
      if (RENDER) window.__film = { pronto: true, duracao: atual.duracao, ir: (t) => void tl.totalTime(t, false), meta }
    })
    return () => {
      vivo = false
      atual?.limpar()
    }
  }, [])

  useEffect(() => {
    if (!filme || RENDER) return
    if (tocando) {
      if (filme.tl.progress() >= 1) filme.tl.totalTime(0, false)
      filme.tl.play()
    } else filme.tl.pause()
  }, [tocando, filme])

  useEffect(() => {
    if (RENDER) return
    const el = viewport.current!
    const ajustar = () => {
      const r = el.getBoundingClientRect()
      setEscala(Math.min((r.width - 40) / 1080, (r.height - 40) / 1920))
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (RENDER) return <Criativo />

  const ir = (t: number) => {
    if (!filme) return
    setTocando(false)
    filme.tl.pause()
    filme.tl.totalTime(t, false)
    setTempo(t)
  }
  const total = filme?.duracao ?? 0
  return (
    <div className="app">
      <div className="viewport" ref={viewport}>
        <div className="holder" style={{ width: 1080 * escala, height: 1920 * escala }}>
          <div style={{ transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
            <Criativo />
          </div>
        </div>
      </div>
      <div className="bar">
        <button type="button" className="on" onClick={() => setTocando((p) => !p)}>{tocando ? 'Pausar' : 'Reproduzir'}</button>
        <button type="button" onClick={() => { ir(0); setTocando(true) }}>Reiniciar</button>
        <input className="scrub" type="range" min={0} max={total} step={1 / 30} value={tempo} onChange={(e) => ir(Number(e.target.value))} />
        <span className="time">{fmt(tempo)} / {fmt(total)}</span>
        {filme?.agenda.map((a, i) => (
          <button key={a.id} type="button" onClick={() => ir(Math.max(0, a.em - 0.1))}>{i + 1}. {a.id}</button>
        ))}
      </div>
    </div>
  )
}

if (RENDER) document.documentElement.classList.add('render')
createRoot(document.getElementById('root')!).render(<App />)
