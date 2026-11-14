// Trilha e efeitos do filme, sintetizados em código e presos aos tempos da animação
// (velocidade 1 em todas as cenas; ver motion/src/timeline.ts).
//   node motion/audio/trilha.mjs <pasta>  →  musica.wav e efeitos.wav (48 kHz, estéreo, float)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SR = 48000
const DUR = 29
const N = SR * DUR
const pasta = process.argv[2] || '.'
mkdirSync(pasta, { recursive: true })

// ---------- base ----------
let semente = 66
const rnd = () => {
  semente = (semente * 1664525 + 1013904223) >>> 0
  return semente / 4294967296
}
const ruido = () => rnd() * 2 - 1
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const TAU = Math.PI * 2

function bus() {
  return { L: new Float32Array(N), R: new Float32Array(N) }
}
function poe(b, i, v, pan = 0) {
  if (i < 0 || i >= N) return
  const a = (pan + 1) * 0.25 * Math.PI
  b.L[i] += v * Math.cos(a) * 1.414
  b.R[i] += v * Math.sin(a) * 1.414
}
/** Filtro de estado variável (Chamberlin): passa-baixa, banda e alta de uma vez. */
function svf() {
  let lp = 0, bp = 0
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR)
    const hp = x - lp - bp / q
    bp += f * hp
    lp += f * bp
    return { lp, bp, hp }
  }
}

function wav(nome, b) {
  const dados = Buffer.alloc(N * 8)
  for (let i = 0; i < N; i++) {
    dados.writeFloatLE(b.L[i], i * 8)
    dados.writeFloatLE(b.R[i], i * 8 + 4)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + dados.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22)
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34)
  h.write('data', 36); h.writeUInt32LE(dados.length, 40)
  writeFileSync(join(pasta, nome), Buffer.concat([h, dados]))
}

/** Reverb de Schroeder (4 pentes + 2 passa-tudo) por canal. */
function reverb(b, mix = 0.3, tam = 1) {
  const canal = (x, off) => {
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(Math.round((d + off) * tam * 1.09)), i: 0, lp: 0 }))
    const aps = [225, 556].map((d) => ({ buf: new Float32Array(Math.round((d + off / 3) * 1.09)), i: 0 }))
    const y = new Float32Array(N)
    for (let n = 0; n < N; n++) {
      let s = 0
      for (const c of combs) {
        const o = c.buf[c.i]
        c.lp = o * 0.7 + c.lp * 0.3
        c.buf[c.i] = x[n] * 0.25 + c.lp * 0.86
        c.i = (c.i + 1) % c.buf.length
        s += o
      }
      for (const a of aps) {
        const o = a.buf[a.i]
        const v = s + o * 0.5
        a.buf[a.i] = v
        a.i = (a.i + 1) % a.buf.length
        s = o - v * 0.5
      }
      y[n] = s
    }
    return y
  }
  const wl = canal(b.L, 0)
  const wr = canal(b.R, 23)
  for (let n = 0; n < N; n++) {
    b.L[n] = b.L[n] * (1 - mix * 0.5) + wl[n] * mix
    b.R[n] = b.R[n] * (1 - mix * 0.5) + wr[n] * mix
  }
}

