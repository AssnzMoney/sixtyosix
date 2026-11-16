/**
 * Sons da maquininha (sem arquivos de áudio: gerados com Web Audio).
 * O navegador só toca som depois de um clique na página; por isso o contexto é criado cedo e destravado
 * no primeiro clique ou toque (ex.: "Já paguei, conferir agora"). Sem permissão, a animação segue em silêncio.
 */
let ctx: AudioContext | null = null

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  return ctx
}

/** Liga o destrave do som no primeiro clique, toque ou tecla. */
export function armSound() {
  audio()
  const unlock = () => {
    audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

/** Ruído branco curto, reaproveitado em todos os "trrr" da impressora. */
function noiseBuffer(c: AudioContext) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/**
 * Impressora térmica: um "trrr" curto a cada linha (sincronizado com os passos da animação)
 * e um zumbido baixo do motor enquanto o papel sai.
 */
export function playPrint(delay: number, duration: number, steps: number) {
  const c = audio()
  if (!c) return
  const start = c.currentTime + delay
  const noise = noiseBuffer(c)
  const step = duration / steps
  const master = c.createGain()
  master.gain.value = 0.32
  master.connect(c.destination)
  const band = c.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400
  band.Q.value = 1.4
  band.connect(master)
  for (let i = 0; i < steps; i++) {
    const t = start + i * step
    const src = c.createBufferSource()
    src.buffer = noise
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.9, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.01, t + step * 0.75)
    src.connect(g).connect(band)
    src.start(t, Math.random() * 0.15, step)
  }
  // Motor: zumbido grave e discreto durante toda a impressão.
  const motor = c.createOscillator()
  motor.type = 'sawtooth'
  motor.frequency.value = 96
  const low = c.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 420
  const mg = c.createGain()
  mg.gain.setValueAtTime(0, start)
  mg.gain.linearRampToValueAtTime(0.05, start + 0.05)
  mg.gain.setValueAtTime(0.05, start + duration - 0.05)
  mg.gain.linearRampToValueAtTime(0, start + duration)
  motor.connect(low).connect(mg).connect(c.destination)
  motor.start(start)
  motor.stop(start + duration + 0.05)
}

/** "Plim" de confirmação: duas notas limpas, como a maquininha aprovando. */
export function playPlim(delay: number) {
  const c = audio()
  if (!c) return
  const start = c.currentTime + delay
  for (const [freq, at] of [[1318.5, 0], [1975.5, 0.11]] as const) {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const g = c.createGain()
    const t = start + at
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    osc.connect(g).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.6)
  }
}
