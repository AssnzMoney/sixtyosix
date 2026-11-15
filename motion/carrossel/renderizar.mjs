// Gera as imagens dos carrosséis (cada .slide vira um PNG de 1080×1350).
//   node motion/carrossel/renderizar.mjs [pasta-de-saida]
// Usa o Chrome instalado (variável CHROME para outro caminho).
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const here = resolve(import.meta.dirname)
const saida = resolve(process.argv[2] || join(here, '..', '..', '.claude', 'prints', 'carrosseis'))
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const perfil = join(tmpdir(), `sixtysix-carrossel-${process.pid}`)
const porta = 9600 + (process.pid % 300)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' })
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let alvo
for (let i = 0; i < 80 && !alvo; i++) {
  await dormir(250)
  try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
}
if (!alvo) throw new Error('O Chrome não abriu')
const ws = new WebSocket(alvo.webSocketDebuggerUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let seq = 0
const pend = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const cdp = (method, params = {}) => new Promise((r) => { const id = ++seq; pend.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
const avaliar = async (expression) => (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

await cdp('Page.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 1160, height: 1400, deviceScaleFactor: 1, mobile: false })
mkdirSync(saida, { recursive: true })
for (const arquivo of readdirSync(here).filter((f) => /^c\d.*\.html$/.test(f)).sort()) {
  const nome = arquivo.replace(/\.html$/, '')
  await cdp('Page.navigate', { url: pathToFileURL(join(here, arquivo)).href })
  for (let i = 0; i < 60; i++) { await dormir(200); if (await avaliar('document.readyState === "complete"')) break }
  await avaliar(`Promise.all(['800 40px Fustat','700 40px Fustat','italic 400 40px "Instrument Serif"','500 20px Manrope','700 20px Manrope','800 20px Manrope','400 20px "DM Mono"','500 20px "DM Mono"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready).then(() => Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => i.onload = i.onerror = r))))`)
  await dormir(300)
  const caixas = await avaliar(`[...document.querySelectorAll('.slide')].map(s => { const r = s.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } })`)
  const pasta = join(saida, nome)
  rmSync(pasta, { recursive: true, force: true })
  mkdirSync(pasta, { recursive: true })
  for (const [i, c] of caixas.entries()) {
    const r = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: c.x, y: c.y, width: c.w, height: c.h, scale: 1 } })
    writeFileSync(join(pasta, `${String(i + 1).padStart(2, '0')}.png`), Buffer.from(r.result.data, 'base64'))
  }
  console.log(`${nome}: ${caixas.length} imagens`)
}
ws.close()
chrome.kill()
await dormir(400)
try { rmSync(perfil, { recursive: true, force: true }) } catch {}
console.log('pronto em', saida)