// ---------- instrumentos ----------
/** Pad quente: dente de serra aditivo, 3 vozes desafinadas, abertura de filtro por `brilho`. */
function pad(b, t0, dur, notas, amp, brilho = 6, ataque = 0.9, soltura = 1.4) {
  const i0 = Math.round(t0 * SR)
  const tot = Math.round((dur + soltura) * SR)
  for (const m of notas) {
    for (const [cents, pan] of [[-7, -0.6], [0, 0], [7, 0.6]]) {
      const f = mtof(m) * 2 ** (cents / 1200)
      const fase0 = rnd() * TAU
      for (let k = 0; k < tot; k++) {
        const t = k / SR
        const env = Math.min(1, t / ataque) * (t > dur ? Math.max(0, 1 - (t - dur) / soltura) : 1)
        if (env <= 0) continue
        let s = 0
        for (let h = 1; h <= brilho; h++) s += Math.sin(fase0 * h + TAU * f * h * t) / (h * h * 0.6 + 0.4)
        poe(b, i0 + k, s * env * amp * 0.12, pan)
      }
    }
  }
}
function dedilhado(b, t0, m, amp, pan = 0, dec = 0.45) {
  const f = mtof(m)
  const i0 = Math.round(t0 * SR)
  for (let k = 0; k < SR * 1.2; k++) {
    const t = k / SR
    const env = Math.exp(-t / dec) * Math.min(1, t / 0.003)
    const s = Math.sin(TAU * f * t + 0.6 * Math.exp(-t / 0.08) * Math.sin(TAU * f * 2 * t)) + 0.25 * Math.sin(TAU * f * 3 * t) * Math.exp(-t / 0.1)
    poe(b, i0 + k, s * env * amp, pan)
  }
}
function bumbo(b, t0, amp, f0 = 120, f1 = 42, dec = 0.32) {
  const i0 = Math.round(t0 * SR)
  let fase = 0
  for (let k = 0; k < SR * (dec * 4); k++) {
    const t = k / SR
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.035)
    fase += (TAU * f) / SR
    const env = Math.exp(-t / dec) * Math.min(1, t / 0.002)
    poe(b, i0 + k, Math.sin(fase) * env * amp)
  }
}
function chimbal(b, t0, amp, dec = 0.04, pan = 0.2) {
  const i0 = Math.round(t0 * SR)
  const f = svf()
  for (let k = 0; k < SR * dec * 5; k++) {
    const t = k / SR
    const x = f(ruido(), 9000, 0.8).hp
    poe(b, i0 + k, x * Math.exp(-t / dec) * amp, pan)
  }
}
function baixo(b, t0, dur, m, amp) {
  const f = mtof(m)
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  for (let k = 0; k < SR * (dur + 0.1); k++) {
    const t = k / SR
    const env = Math.min(1, t / 0.01) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.1) : 1)
    const saw = ((f * t) % 1) * 2 - 1
    const x = flt(saw, 380 + 900 * Math.exp(-t / 0.12), 0.8).lp
    poe(b, i0 + k, (x + Math.sin(TAU * f * t) * 0.6) * env * amp)
  }
}

