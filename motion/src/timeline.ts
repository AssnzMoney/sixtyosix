import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import { CENAS, CORTE_ULTIMA_LINHA, type CenaId, type Formato } from './config'

gsap.registerPlugin(CustomEase)
CustomEase.create('sxOut', '0.16,1,0.3,1') // chegada longa e macia
CustomEase.create('sxInOut', '0.65,0,0.35,1') // movimento de câmera
CustomEase.create('sxIn', '0.6,0,0.85,0.25') // saída que acelera
CustomEase.create('sxSoft', '0.33,0,0.15,1') // deriva lenta

export type Velocidades = Record<CenaId, number>
export type Filme = { tl: gsap.core.Timeline; inicios: number[]; limpar: () => void }

/** Aleatório com semente: o filme sai igual em toda reprodução e em toda exportação. */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Liga os caracteres em pedaços irregulares (como a resposta de uma IA chegando), entre `ini` e `fim`. */
function digitar(tl: gsap.core.Timeline, chars: Element[], ini: number, fim: number, seed: number) {
  const r = rng(seed)
  const grupos: { els: Element[]; peso: number }[] = []
  for (let i = 0; i < chars.length; ) {
    const n = 1 + Math.floor(r() * 5)
    const els = chars.slice(i, i + n)
    const quebra = els.some((c) => c.textContent === '\n')
    grupos.push({ els, peso: n * (0.55 + r() * 0.9) + (quebra ? 3 : 0) })
    i += n
  }
  const total = grupos.reduce((s, g) => s + g.peso, 0)
  let t = ini
  for (const g of grupos) {
    tl.set(g.els, { display: 'inline' }, t)
    t += ((fim - ini) * g.peso) / total
  }
}

/** Posição de `el` dentro de `base`, pela cadeia de offsetParent (não sofre com as transformações 3D). */
function posicao(el: HTMLElement, base: HTMLElement) {
  let x = 0
  let y = 0
  let e: HTMLElement | null = el
  while (e && e !== base) {
    x += e.offsetLeft
    y += e.offsetTop
    e = e.offsetParent as HTMLElement | null
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight }
}

const palavras = (el: Element | null) => (el ? [...el.querySelectorAll('.wi')] : [])
const fmt1 = (v: number) => v.toFixed(1).replace('.', ',')
const fmtMil = (v: number) => Math.round(v).toLocaleString('pt-BR')

