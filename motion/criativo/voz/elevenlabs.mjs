// Narração do criativo na ElevenLabs, com o tempo de cada palavra (a animação segue a voz).
//   node motion/criativo/voz/elevenlabs.mjs vozes                 → lista as vozes da conta
//   node motion/criativo/voz/elevenlabs.mjs amostra <voz> [<voz>…] → amostra-<voz>.mp3 com a fala de abertura
//   node motion/criativo/voz/elevenlabs.mjs gerar <voz>           → uma fala por arquivo + tempos.json
// A chave vem de ELEVENLABS_API_KEY (ambiente ou o .env da raiz do projeto, que o git ignora).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..', '..', '..')
const API = 'https://api.elevenlabs.io/v1'

function chave() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim()
  for (const f of ['.env', '.env.local']) {
    const p = join(RAIZ, f)
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)
    if (m) return m[1].trim()
  }
  throw new Error('Falta ELEVENLABS_API_KEY (coloque no .env da raiz do projeto).')
}
const KEY = chave()
const roteiro = JSON.parse(readFileSync(join(AQUI, 'falas.json'), 'utf8'))

async function api(caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'xi-api-key': KEY, ...(corpo ? { 'content-type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 400)}`)
  return r
}

/** Uma fala com os tempos por caractere; `antes`/`depois` dão continuidade de entonação entre as falas. */
async function falar(voz, texto, antes, depois) {
  const r = await api(`/text-to-speech/${voz}/with-timestamps?output_format=mp3_44100_128`, {
    text: texto,
    model_id: roteiro.modelo,
    voice_settings: roteiro.ajustes,
    language_code: 'pt',
    previous_text: antes || undefined,
    next_text: depois || undefined,
  })
  const j = await r.json()
  return { audio: Buffer.from(j.audio_base64, 'base64'), al: j.normalized_alignment || j.alignment }
}

/** Caracteres → palavras: cada palavra começa no primeiro caractere dela. */
function palavras(al) {
  const out = []
  let atual = null
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) return void (atual = null)
    if (!atual) out.push((atual = { w: '', t: +al.character_start_times_seconds[i].toFixed(3) }))
    atual.w += ch
  })
  const fim = al.character_end_times_seconds.at(-1)
  return { dur: +fim.toFixed(3), palavras: out }
}

const [, , cmd, ...args] = process.argv
if (cmd === 'vozes') {
  const { voices } = await (await api('/voices')).json()
  for (const v of voices) {
    const l = v.labels || {}
    console.log(`${v.voice_id}  ${v.name.padEnd(28)} ${[l.gender, l.age, l.accent, l.language, l.use_case || l.descriptive].filter(Boolean).join(' · ')}`)
  }
} else if (cmd === 'amostra') {
  const pasta = join(AQUI, 'amostras')
  mkdirSync(pasta, { recursive: true })
  const texto = roteiro.falas.slice(0, 3).map((f) => f.texto).join(' ')
  for (const voz of args) {
    const { audio } = await falar(voz, texto)
    writeFileSync(join(pasta, `amostra-${voz}.mp3`), audio)
    console.log('amostra:', join(pasta, `amostra-${voz}.mp3`))
  }
} else if (cmd === 'gerar') {
  const [voz] = args
  if (!voz) throw new Error('Diga qual voz: node elevenlabs.mjs gerar <voice_id>')
  const pasta = join(AQUI, 'falas')
  mkdirSync(pasta, { recursive: true })
  const tempos = {}
  const fs = roteiro.falas
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    const { audio, al } = await falar(voz, f.texto, fs[i - 1]?.texto, fs[i + 1]?.texto)
    writeFileSync(join(pasta, `${f.id}.mp3`), audio)
    tempos[f.id] = palavras(al)
    console.log(`${f.id.padEnd(8)} ${tempos[f.id].dur.toFixed(2)} s  ${f.texto}`)
  }
  writeFileSync(join(AQUI, 'tempos.json'), JSON.stringify(tempos, null, 1) + '\n')
  writeFileSync(join(pasta, 'voz.txt'), `${voz}\n`)
  console.log('tempos.json atualizado: a animação já segue a voz nova.')
} else {
  console.log('uso: vozes | amostra <voz…> | gerar <voz>')
}