// ---------- efeitos ----------
function whoosh(b, t0, dur, f0, f1, amp, pan0 = 0, pan1 = 0, pico = 0.6) {
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  const n = Math.round(dur * SR)
  for (let k = 0; k < n; k++) {
    const p = k / n
    const env = p < pico ? Math.sin((p / pico) * Math.PI * 0.5) ** 2 : Math.cos(((p - pico) / (1 - pico)) * Math.PI * 0.5) ** 2
    const fc = f0 * (f1 / f0) ** p
    const x = flt(ruido(), fc, 1.4).bp
    poe(b, i0 + k, x * env * amp, pan0 + (pan1 - pan0) * p)
  }
}
function pop(b, t0, f, amp, pan = 0) {
  const i0 = Math.round(t0 * SR)
  let fase = 0
  for (let k = 0; k < SR * 0.25; k++) {
    const t = k / SR
    fase += (TAU * f * (1 + 0.7 * Math.exp(-t / 0.012))) / SR
    poe(b, i0 + k, Math.sin(fase) * Math.exp(-t / 0.06) * Math.min(1, t / 0.002) * amp, pan)
  }
}
function tique(b, t0, amp, fc = 4500, pan = 0) {
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  for (let k = 0; k < SR * 0.03; k++) {
    const t = k / SR
    poe(b, i0 + k, flt(ruido(), fc, 2).bp * Math.exp(-t / 0.004) * amp, pan)
  }
}
function tecla(b, t0, amp, pan = 0) {
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  const f = 160 + rnd() * 60
  for (let k = 0; k < SR * 0.06; k++) {
    const t = k / SR
    const x = flt(ruido(), 2600 + rnd() * 900, 1.5).bp * Math.exp(-t / 0.006) + Math.sin(TAU * f * t) * Math.exp(-t / 0.012) * 0.5
    poe(b, i0 + k, x * amp, pan)
  }
}
function baque(b, t0, amp) {
  bumbo(b, t0, amp, 95, 34, 0.42)
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  for (let k = 0; k < SR * 0.4; k++) {
    const t = k / SR
    poe(b, i0 + k, flt(ruido(), 260, 0.7).lp * Math.exp(-t / 0.09) * amp * 0.9)
  }
}
function bipe(b, t0, f, dur, amp) {
  const i0 = Math.round(t0 * SR)
  const flt = svf()
  for (let k = 0; k < SR * (dur + 0.05); k++) {
    const t = k / SR
    const env = Math.min(1, t / 0.006) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.05) : 1)
    const x = Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 3 * t) + 0.12 * Math.sin(TAU * f * 5 * t)
    poe(b, i0 + k, flt(x, 1800, 0.7).lp * env * amp)
  }
}
function sino(b, t0, m, amp, pan = 0, dec = 0.9) {
  const f = mtof(m)
  const i0 = Math.round(t0 * SR)
  for (let k = 0; k < SR * dec * 4; k++) {
    const t = k / SR
    const s = Math.sin(TAU * f * t) * Math.exp(-t / dec) + 0.35 * Math.sin(TAU * f * 2.76 * t) * Math.exp(-t / (dec * 0.35)) + 0.15 * Math.sin(TAU * f * 5.4 * t) * Math.exp(-t / (dec * 0.15))
    poe(b, i0 + k, s * Math.min(1, t / 0.002) * amp, pan)
  }
}
function brilho(b, t0, dur, amp) {
  const escala = [74, 76, 78, 81, 83, 86, 88, 90, 93]
  const n = Math.round(dur * 14)
  for (let i = 0; i < n; i++) {
    const t = t0 + (i / n) * dur
    sino(b, t, escala[Math.floor(rnd() * escala.length)] + (i > n / 2 ? 0 : 0), amp * (0.4 + 0.6 * Math.sin((i / n) * Math.PI)), rnd() * 1.6 - 0.8, 0.5)
  }
}
function subida(b, t0, dur, amp) {
  whoosh(b, t0, dur, 250, 7000, amp, -0.3, 0.3, 0.96)
  const i0 = Math.round(t0 * SR)
  let fase = 0
  for (let k = 0; k < SR * dur; k++) {
    const p = k / (SR * dur)
    fase += (TAU * (180 * 4 ** p)) / SR
    poe(b, i0 + k, Math.sin(fase) * p ** 2.5 * amp * 0.35)
  }
}

// ================= MÚSICA =================
const musica = bus()
const PARA = 6.45 // o código para aqui (5 s da cena 1 + 1,45 s da cena 2)

// Tensão do gancho: drone grave, pulso de relógio e um ruído que vai abrindo.
{
  const i1 = Math.round(PARA * SR)
  const flt = svf()
  for (let k = 0; k < i1; k++) {
    const t = k / SR
    const env = Math.min(1, t / 1.2)
    const drone = Math.sin(TAU * 36.71 * t) * 0.5 + Math.sin(TAU * 55 * t + Math.sin(TAU * 0.2 * t)) * 0.35 + Math.sin(TAU * 73.42 * t) * 0.18
    const ar = flt(ruido(), 300 + 2200 * (t / PARA) ** 2, 0.9).bp * 0.25 * (t / PARA)
    poe(musica, k, (drone * 0.55 + ar) * env * 0.5, 0)
  }
  const passo = 60 / 106.33 / 2
  for (let t = 0.6; t < PARA; t += passo) chimbal(musica, t, 0.05 + 0.08 * (t / PARA), 0.025, Math.sin(t * 3) * 0.4)
  for (let t = 2.75; t < PARA - 0.1; t += passo * 2) bumbo(musica, t, 0.28 + 0.2 * (t / PARA), 90, 40, 0.18)
  pad(musica, 2.4, PARA - 2.4, [38, 45, 52, 57], 0.35, 4, 2.4, 0.01)
}
// Corte seco no limite: tudo some (o pad acima já termina em PARA).
for (let k = Math.round(PARA * SR); k < Math.round(PARA * SR) + 480; k++) {
  const g = 1 - (k - Math.round(PARA * SR)) / 480
  musica.L[k] *= g
  musica.R[k] *= g
}
for (let k = Math.round(PARA * SR) + 480; k < Math.round(9.0 * SR); k++) musica.L[k] = musica.R[k] = 0