export function montarFilme(stage: HTMLElement, formato: Formato, vel: Velocidades): Filme {
  const V = formato === '9x16'
  const q = <T extends HTMLElement = HTMLElement>(s: string) => stage.querySelector(s) as T
  const qa = (s: string) => [...stage.querySelectorAll<HTMLElement>(s)]
  const criados: HTMLElement[] = []
  const ctx = gsap.context(() => {}, stage)

  // Medidas por formato (px do palco).
  const L = V
    ? { card: [540, 1330], foco: [540, 1330], sai: { x: 0, y: 1500 }, po: ['500px 1180px', '585px 1290px', '540px 1330px'], logoY: -90, zoom: 1.14 }
    : { card: [1360, 600], foco: [860, 620], sai: { x: 900, y: 40 }, po: ['1290px 500px', '1420px 570px', '1360px 600px'], logoY: -120, zoom: 1.16 }

  const camera = q('.camera')
  const space = q('.space')
  const rig = q('.phone-rig')
  const cards = { a: q('.fc-a'), b: q('.fc-b'), c: q('.fc-c'), d: q('.fc-d') }
  const profundidade: [HTMLElement, number, number][] = [
    [cards.a, 130, 16],
    [cards.b, 230, -16],
    [cards.d, 180, 12],
    [cards.c, 70, -10],
  ]
  const limitCard = q('.limit-card')
  const logo = q('.logo')
  const codeChars = qa('[data-code="phone"] .ch')
  const quebras = codeChars.map((c, i) => (c.classList.contains('nl') ? i : -1)).filter((i) => i >= 0)
  const meio = quebras[11] + 1 // fim da linha 12: daqui em diante é a cena 2
  const ultimaLinha = codeChars.length - (quebras[quebras.length - 1] + 1)
  const corte = codeChars.length - (ultimaLinha - CORTE_ULTIMA_LINHA)
  const caret = q('[data-code="phone"] .caret')


  // ---------------- Cena 1: o gancho ----------------
  const gancho = () => {
    const tl = gsap.timeline()
    tl.fromTo('.bg', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'sxSoft' }, 0)
    tl.fromTo(camera, { scale: 1.08, transformOrigin: '50% 50%' }, { scale: 1, duration: 5, ease: 'sxSoft' }, 0)
    tl.fromTo(space, { perspectiveOrigin: L.po[0] }, { perspectiveOrigin: L.po[1], duration: 5, ease: 'none' }, 0)
    tl.fromTo(
      rig,
      { y: V ? 280 : 200, z: -320, rotationY: -36, rotationX: 20, rotationZ: -5, opacity: 0 },
      { y: 0, z: 0, rotationY: -17, rotationX: 7, rotationZ: -1.5, opacity: 1, duration: 2.1, ease: 'sxOut' },
      0.05,
    )
    tl.to(rig, { rotationY: -11, rotationX: 5, rotationZ: -1, duration: 3, ease: 'sine.inOut' }, 2.1)
    tl.fromTo('.phone-shadow', { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 2, ease: 'sxOut' }, 0.2)

    // App no celular
    tl.fromTo('.ph-user', { opacity: 0, y: 16, scale: 0.96, transformOrigin: '100% 100%' }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'sxOut' }, 0.45)
    tl.fromTo('.ph-bot', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, ease: 'sxOut' }, 0.95)
    tl.fromTo('.ph-file', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: 'sxOut' }, 1.2)
    tl.fromTo('.ph-live i', { opacity: 1 }, { opacity: 0.25, duration: 0.3, yoyo: true, repeat: 9, ease: 'sine.inOut' }, 1.3)
    digitar(tl, codeChars.slice(0, meio), 1.5, 4.95, 7)

    // Título por palavras
    tl.fromTo(
      palavras(q('.hl1')),
      { opacity: 0, y: 46, filter: 'blur(14px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.15, ease: 'sxOut', stagger: 0.085 },
      0.3,
    )
    tl.fromTo(
      palavras(q('.hl2')),
      { opacity: 0, y: 46, filter: 'blur(14px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.15, ease: 'sxOut', stagger: 0.075 },
      2.4,
    )
    tl.to('.hl1', { opacity: 0.34, duration: 1.2, ease: 'sxSoft' }, 2.4)

    // Cartões flutuantes em profundidade
    profundidade.forEach(([el, z, ry], i) => {
      const t = 0.95 + i * 0.27
      tl.fromTo(
        el,
        { opacity: 0, z: z - 300, y: 50, rotationX: -28, rotationY: ry, filter: 'blur(12px) saturate(1) brightness(1)' },
        { opacity: 1, z, y: 0, rotationX: 0, rotationY: ry, filter: 'blur(0px) saturate(1) brightness(1)', duration: 1.4, ease: 'sxOut' },
        t,
      )
      const livre = 5 - (t + 1.4)
      tl.to(el, { y: i % 2 ? 12 : -12, duration: livre / 2, ease: 'sine.inOut', yoyo: true, repeat: 1 }, t + 1.4)
    })
    tl.fromTo('.fc-spin i', { y: 0, opacity: 1 }, { y: -5, opacity: 0.4, duration: 0.3, yoyo: true, repeat: 13, stagger: 0.1, ease: 'sine.inOut' }, 1.5)
    const tokens = { v: 0 }
    const num = q('[data-count="tokens"]')
    tl.fromTo(tokens, { v: 0 }, { v: 128400, duration: 3.6, ease: 'none', onUpdate: () => void (num.textContent = fmtMil(tokens.v)) }, 1.4)
    tl.fromTo('.fc-prog i', { scaleX: 0 }, { scaleX: 0.62, duration: 3.5, ease: 'sxSoft' }, 1.5)
    return tl
  }

  // ---------------- Cena 2: a interrupção ----------------
  const interrupcao = () => {
    const tl = gsap.timeline()
    const pare = 1.45
    digitar(tl, codeChars.slice(meio, corte), 0, pare - 0.05, 11)
    const tokens = { v: 128400 }
    const num = q('[data-count="tokens"]')
    tl.fromTo(tokens, { v: 128400 }, { v: 182400, duration: pare, ease: 'none', onUpdate: () => void (num.textContent = fmtMil(tokens.v)) }, 0)
    tl.to('.fc-prog i', { scaleX: 0.78, duration: pare, ease: 'none' }, 0)
    tl.to(space, { perspectiveOrigin: L.po[2], duration: 4, ease: 'sxSoft' }, 0)

    // Para. Tudo congela.
    tl.set(caret, { opacity: 0 }, pare)
    tl.set(caret, { opacity: 1 }, pare + 0.3)
    tl.set(caret, { opacity: 0 }, pare + 0.6)
    tl.to('.ph-live', { opacity: 0.3, duration: 0.3 }, pare)
    tl.fromTo('.ph-file .code', { opacity: 1, filter: 'saturate(1)' }, { opacity: 0.36, filter: 'saturate(0)', duration: 0.7, ease: 'sxSoft' }, pare + 0.1)
    tl.fromTo('.ph-limit', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'sxOut' }, pare + 0.15)
    tl.to('.ph-input-txt', { opacity: 0, duration: 0.3 }, pare + 0.15)
    tl.fromTo('.ph-input-off', { opacity: 0 }, { opacity: 1, duration: 0.4 }, pare + 0.25)
    tl.to('.ph-send', { opacity: 0.25, duration: 0.4 }, pare + 0.15)

    tl.to('.fc-spin i', { y: 0, opacity: 0.25, duration: 0.3 }, pare + 0.2)
    tl.set('.fc-state.on', { display: 'none' }, pare + 0.25)
    tl.set('.fc-state.off', { display: 'block' }, pare + 0.25)
    tl.to('.fc-prog i', { backgroundColor: '#ff8a7a', duration: 0.4 }, pare + 0.25)
    tl.to(Object.values(cards), { y: '+=12', filter: 'blur(0px) saturate(0.2) brightness(0.72)', duration: 1.4, ease: 'sxOut', stagger: 0.05 }, pare + 0.25)
    tl.to('.bg-glow', { opacity: 0.22, duration: 2, ease: 'sxSoft' }, pare)
    tl.to('.hl1', { opacity: 0.16, duration: 1.2 }, pare)

    // O aviso vem para a frente e a câmera chega perto.
    tl.fromTo(
      limitCard,
      { opacity: 0, z: 120, y: 60, scale: 0.92, filter: 'blur(14px)' },
      { opacity: 1, z: 280, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.1, ease: 'sxOut' },
      pare + 0.5,
    )
    tl.fromTo('.lc-meter i', { scaleX: 0.72, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.9, ease: 'sxOut' }, pare + 0.75)
    tl.set(camera, { transformOrigin: `${L.foco[0]}px ${L.foco[1]}px` }, 0)
    tl.to(camera, { scale: L.zoom, duration: 2.6, ease: 'sxInOut' }, pare - 0.05)
    tl.to(rig, { rotationY: -6, rotationX: 3, rotationZ: 0, duration: 2.6, ease: 'sxInOut' }, pare - 0.05)
    return tl
  }

  // ---------------- Cena 3: a transição ----------------
  const transicao = () => {
    const tl = gsap.timeline()
    tl.fromTo(rig, { filter: 'blur(0px)' }, { x: L.sai.x, y: L.sai.y, rotationY: V ? -14 : -50, rotationX: V ? 34 : 6, opacity: 0, filter: 'blur(8px)', duration: 1.1, ease: 'sxIn' }, 0)
    tl.to('.phone-shadow', { opacity: 0, duration: 0.6 }, 0)
    tl.to(Object.values(cards), { opacity: 0, scale: 0.85, z: '-=220', filter: 'blur(16px) saturate(0.2) brightness(0.72)', duration: 0.8, ease: 'sxIn', stagger: 0.06 }, 0.05)
    tl.to(limitCard, { opacity: 0, scale: 1.12, z: '+=160', filter: 'blur(20px)', duration: 0.85, ease: 'sxIn' }, 0.1)
    tl.to(palavras(q('.headline')), { opacity: 0, y: -30, filter: 'blur(12px)', duration: 0.7, ease: 'sxIn', stagger: 0.015 }, 0)
    tl.to(camera, { scale: 1, duration: 1.3, ease: 'sxInOut' }, 0)
    tl.to('.bg-glow', { opacity: 0.55, duration: 1.4, ease: 'sxSoft' }, 0.4)
    tl.fromTo('.bloom', { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 1.5, ease: 'sxOut' }, 0.55)
    tl.to('.bloom', { opacity: 0.5, duration: 1, ease: 'sxSoft' }, 2)

    tl.fromTo(logo, { opacity: 0, scale: 0.82, filter: 'blur(26px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'sxOut' }, 0.7)
    tl.fromTo('.logo-sheen', { backgroundPosition: '120% 0' }, { backgroundPosition: '-20% 0', duration: 1.3, ease: 'sxInOut' }, 1.25)
    tl.fromTo(
      palavras(q('.b-title')),
      { opacity: 0, y: 40, filter: 'blur(12px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'sxOut', stagger: 0.09 },
      1.4,
    )
    tl.fromTo(
      palavras(q('.b-tag')),
      { opacity: 0, y: 18, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'sxOut', stagger: 0.035 },
      1.95,
    )
    return tl
  }

  // ---------------- Cena 4: o produto ----------------
  const produto = () => {
    const tl = gsap.timeline()
    const dash = q('.dash')
    const lift = q('.lift-layer')
    const dashRig = q('.dash-rig')

    tl.to(logo, { opacity: 0, scale: 0.9, y: L.logoY - 40, filter: 'blur(10px)', duration: 0.55, ease: 'sxIn' }, 0)
    tl.to([...palavras(q('.b-title')), ...palavras(q('.b-tag'))], { opacity: 0, y: -22, filter: 'blur(10px)', duration: 0.55, ease: 'sxIn', stagger: 0.01 }, 0)
    tl.to('.bloom', { opacity: 0.18, duration: 1.2 }, 0.2)
    tl.set('.s4', { autoAlpha: 1 }, 0)

    // O painel entra em perspectiva e a câmera passeia.
    tl.fromTo(
      dashRig,
      { y: V ? 760 : 560, z: -420, rotationX: 50, rotationY: 0, rotationZ: 0, opacity: 0, scale: V ? 1.12 : 1 },
      { y: V ? 40 : 30, z: 0, rotationX: 24, rotationY: V ? -10 : -14, rotationZ: 3, opacity: 1, duration: 2.1, ease: 'sxOut' },
      0.55,
    )
    tl.to(dashRig, { rotationX: 15, rotationY: V ? -3 : -5, rotationZ: 1, duration: 1.6, ease: 'sxInOut' }, 2.0)
    tl.to(dashRig, { rotationX: 18, rotationY: V ? -12 : -17, rotationZ: 2.5, y: V ? 70 : 50, duration: 2.6, ease: 'sxInOut' }, 3.5)
    tl.to(dashRig, { rotationX: 9, rotationY: V ? -2 : -4, rotationZ: 0.5, y: V ? -10 : 10, duration: 2.6, ease: 'sxInOut' }, 6.1)

    const legenda = (sel: string, entra: number, sai?: number) => {
      const w = palavras(q(sel))
      tl.fromTo(w, { opacity: 0, y: 40, filter: 'blur(12px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.05, ease: 'sxOut', stagger: 0.06 }, entra)
      if (sai !== undefined) tl.to(w, { opacity: 0, y: -24, filter: 'blur(10px)', duration: 0.5, ease: 'sxIn', stagger: 0.012 }, sai)
    }
    legenda('.cap1', 0.6, 3.0)
    legenda('.cap2', 3.45, 6.2)
    legenda('.cap3', 6.6)

    // Visão geral: números e gráfico
    const metricas: [string, number, (v: number) => string][] = [
      ['tok', 18.4, fmt1],
      ['in', 15.1, fmt1],
      ['out', 3.3, fmt1],
      ['req', 2418, fmtMil],
    ]
    metricas.forEach(([id, alvo, f], i) => {
      const el = q(`[data-metric="${id}"]`)
      const o = { v: 0 }
      tl.fromTo(o, { v: 0 }, { v: alvo, duration: 1.7, ease: 'sxOut', onUpdate: () => void (el.textContent = f(o.v)) }, 1.15 + i * 0.08)
    })
    tl.fromTo('.d-bars i', { scaleY: 0 }, { scaleY: 1, duration: 1, ease: 'sxOut', stagger: 0.045 }, 1.25)

    // Menu: de "Visão geral" para "Como conectar"
    const itens = qa('.d-nav .d-item')
    const alvo = itens[4]
    tl.fromTo('.d-pill', { y: 0 }, { y: alvo.offsetTop, duration: 0.75, ease: 'sxInOut' }, 3.0)
    tl.fromTo(itens[0], { color: '#0b3824' }, { color: '#eef6f1', duration: 0.3 }, 3.15)
    tl.fromTo(itens[0].querySelector('svg'), { color: '#0b3824' }, { color: '#b5cfc7', duration: 0.3 }, 3.15)
    tl.fromTo(alvo, { color: '#eef6f1' }, { color: '#0b3824', duration: 0.3 }, 3.45)
    tl.fromTo(alvo.querySelector('svg'), { color: '#b5cfc7' }, { color: '#0b3824', duration: 0.3 }, 3.45)
    tl.set('.crumb-a', { display: 'none' }, 3.3)
    tl.set('.crumb-b', { display: 'inline' }, 3.3)
    tl.to('.d-overview', { opacity: 0, y: -16, duration: 0.45, ease: 'sxIn' }, 3.05)
    tl.fromTo('.d-guides', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'sxOut' }, 3.35)
    tl.fromTo('.d-tool', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'sxOut', stagger: 0.045 }, 3.45)

    // Um componente se desprende do painel, a câmera acompanha e ele volta.
    const desprender = (src: HTMLElement, z: number, ini: number, fim: number, extra: gsap.TweenVars = {}) => {
      const p = posicao(src, dash)
      const slot = document.createElement('div')
      slot.className = 'slot'
      Object.assign(slot.style, { left: `${p.x + 1}px`, top: `${p.y + 1}px`, width: `${p.w}px`, height: `${p.h}px`, borderRadius: getComputedStyle(src).borderRadius })
      const clone = src.cloneNode(true) as HTMLElement
      Object.assign(clone.style, { left: `${p.x + 1}px`, top: `${p.y + 1}px`, width: `${p.w}px`, height: `${p.h}px` })
      lift.append(slot, clone)
      criados.push(slot, clone)
      gsap.set([slot, clone], { autoAlpha: 0 })
      tl.set([slot, clone], { autoAlpha: 1 }, ini)
      tl.set(src, { visibility: 'hidden' }, ini)
      tl.fromTo(
        clone,
        { z: 0, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
        { z, y: -12, scale: 1.12, boxShadow: '0 60px 90px -24px rgba(0,0,0,0.85)', duration: 0.95, ease: 'sxOut', ...extra },
        ini,
      )
      tl.to(clone, { z: 0, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)', duration: 0.75, ease: 'sxInOut' }, fim)
      tl.set([slot, clone], { autoAlpha: 0 }, fim + 0.75)
      tl.set(src, { visibility: 'visible' }, fim + 0.75)
      return clone
    }
    desprender(q('.d-tool[data-tool="0"]'), 150, 3.95, 5.35)
    const seg = desprender(q('.d-models'), 110, 4.45, 6.0, { scale: 1.1, y: -18 })
    const spans = [...q('.d-models').querySelectorAll<HTMLElement>('span:not(.d-seg-pill)')]
    const spansClone = [...seg.querySelectorAll<HTMLElement>('span:not(.d-seg-pill)')]
    const pill = seg.querySelector<HTMLElement>('.d-seg-pill')!
    const pillOrig = q('.d-models .d-seg-pill')
    const fora = { color: '#b5cfc7' }
    const dentro = { color: '#0b3824' }
    for (const [i, s] of spans.entries()) gsap.set([s, spansClone[i]], i === 0 ? dentro : fora)
    gsap.set([pill, pillOrig], { left: spans[0].offsetLeft, width: spans[0].offsetWidth })
    ;[1, 2, 3, 0].forEach((idx, k) => {
      const t = 4.95 + k * 0.33
      const prev = [0, 1, 2, 3][k]
      tl.to(pill, { left: spans[idx].offsetLeft, width: spans[idx].offsetWidth, duration: 0.3, ease: 'sxInOut' }, t)
      tl.to(spansClone[prev], { ...fora, duration: 0.2 }, t)
      tl.to(spansClone[idx], { ...dentro, duration: 0.2 }, t + 0.1)
    })

    // O terminal sai do painel e vira uma janela: os comandos reais e o trabalho voltando.
    const tw = q('.termwin')
    const pt = posicao(q('.d-term'), dash)
    const W = V ? { x: 30, y: 330, w: 880, h: 560 } : { x: 230, y: 190, w: 1020, h: 500 }
    tl.fromTo(
      tw,
      { left: pt.x + 1, top: pt.y + 1, width: pt.w, height: pt.h, opacity: 0, z: 0 },
      { opacity: 1, duration: 0.25 },
      6.2,
    )
    tl.to(tw, { left: W.x, top: W.y, width: W.w, height: W.h, z: 170, duration: 1.05, ease: 'sxInOut' }, 6.3)
    tl.fromTo(dash, { filter: 'brightness(1) saturate(1)' }, { filter: 'brightness(0.5) saturate(0.8)', duration: 0.9, ease: 'sxSoft' }, 6.3)
    digitar(tl, qa('[data-code="term"] .ch'), 7.0, 8.0, 3)
    tl.set('[data-code="term"] .caret', { opacity: 0 }, 8.05)
    qa('.tw-line').forEach((l, i) => {
      tl.fromTo(l, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'sxOut' }, [8.15, 8.5, 8.85, 9.1, 9.45][i])
    })
    return tl
  }

  // ---------------- Cena 5: encerramento ----------------
  const encerramento = () => {
    const tl = gsap.timeline()
    tl.fromTo('.dash-rig', { filter: 'blur(0px)' }, { z: -900, y: '-=80', rotationX: 32, opacity: 0, filter: 'blur(6px)', duration: 1.25, ease: 'sxIn' }, 0)
    tl.to(palavras(q('.cap3')), { opacity: 0, y: -24, filter: 'blur(10px)', duration: 0.5, ease: 'sxIn', stagger: 0.02 }, 0)
    tl.to('.bloom', { opacity: 0.4, duration: 1.4, ease: 'sxSoft' }, 0.4)

    const perks = qa('.perk')
    tl.fromTo(
      perks,
      { opacity: 0, rotationX: -70, y: 90, z: -220, filter: 'blur(10px)', transformOrigin: '50% 100%' },
      { opacity: 1, rotationX: 0, y: 0, z: 0, filter: 'blur(0px)', duration: 1.15, ease: 'sxOut', stagger: 0.14 },
      0.7,
    )
    tl.fromTo('.perk-ico', { scale: 0.6 }, { scale: 1, duration: 0.9, ease: 'back.out(2)', stagger: 0.14 }, 0.95)
    tl.to(perks, { opacity: 0, y: -40, filter: 'blur(12px)', duration: 0.55, ease: 'sxIn', stagger: 0.06 }, 2.75)

    tl.fromTo(
      logo,
      { opacity: 0, scale: 0.85, y: L.logoY, filter: 'blur(22px)' },
      { opacity: 1, scale: 1, y: L.logoY, filter: 'blur(0px)', duration: 1.4, ease: 'sxOut', immediateRender: false },
      3.05,
    )
    tl.fromTo('.logo-sheen', { backgroundPosition: '120% 0' }, { backgroundPosition: '-20% 0', duration: 1.3, ease: 'sxInOut', immediateRender: false }, 3.6)
    tl.fromTo(
      palavras(q('.b-end')),
      { opacity: 0, y: 40, filter: 'blur(12px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'sxOut', stagger: 0.1 },
      3.55,
    )
    tl.fromTo('.b-cta', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.95, ease: 'sxOut' }, 4.45)
    tl.fromTo('.b-pill', { scale: 1 }, { scale: 1.035, duration: 0.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 5.2)
    return tl
  }

  const builders: Record<CenaId, () => gsap.core.Timeline> = { gancho, interrupcao, transicao, produto, encerramento }
  const tl = gsap.timeline({ paused: true })
  const inicios: number[] = []
  ctx.add(() => {
    gsap.set(limitCard, { xPercent: -50, yPercent: -50 })
    gsap.set(logo, { xPercent: -50, yPercent: -50, y: L.logoY })
    gsap.set(q('.s4'), { autoAlpha: 0 })
    let t = 0
    for (const c of CENAS) {
      const v = vel[c.id] || 1
      const cena = builders[c.id]()
      cena.timeScale(v)
      inicios.push(t)
      tl.add(cena, t)
      t += c.duracao / v
    }
    tl.set({}, {}, t)
  })
  // Passa uma vez pelo filme inteiro para gravar os valores iniciais de cada animação.
  tl.progress(1, true).progress(0, false)

  return {
    tl,
    inicios,
    limpar: () => {
      tl.kill()
      ctx.revert()
      criados.forEach((n) => n.remove())
    },
  }
}
