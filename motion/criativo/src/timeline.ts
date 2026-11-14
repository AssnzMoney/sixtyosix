import gsap from 'gsap'
import { FALAS, FATURA, tempoDa, type Fala } from './roteiro'

export type Som = { t: number; tipo: 'whoosh' | 'pop' | 'click' | 'ding' | 'type' | 'boom' | 'swish' }
export type Agenda = { id: string; em: number; fim: number; ate: number }
export type Filme = { tl: gsap.core.Timeline; agenda: Agenda[]; sons: Som[]; duracao: number; limpar: () => void }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

/** Quando cada fala começa e até quando a cena dela fica na tela. */
export function agendar(): Agenda[] {
  let t = 0.35
  return FALAS.map((f) => {
    const em = t
    const fim = em + tempoDa(f).dur
    t = fim + f.folga
    return { id: f.id, em, fim, ate: t }
  })
}

export function montar(stage: HTMLElement): Filme {
  const q = <T extends HTMLElement = HTMLElement>(s: string, base: ParentNode = stage) => base.querySelector(s) as T
  const qa = (s: string, base: ParentNode = stage) => [...base.querySelectorAll<HTMLElement>(s)]
  const agenda = agendar()
  const sons: Som[] = []
  const som = (t: number, tipo: Som['tipo']) => sons.push({ t: Math.max(0, t), tipo })
  const duracao = agenda[agenda.length - 1].ate
  const ctx = gsap.context(() => {}, stage)
  const tl = gsap.timeline({ paused: true })

  const fala = (id: string) => FALAS.find((f) => f.id === id) as Fala
  const ag = (id: string) => agenda.find((a) => a.id === id) as Agenda
  /** Momento (s do filme) da palavra falada que bate com `alvo` (a partir da n-ésima ocorrência). */
  const quando = (id: string, alvo: string, n = 0) => {
    const ps = tempoDa(fala(id)).palavras
    // Palavra exata primeiro; se não houver, uma que comece com o alvo ("gra" → "graça").
    const exatas = ps.filter((p) => norm(p.w) === norm(alvo))
    const hits = exatas.length ? exatas : ps.filter((p) => norm(p.w).startsWith(norm(alvo)))
    const p = hits[Math.min(n, hits.length - 1)]
    return ag(id).em + (p ? p.t : 0)
  }
  /** Tempo de cada palavra da tela: casa com a fala em ordem; o que não casa entra logo depois da anterior. */
  const temposTela = (id: string, palavras: string[]) => {
    const ps = tempoDa(fala(id)).palavras
    let i = 0
    let ultimo = ag(id).em - 0.05
    return palavras.map((w) => {
      const alvo = norm(w)
      // Exata; ou a falada começa com a da tela; ou a da tela junta duas faladas ("SixtySix" = "Sixty Six").
      const casa = (pw: string) => pw === alvo || (alvo.length >= 3 && pw.startsWith(alvo)) || (pw.length >= 5 && alvo.startsWith(pw))
      for (const regra of [(pw: string) => pw === alvo, casa]) {
        for (let j = i; j < ps.length; j++) {
          const pw = norm(ps[j].w)
          if (pw && alvo && regra(pw)) {
            i = j + 1
            return (ultimo = ag(id).em + ps[j].t)
          }
        }
      }
      return (ultimo += 0.12)
    })
  }
  /** Palavras entram saindo do desfoque, com um leve pulo. */
  const pop = (els: Element[], ts: number[], forte = 1) =>
    els.forEach((el, k) =>
      tl.fromTo(el, { opacity: 0, y: 46 * forte, scale: 0.72, filter: 'blur(16px)' }, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.42, ease: 'back.out(2.4)' }, ts[k] - 0.06),
    )
  const titulo = (cena: HTMLElement, id: string) => {
    const ws = qa('.titulo .wi', cena)
    if (ws.length) pop(ws, temposTela(id, ws.map((w) => w.textContent || '')))
  }
  /** Balanço contínuo (deixa tudo "vivo" entre um movimento e outro). */
  const flutuar = (el: Element, ini: number, fim: number, amp = 14, rot = 0) => {
    const ciclos = Math.max(1, Math.floor((fim - ini) / 1.6))
    tl.to(el, { y: `+=${amp}`, rotation: rot ? `+=${rot}` : undefined, duration: (fim - ini) / ciclos / 2, ease: 'sine.inOut', yoyo: true, repeat: ciclos * 2 - 1 }, ini)
  }

  // ---- Câmera e cortes entre cenas ----
  tl.fromTo(q('.camera'), { scale: 1 }, { scale: 1.045, duration: duracao, ease: 'none' }, 0)
  const cenas = agenda.map((a) => q(`.c-${a.id}`))
  agenda.forEach((a, i) => {
    const el = cenas[i]
    const ini = i === 0 ? 0 : a.em - 0.22
    const sai = i < agenda.length - 1 ? agenda[i + 1].em - 0.22 : duracao + 1
    tl.set(el, { visibility: 'visible' }, ini)
    if (i > 0) tl.fromTo(el, { scale: 0.82, opacity: 0, filter: 'blur(14px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.34, ease: 'power3.out' }, ini)
    if (i < agenda.length - 1) {
      tl.to(el, { scale: 1.4, opacity: 0, filter: 'blur(20px)', duration: 0.24, ease: 'power2.in' }, sai - 0.2)
      tl.set(el, { visibility: 'hidden' }, sai + 0.05)
      som(sai - 0.18, 'whoosh')
    }
  })

  // 1. Gancho
  {
    const c = cenas[0]
    titulo(c, 'gancho')
    const card = q('.fatura', c)
    const t = quando('gancho', 'caro')
    tl.fromTo(card, { y: 620, rotationX: -55, opacity: 0, scale: 0.85 }, { y: 0, rotationX: 0, opacity: 1, scale: 1, duration: 0.75, ease: 'back.out(1.5)' }, t)
    som(t + 0.05, 'swish')
    tl.fromTo(card, { rotationY: -10 }, { rotationY: 8, duration: ag('gancho').ate - t, ease: 'sine.inOut' }, t)
    const linhas = qa('.fat-linha', c)
    tl.from(linhas, { opacity: 0, x: -40, stagger: 0.18, duration: 0.3, ease: 'power2.out' }, t + 0.3)
    const valor = q('.fat-valor', c)
    const n = { v: 0 }
    const tc = ag('gancho').fim - 0.25
    tl.to(n, { v: FATURA.brl, duration: 0.7, ease: 'power3.out', onUpdate: () => void (valor.textContent = `R$ ${Math.round(n.v).toLocaleString('pt-BR')}`) }, tc)
    tl.fromTo(valor, { scale: 1 }, { scale: 1.16, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '100% 60%' }, tc + 0.62)
    som(tc + 0.62, 'boom')
  }

  // 2. Dor: os custos caem e empilham
  {
    const c = cenas[1]
    const chips = qa('.chip', c)
    const ts = [quando('dor', 'dolar'), quando('dor', 'iof'), quando('dor', 'cartao')]
    const giro = [-7, 5, -3]
    chips.forEach((ch, k) => {
      tl.fromTo(ch, { y: -1100, rotation: giro[k] * 3, opacity: 0 }, { y: 0, rotation: giro[k], opacity: 1, duration: 0.5, ease: 'back.out(1.7)' }, ts[k] - 0.12)
      som(ts[k] + 0.2, 'pop')
    })
    tl.to(q('.pilha', c), { x: 10, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' }, ts[2] + 0.38)
  }

  // 3. Virada: corte escuro
  {
    const a = ag('virada')
    const c = cenas[2]
    tl.set(q('.dark'), { opacity: 1 }, a.em - 0.22)
    tl.set(q('.dark'), { opacity: 0 }, a.ate - 0.02)
    tl.fromTo(q('.flash'), { opacity: 0.9 }, { opacity: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, a.ate - 0.02)
    titulo(c, 'virada')
    tl.fromTo(q('.brilho', c), { scale: 0.4, opacity: 0 }, { scale: 1.1, opacity: 1, duration: 0.9, ease: 'power2.out' }, quando('virada', 'reais'))
    som(a.em - 0.2, 'boom')
  }

  // 4. Produto: carrossel de celulares
  {
    const c = cenas[3]
    titulo(c, 'produto')
    const [f1, f2, f3] = qa('.fone', c)
    const ts = [quando('produto', 'claude'), quando('produto', 'codex'), quando('produto', 'api')]
    const centro = { x: 0, z: 0, rotationY: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
    const esquerda = { x: -400, z: -320, rotationY: 32, scale: 0.86, opacity: 0.55, filter: 'blur(3px)' }
    const fora = { x: -820, z: -600, rotationY: 45, scale: 0.7, opacity: 0, filter: 'blur(8px)' }
    const chega = { x: 900, z: -200, rotationY: -55, scale: 0.9, opacity: 0, filter: 'blur(10px)' }
    gsap.set([f1, f2, f3], chega)
    const d = { duration: 0.6, ease: 'power3.out' }
    tl.fromTo(f1, chega, { ...centro, ...d }, ts[0] - 0.1)
    tl.to(f1, { ...esquerda, ...d }, ts[1] - 0.1)
    tl.fromTo(f2, chega, { ...centro, ...d }, ts[1] - 0.1)
    tl.to(f1, { ...fora, ...d }, ts[2] - 0.1)
    tl.to(f2, { ...esquerda, ...d }, ts[2] - 0.1)
    tl.fromTo(f3, chega, { ...centro, ...d }, ts[2] - 0.1)
    ts.forEach((t) => som(t - 0.12, 'swish'))
  }

  // 5. Pix: comprovante, check e dinheiro 3D
  {
    const a = ag('pix')
    const c = cenas[4]
    titulo(c, 'pix')
    const rec = q('.recibo', c)
    tl.fromTo(rec, { y: 420, rotationX: 50, opacity: 0, scale: 0.8 }, { y: 0, rotationX: 0, opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.4)' }, a.em - 0.1)
    const tPix = quando('pix', 'pix')
    tl.fromTo(q('.rec-ok', c), { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' }, tPix)
    som(tPix + 0.1, 'ding')
    const ped = q('.pedestal', c)
    tl.fromTo(ped, { y: 500, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, a.em + 0.1)
    flutuar(ped, a.em + 0.9, a.ate, -16)
    const tPartir = quando('pix', 'partir')
    tl.fromTo(q('.rec-valor', c), { scale: 1 }, { scale: 1.12, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }, quando('pix', 'setenta'))
    som(quando('pix', 'setenta'), 'pop')
    tl.fromTo(q('.miuda'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, tPartir)
    tl.to(q('.miuda'), { opacity: 0, duration: 0.2 }, a.ate - 0.25)
  }

  // 6. Sem: interruptores ligando
  {
    const c = cenas[5]
    qa('.linha-sem', c).forEach((ln, k) => {
      const t = quando('sem', 'sem', k)
      tl.fromTo(ln, { x: -260, opacity: 0, filter: 'blur(12px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' }, t - 0.12)
      tl.to(q('.toggle', ln), { backgroundColor: '#4cc72a', duration: 0.18 }, t + 0.25)
      tl.to(q('.knob', ln), { x: 82, duration: 0.24, ease: 'back.out(2)' }, t + 0.25)
      som(t + 0.25, 'click')
    })
  }

  // 7. E o melhor: a palavra ecoa
  {
    const a = ag('melhor')
    const c = cenas[6]
    const ws = qa('.e1 .wi', c)
    pop(ws, temposTela('melhor', ws.map((w) => w.textContent || '')), 1.4)
    tl.fromTo(q('.e2', c), { y: 160, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, a.fim - 0.1)
    tl.fromTo(q('.e3', c), { y: 300, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, a.fim + 0.02)
    som(a.fim - 0.1, 'swish')
  }

  // 8. Teste grátis: conversa
  {
    const a = ag('teste')
    const c = cenas[7]
    const ini = a.em - 0.15
    tl.from(q('.chat-head', c), { opacity: 0, y: -30, duration: 0.3 }, ini)
    const bolhas = qa('.bolha', c)
    const ts = [ini + 0.05, ini + 0.5, ini + 0.95, Math.max(ini + 1.4, quando('teste', 'gra'))]
    bolhas.forEach((b, k) => {
      const dir = b.classList.contains('dir')
      tl.fromTo(b, { scale: 0.4, opacity: 0, y: 30, transformOrigin: dir ? '100% 100%' : '0% 100%' }, { scale: 1, opacity: 1, y: 0, duration: 0.36, ease: 'back.out(2.2)' }, ts[k])
      som(ts[k], 'pop')
    })
    tl.fromTo(q('.reacao', c), { scale: 0, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)' }, ts[3] + 0.4)
    const cal = q('.calendario', c)
    tl.fromTo(cal, { y: 400, opacity: 0, rotation: -8 }, { y: 0, opacity: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.4)' }, quando('teste', 'sete') - 0.1)
    flutuar(cal, quando('teste', 'sete') + 0.6, a.ate, -14, 2)
    const ws = qa('.titulo .wi', c)
    pop(ws, [quando('teste', 'sete'), quando('teste', 'dias'), quando('teste', 'gra')])
  }

  // 9. Pilares: um entra, o outro sai de lado
  {
    const c = cenas[8]
    const ps = qa('.pilar', c)
    const ts = [quando('pilares', 'preco'), quando('pilares', 'qualidade'), quando('pilares', 'suporte')]
    ps.forEach((p, k) => {
      tl.fromTo(p, { x: 700, opacity: 0, scale: 0.8, filter: 'blur(14px)' }, { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out' }, ts[k] - 0.12)
      if (k < ps.length - 1) tl.to(p, { x: -700, opacity: 0, scale: 0.8, filter: 'blur(14px)', duration: 0.4, ease: 'power3.in' }, ts[k + 1] - 0.3)
      som(ts[k] - 0.12, 'swish')
    })
    flutuar(ps[0].querySelector('img')!, ts[0] + 0.4, ts[1], -12)
  }

  // 10. Chamada final: botão, espera, logo e o endereço sendo digitado
  {
    const a = ag('cta')
    const c = cenas[9]
    const botao = q('.botao', c)
    const toque = q('.toque', c)
    tl.fromTo(botao, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, a.em - 0.15)
    const tS = quando('cta', 'saiba')
    tl.fromTo(toque, { x: 260, y: 360, opacity: 0, scale: 1 }, { x: 0, y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, tS - 0.45)
    tl.to(toque, { scale: 0.7, duration: 0.1 }, tS + 0.05)
    tl.to(botao, { scale: 0.9, duration: 0.1, ease: 'power2.out' }, tS + 0.05)
    tl.to(botao, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, tS + 0.15)
    tl.to(toque, { scale: 1.6, opacity: 0, duration: 0.4 }, tS + 0.15)
    som(tS + 0.05, 'click')
    const tTo = quando('cta', 'to')
    tl.to(botao, { y: -500, opacity: 0, scale: 0.6, filter: 'blur(10px)', duration: 0.35, ease: 'power2.in' }, tTo - 0.3)
    const ws = qa('.titulo .wi', c)
    pop(ws, temposTela('cta', ws.map((w) => w.textContent || '')))
    const titulo = q('.titulo', c)
    tl.to(titulo, { opacity: 0, scale: 1.3, filter: 'blur(14px)', duration: 0.25, ease: 'power2.in' }, a.fim + 0.15)
    const tLogo = a.fim + 0.35
    tl.fromTo(q('.logo', c), { scale: 0.3, rotation: -10, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, tLogo)
    som(tLogo, 'boom')
    const busca = q('.busca', c)
    tl.fromTo(busca, { y: 80, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, tLogo + 0.35)
    const letras = qa('.lt', c)
    const tDig = tLogo + 0.75
    letras.forEach((l, k) => tl.set(l, { display: 'inline' }, tDig + k * 0.055))
    for (let k = 0; k < letras.length; k += 3) som(tDig + k * 0.055, 'type')
    const cursor = q('.cursor', c)
    const piscas = Math.floor((a.ate - tDig) / 0.5)
    tl.to(cursor, { opacity: 0, duration: 0.25, yoyo: true, repeat: piscas, ease: 'steps(1)' }, tDig + letras.length * 0.055)
    tl.fromTo(q('.miuda'), { opacity: 0 }, { opacity: 1, duration: 0.3 }, tLogo + 0.5)
  }

  return { tl, agenda, sons: sons.sort((x, y) => x.t - y.t), duracao, limpar: () => { tl.kill(); ctx.revert() } }
}