// A partir da logo: progressão em ré maior, 106 bpm. O compasso 7 (resolução) cai em 25,55 s.
const BAR = (60 / 106.33) * 4
const T0 = 9.75
const ACORDES = [
  [50, 57, 61, 64, 66], // Ré maj9
  [47, 54, 57, 62, 64], // Si m
  [43, 50, 59, 66, 69], // Sol maj9
  [45, 52, 59, 61, 64], // Lá add9
  [50, 57, 61, 64, 66], // Ré
  [43, 50, 59, 66, 69], // Sol
  [45, 52, 59, 61, 64], // Lá
  [50, 57, 62, 66, 69, 74], // Ré (final)
]
ACORDES.forEach((ac, i) => {
  const t = T0 + i * BAR
  const fim = i === 7
  pad(musica, t, fim ? DUR - t - 1.6 : BAR, ac, fim ? 0.7 : 0.55, fim ? 7 : 5, i === 0 ? 0.25 : 0.12, fim ? 1.6 : 0.5)
  const raiz = ac[0] - 12
  const colcheia = BAR / 8
  if (!fim) {
    for (let j = 0; j < 8; j++) {
      if (i >= 1) baixo(musica, t + j * colcheia, colcheia * 0.8, raiz, 0.22)
      const nota = ac[[0, 2, 1, 3, 2, 4, 3, 1][j]] + 12
      dedilhado(musica, t + j * colcheia, nota, 0.09, j % 2 ? 0.45 : -0.45)
    }
    if (i >= 1) for (let j = 0; j < 4; j++) bumbo(musica, t + j * (BAR / 4), 0.55)
    if (i >= 2) for (let j = 0; j < 4; j++) chimbal(musica, t + j * (BAR / 4) + BAR / 8, 0.09)
  } else {
    bumbo(musica, t, 0.8, 110, 30, 0.9)
    dedilhado(musica, t, 74, 0.12, 0, 1.4)
    dedilhado(musica, t + 0.12, 81, 0.09, 0.3, 1.4)
    dedilhado(musica, t + 0.24, 86, 0.07, -0.3, 1.6)
  }
})
// "Respiração" do pad com o bumbo (sidechain simples).
for (let k = Math.round((T0 + BAR) * SR); k < Math.round((T0 + 7 * BAR) * SR); k++) {
  const t = k / SR - T0
  const fase = (t % (BAR / 4)) / (BAR / 4)
  const g = 0.55 + 0.45 * Math.min(1, fase / 0.35)
  musica.L[k] *= g
  musica.R[k] *= g
}
reverb(musica, 0.22, 1)
// O reverb não pode vazar no silêncio da interrupção.
for (let k = Math.round(PARA * SR) + 240; k < Math.round(8.95 * SR); k++) musica.L[k] = musica.R[k] = 0
for (let k = Math.round(PARA * SR); k < Math.round(PARA * SR) + 240; k++) { const g = 1 - (k - Math.round(PARA * SR)) / 240; musica.L[k] *= g; musica.R[k] *= g }

