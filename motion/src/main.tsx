import { StrictMode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Film from './Film'
import { CENAS, FORMATOS, type Formato } from './config'
import { montarFilme, type Filme, type Velocidades } from './timeline'
import './film.css'

const params = new URLSearchParams(location.search)
const RENDER = params.has('render')
const formatoInicial: Formato = params.get('formato') === '16x9' ? '16x9' : '9x16'

declare global {
  interface Window {
    __film?: { pronto: boolean; duracao: number; ir: (t: number) => void }
  }
}

/** Espera fontes e imagens: as posições do painel são medidas no DOM antes de montar a linha do tempo. */
async function carregado(stage: HTMLElement) {
  // As fontes só carregam quando usadas: pede todas antes de medir.
  await Promise.all(['700 40px Fustat', '800 40px Fustat', 'italic 400 40px "Instrument Serif"', '500 20px Manrope', '600 20px Manrope', '700 20px Manrope', '800 20px Manrope', '400 20px "DM Mono"', '500 20px "DM Mono"', '400 20px Inter', '600 20px Inter', '700 20px Inter'].map((f) => document.fonts.load(f)))
  await document.fonts.ready
  await Promise.all(
    [...stage.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })))),
  )
}

const velPadrao = () => Object.fromEntries(CENAS.map((c) => [c.id, c.velocidade])) as Velocidades
const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`

function App() {
  const [formato, setFormato] = useState<Formato>(formatoInicial)
  const [vel, setVel] = useState<Velocidades>(velPadrao)
  const [geral, setGeral] = useState(1)
  const [tocando, setTocando] = useState(!RENDER)
  const [tempo, setTempo] = useState(0)
  const [filme, setFilme] = useState<Filme | null>(null)
  const [escala, setEscala] = useState(0.4)
  const viewport = useRef<HTMLDivElement>(null)
  const posicao = useRef(0) // fração do filme, para manter o ponto ao remontar

  // Monta (e remonta) a linha do tempo quando muda o formato ou o tempo das cenas.
  useLayoutEffect(() => {
    let vivo = true
    let atual: Filme | null = null
    const stage = document.getElementById('stage')!
    carregado(stage).then(() => {
      if (!vivo) return
      atual = montarFilme(stage, formato, vel)
      const { tl } = atual
      tl.timeScale(geral)
      tl.totalTime(posicao.current * tl.totalDuration(), false)
      tl.eventCallback('onUpdate', () => {
        setTempo(tl.totalTime())
        posicao.current = tl.totalTime() / tl.totalDuration()
      })
      tl.eventCallback('onComplete', () => setTocando(false))
      setFilme(atual)
      if (RENDER) window.__film = { pronto: true, duracao: tl.totalDuration(), ir: (t) => void tl.totalTime(t, false) }
    })
    return () => {
      vivo = false
      atual?.limpar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formato, vel])

  useEffect(() => {
    if (!filme) return
    filme.tl.timeScale(geral)
  }, [geral, filme])

  useEffect(() => {
    if (!filme || RENDER) return
    if (tocando) {
      if (filme.tl.progress() >= 1) filme.tl.totalTime(0, false)
      filme.tl.play()
    } else filme.tl.pause()
  }, [tocando, filme])

  // O palco tem tamanho fixo (1080×1920 ou 1920×1080) e é reduzido para caber na janela.
  useEffect(() => {
    if (RENDER) return
    const el = viewport.current!
    const ajustar = () => {
      const { w, h } = FORMATOS[formato]
      const r = el.getBoundingClientRect()
      setEscala(Math.min((r.width - 40) / w, (r.height - 40) / h))
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [formato])

  const ir = useCallback(
    (t: number) => {
      if (!filme) return
      setTocando(false)
      filme.tl.pause()
      filme.tl.totalTime(t, false)
      setTempo(t)
    },
    [filme],
  )

  if (RENDER) return <Film formato={formato} />

  const { w, h } = FORMATOS[formato]
  const total = filme?.tl.totalDuration() ?? 0
  const cenaAtual = filme ? filme.inicios.filter((s) => s <= tempo + 0.001).length - 1 : 0

  return (
    <div className="app">
      <div className="viewport" ref={viewport}>
        <div className="holder" style={{ width: w * escala, height: h * escala }}>
          <div style={{ transform: `scale(${escala})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
            <Film formato={formato} />
          </div>
        </div>
      </div>
      <div className="bar">
        <div className="bar-row">
          <button type="button" className="on" onClick={() => setTocando((p) => !p)}>{tocando ? 'Pausar' : 'Reproduzir'}</button>
          <button type="button" onClick={() => { ir(0); setTocando(true) }}>Reiniciar</button>
          <input className="scrub" type="range" min={0} max={total} step={1 / 30} value={tempo} onChange={(e) => ir(Number(e.target.value))} />
          <span className="time">{fmt(tempo)} / {fmt(total)}</span>
          {(Object.keys(FORMATOS) as Formato[]).map((f) => (
            <button key={f} type="button" className={formato === f ? 'on' : ''} onClick={() => setFormato(f)}>{FORMATOS[f].nome}</button>
          ))}
        </div>
        <div className="bar-row">
          {CENAS.map((c, i) => (
            <button key={c.id} type="button" className={cenaAtual === i ? 'on' : ''} onClick={() => ir(filme?.inicios[i] ?? 0)}>
              {i + 1}. {c.nome}
            </button>
          ))}
        </div>
        <div className="timing">
          <span>Tempo das cenas (velocidade):</span>
          <label>Geral <input type="range" min={0.5} max={1.5} step={0.05} value={geral} onChange={(e) => setGeral(Number(e.target.value))} /> {geral.toFixed(2)}×</label>
          {CENAS.map((c, i) => (
            <label key={c.id}>
              {i + 1} <input type="range" min={0.5} max={2} step={0.05} value={vel[c.id]} onChange={(e) => setVel((p) => ({ ...p, [c.id]: Number(e.target.value) }))} /> {vel[c.id].toFixed(2)}×
            </label>
          ))}
          <button type="button" onClick={() => { setVel(velPadrao()); setGeral(1) }}>Padrão</button>
        </div>
      </div>
    </div>
  )
}

if (RENDER) document.documentElement.classList.add('render')
createRoot(document.getElementById('root')!).render(
  RENDER ? <App /> : <StrictMode><App /></StrictMode>,
)
