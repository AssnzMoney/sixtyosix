// Coloca o som no criativo: voz da ElevenLabs no tempo de cada cena, efeitos sintetizados nos tempos da
// animação e (opcional) uma música que abaixa sob a voz. Normaliza em -14 LUFS (Reels/TikTok).
//   FILME=criativo node motion/exportar.mjs 9x16 mudo.mp4      (gera mudo.mp4 e mudo.json)
//   node motion/criativo/mixar.mjs mudo.mp4 final.mp4 [--musica trilha.mp3]
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const [, , video, saida, ...resto] = process.argv
if (!video || !saida) throw new Error('uso: node mixar.mjs <video-mudo.mp4> <saida.mp4> [--musica arquivo]')
const musica = resto.includes('--musica') ? resto[resto.indexOf('--musica') + 1] : null
const meta = JSON.parse(readFileSync(video.replace(/\.mp4$/, '.json'), 'utf8'))
const DUR = meta.duracao
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
function lufs(arq) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', arq, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
  return JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1))
}

const tmp = join(tmpdir(), `sixtysix-criativo-${process.pid}`)
mkdirSync(tmp, { recursive: true })

// 1) Efeitos: cada tipo sintetizado uma vez.
const R = 48000
const EFEITOS = {
  whoosh: `anoisesrc=c=pink:r=${R}:d=0.45:a=0.7,bandpass=f=1100:w=1600,afade=t=in:d=0.32:curve=exp,afade=t=out:st=0.32:d=0.13`,
  swish: `anoisesrc=c=white:r=${R}:d=0.26:a=0.35,highpass=f=2600,lowpass=f=9000,afade=t=in:d=0.13,afade=t=out:st=0.13:d=0.13`,
  pop: `aevalsrc='0.8*sin(2*PI*(950-3600*t)*t)*exp(-32*t)':s=${R}:d=0.14`,
  click: `aevalsrc='0.7*sin(2*PI*2300*t)*exp(-110*t)+0.4*sin(2*PI*900*t)*exp(-60*t)':s=${R}:d=0.06`,
  ding: `aevalsrc='0.45*(sin(2*PI*1318*t)+0.5*sin(2*PI*1975*t)+0.2*sin(2*PI*2637*t))*exp(-4.5*t)':s=${R}:d=1.0`,
  type: `aevalsrc='0.5*(random(0)*2-1)*exp(-180*t)':s=${R}:d=0.035,highpass=f=1800`,
  boom: `aevalsrc='0.95*sin(2*PI*(75-45*t)*t)*exp(-3.6*t)':s=${R}:d=1.0,lowpass=f=400`,
}
for (const [nome, src] of Object.entries(EFEITOS)) ff(['-f', 'lavfi', '-i', src, '-ac', '2', '-c:a', 'pcm_f32le', join(tmp, `${nome}.wav`)])

// 2) Faixa de efeitos.
const sons = meta.sons.filter((s) => s.t < DUR)
const efeitos = join(tmp, 'efeitos.wav')
ff([
  ...sons.flatMap((s) => ['-i', join(tmp, `${s.tipo}.wav`)]),
  '-filter_complex',
  sons.map((s, i) => `[${i}]adelay=${Math.round(s.t * 1000)}:all=1[e${i}]`).join(';') + ';' +
    sons.map((_, i) => `[e${i}]`).join('') + `amix=inputs=${sons.length}:normalize=0,apad=whole_dur=${DUR}`,
  '-t', String(DUR), '-c:a', 'pcm_f32le', efeitos,
])

// 3) Faixa de voz: cada fala no começo da cena dela.
const pastaVoz = join(AQUI, 'voz', 'falas')
const falas = meta.agenda.filter((a) => existsSync(join(pastaVoz, `${a.id}.mp3`)))
if (falas.length < meta.agenda.length) console.log(`aviso: só ${falas.length} de ${meta.agenda.length} falas têm áudio em ${pastaVoz}`)
const voz = join(tmp, 'voz.wav')
if (falas.length) {
  ff([
    ...falas.flatMap((a) => ['-i', join(pastaVoz, `${a.id}.mp3`)]),
    '-filter_complex',
    falas.map((a, i) => `[${i}]aresample=${R},aformat=channel_layouts=stereo,adelay=${Math.round(a.em * 1000)}:all=1[v${i}]`).join(';') + ';' +
      falas.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${falas.length}:normalize=0,` +
      `highpass=f=80,equalizer=f=3000:t=q:w=1.2:g=2,acompressor=threshold=-20dB:ratio=3:attack=5:release=150:makeup=2,apad=whole_dur=${DUR}`,
    '-t', String(DUR), '-c:a', 'pcm_f32le', voz,
  ])
} else ff(['-f', 'lavfi', '-i', `anullsrc=r=${R}:cl=stereo`, '-t', String(DUR), '-c:a', 'pcm_f32le', voz])

// 4) Níveis medidos: voz na frente, efeitos e música atrás.
const ganho = (arq, alvo) => {
  const i = Number(lufs(arq).input_i)
  return Number.isFinite(i) ? (alvo - i).toFixed(2) : '0'
}
const gV = falas.length ? ganho(voz, -16) : '0'
const gE = ganho(efeitos, -25)
const entradas = ['-i', voz, '-i', efeitos]
let grafo = `[0]volume=${gV}dB,asplit[voz][sc];[1]volume=${gE}dB[fx];`
if (musica) {
  const mus = join(tmp, 'musica.wav')
  ff(['-stream_loop', '-1', '-i', musica, '-t', String(DUR), '-af', `aresample=${R},aformat=channel_layouts=stereo,afade=t=out:st=${DUR - 1.2}:d=1.2`, '-c:a', 'pcm_f32le', mus])
  entradas.push('-i', mus)
  grafo += `[2]volume=${ganho(mus, -21)}dB[mus];[mus][sc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=400[musd];[voz][fx][musd]amix=inputs=3:normalize=0`
} else grafo += `[sc]anullsink;[voz][fx]amix=inputs=2:normalize=0`
const mix = join(tmp, 'mix.wav')
ff([...entradas, '-filter_complex', `${grafo},alimiter=limit=0.89:attack=3:release=60`, '-t', String(DUR), '-c:a', 'pcm_f32le', mix])

// 5) Normalização em duas passadas e o som no vídeo.
const m = lufs(mix)
const final = join(tmp, 'final.wav')
ff(['-i', mix, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=${R}`, '-c:a', 'pcm_f32le', final])
ff(['-i', video, '-i', final, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', saida])
console.log(`pronto: ${saida} (${DUR.toFixed(1)} s, ${falas.length} falas, ${sons.length} efeitos, música: ${musica ? 'sim' : 'não'})`)
rmSync(tmp, { recursive: true, force: true })