// ================= EFEITOS =================
const fx = bus()
// Cena 1
whoosh(fx, 0.0, 1.5, 180, 1400, 0.22, 0.5, 0.2, 0.45) // o iPhone chega
pop(fx, 0.5, 880, 0.12, 0.25) // mensagem enviada
pop(fx, 1.0, 660, 0.08, 0.1) // resposta
;[0.95, 1.22, 1.49, 1.76].forEach((t, i) => whoosh(fx, t, 0.6, 600, 3500, 0.07, i % 2 ? 0.6 : -0.6, i % 2 ? 0.4 : -0.4, 0.3)) // cartões
for (let t = 1.5; t < PARA - 0.03; t += 0.045 + rnd() * 0.05) tique(fx, t, 0.035 + rnd() * 0.03, 5000 + rnd() * 2500, 0.1) // código chegando
// Cena 2: a interrupção
bipe(fx, PARA + 0.17, 523, 0.13, 0.13)
bipe(fx, PARA + 0.34, 392, 0.2, 0.13)
baque(fx, PARA + 0.5, 0.6) // o aviso vem para a frente
whoosh(fx, PARA + 0.45, 0.9, 900, 250, 0.08, 0, 0, 0.2)
// Cena 3: a transição
whoosh(fx, 9.0, 1.1, 2500, 200, 0.25, 0.1, 0.9, 0.35) // o celular sai
subida(fx, 8.95, 0.8, 0.18)
baque(fx, T0, 0.7) // a logo
brilho(fx, 10.0, 1.2, 0.05) // reflexo verde na logo
// Cena 4: o produto
whoosh(fx, 12.35, 1.6, 150, 1100, 0.2, 0, 0, 0.55) // o painel sobe
for (let i = 0; i < 4; i++) tique(fx, 13.2 + i * 0.09, 0.05, 3500, 0.2) // números
tique(fx, 15.0, 0.12, 2800, -0.2) // clique no menu
pop(fx, 15.4, 520, 0.06, 0.1)
whoosh(fx, 15.95, 0.7, 500, 2600, 0.12, -0.3, -0.1, 0.35) // cartão se solta
whoosh(fx, 16.45, 0.7, 600, 3000, 0.11, 0.2, 0.3, 0.35) // seletor se solta
;[16.95, 17.28, 17.61, 17.94].forEach((t, i) => tique(fx, t, 0.13, 3200 + i * 300, 0.25)) // troca de modelo
pop(fx, 17.4, 300, 0.07, -0.2) // cartão volta
whoosh(fx, 18.2, 1.1, 300, 2400, 0.16, 0, 0, 0.5) // o terminal vira janela
for (let t = 19.0; t < 20.0; t += 0.03 + rnd() * 0.035) tecla(fx, t, 0.09 + rnd() * 0.05, rnd() * 0.4 - 0.2)
;[20.15, 20.5, 20.85, 21.1].forEach((t) => pop(fx, t, 1200, 0.035, 0))
sino(fx, 21.45, 81, 0.09, 0.1, 0.7) // concluído
sino(fx, 21.57, 86, 0.08, -0.1, 0.9)
// Cena 5: encerramento
whoosh(fx, 22.0, 1.3, 1800, 150, 0.2, 0, 0, 0.3) // câmera se afasta
;[22.7, 22.84, 22.98].forEach((t, i) => { whoosh(fx, t, 0.6, 400 + i * 200, 2800, 0.1, 0, 0, 0.4); pop(fx, t + 0.35, 330 * 1.26 ** i, 0.05, 0) })
whoosh(fx, 24.75, 0.6, 3000, 500, 0.08, 0, 0, 0.2) // diferenciais saem
brilho(fx, 25.6, 1.3, 0.05) // reflexo na logo
pop(fx, 26.45, 740, 0.07, 0) // botão
reverb(fx, 0.18, 0.8)

wav('musica.wav', musica)
wav('efeitos.wav', fx)
console.log('trilha pronta em', pasta)
