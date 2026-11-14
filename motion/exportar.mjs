// Exporta o filme quadro a quadro (sem pular nenhum) e monta o MP4 com o ffmpeg.
//   node motion/exportar.mjs 9x16 saida.mp4            → vídeo
//   node motion/exportar.mjs 9x16 pasta --quadros 1,5,9 → só imagens desses segundos (para revisar)
// Precisa do servidor do site rodando (npm run dev, porta 8443), do Chrome e do ffmpeg.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , formato = '9x16', saida = `sixtysix-${formato}.mp4`, ...resto] = process.argv
const quadrosArg = resto.includes('--quadros') ? resto[resto.indexOf('--quadros') + 1] : null
const FPS = Number(process.env.FPS || 30)
const [W, H] = formato === '16x9' ? [1920, 1080] : [1080, 1920]
const URL_FILME = `${process.env.URL_BASE || 'http://localhost:8443'}/motion/?render=1&formato=${formato}`
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const perfil = join(tmpdir(), `sixtysix-motion-${process.pid}`)
const porta = 9400 + (process.pid % 400)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, `--window-size=${W},${H}`,
  '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check',
  '--force-color-profile=srgb', '--disable-background-timer-throttling', 'about:blank',
], { stdio: 'ignore' })
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let alvo
for (let i = 0; i < 80 && !alvo; i++) {
  await dormir(250)
  try {
    alvo = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page')
  } catch {}
}
if (!alvo) throw new Error('O Chrome não abriu')
const ws = new WebSocket(alvo.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0
const pend = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const avaliar = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
  return r.result?.result?.value
}

await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await cdp('Page.navigate', { url: URL_FILME })
for (let i = 0; i < 120; i++) {
  await dormir(250)
  try { if (await avaliar('!!(window.__film && window.__film.pronto)')) break } catch {}
}
const duracao = await avaliar('window.__film.duracao')
if (!duracao) throw new Error('O filme não carregou')
// Uma passada rápida aquece imagens e fontes no compositor.
for (let t = 0; t < duracao; t += 1) await avaliar(`window.__film.ir(${t})`)

async function quadro(t) {
  // Uma captura pode falhar de vez em quando (o Chrome ocupado); tenta de novo antes de desistir.
  for (let tentativa = 1; ; tentativa++) {
    await avaliar(`window.__film.ir(${t}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`)
    const r = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
    if (r.result?.data) return Buffer.from(r.result.data, 'base64')
    if (tentativa >= 5) throw new Error(`Falhou o quadro ${t}s: ${JSON.stringify(r.error || r)}`)
    console.log(`quadro ${t}s falhou (${r.error?.message || '?'}), tentando de novo`)
    await dormir(500 * tentativa)
  }
}

if (quadrosArg) {
  mkdirSync(saida, { recursive: true })
  for (const s of quadrosArg.split(',').map(Number)) {
    writeFileSync(join(saida, `${formato}-${String(s.toFixed(2)).padStart(6, '0')}.png`), await quadro(s))
  }
  console.log('imagens em', saida)
} else {
  const total = Math.round(duracao * FPS)
  const ff = spawn('ffmpeg', [
    '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-t', String(duracao), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-vf', 'scale=in_range=full:out_range=tv,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', saida,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const inicio = Date.now()
  for (let i = 0; i < total; i++) {
    const png = await quadro(i / FPS)
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 60 === 0) console.log(`quadro ${i}/${total} (${((Date.now() - inicio) / 1000).toFixed(0)} s)`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
  console.log('pronto:', saida)
}
ws.close()
chrome.kill()
await dormir(500)
try { rmSync(perfil, { recursive: true, force: true }) } catch {}
