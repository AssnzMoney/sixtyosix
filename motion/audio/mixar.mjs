// Junta voz + trilha + efeitos, abaixa a música quando a voz entra, normaliza para o Instagram
// (-14 LUFS) e coloca o som no vídeo (o último quadro fica 1 s a mais na tela).
//   node motion/audio/mixar.mjs <pasta-voz> <pasta-trilha> <video-mudo.mp4> <saida.mp4>
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , pastaVoz, pastaTrilha, video, saida] = process.argv
const roteiro = JSON.parse(readFileSync(new URL('./roteiro.json', import.meta.url), 'utf8'))
const DUR = 29
const ff = (args) => execFileSync('ffmpeg', ['-y', '-hide_banner', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
/** Loudness integrada (LUFS) e medidas para a normalização em duas passadas. */
function lufs(entrada) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', entrada, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' })
  return JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1))
}

const tmp = join(pastaTrilha, 'tmp')
mkdirSync(tmp, { recursive: true })

// 1) Faixa de voz: cada fala no seu tempo, com o ajuste de velocidade do roteiro.
const entradas = roteiro.falas.flatMap((f) => ['-i', join(pastaVoz, `${f.id}.wav`)])
const partes = roteiro.falas.map((f, i) => {
  const ms = Math.round(f.em * 1000)
  return `[${i}]atempo=${f.tempo},adelay=${ms}|${ms}[v${i}]`
})
const voz = join(tmp, 'voz.wav')
ff([
  ...entradas,
  '-filter_complex',
  `${partes.join(';')};${roteiro.falas.map((_, i) => `[v${i}]`).join('')}amix=inputs=${roteiro.falas.length}:normalize=0,` +
    `highpass=f=85,equalizer=f=220:t=q:w=1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-22dB:ratio=3:attack=4:release=140:makeup=2,` +
    `aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${DUR}`,
  '-t', String(DUR), '-c:a', 'pcm_f32le', voz,
])

// 2) Cada faixa num nível de partida, medido (voz na frente, música atrás, efeitos no meio).
const alvo = { voz: -16, musica: -21, efeitos: -24 }
const ganho = {}
for (const [nome, arq] of [['voz', voz], ['musica', join(pastaTrilha, 'musica.wav')], ['efeitos', join(pastaTrilha, 'efeitos.wav')]]) {
  const m = lufs(arq)
  ganho[nome] = (alvo[nome] - Number(m.input_i)).toFixed(2)
  console.log(`${nome}: ${m.input_i} LUFS → ganho ${ganho[nome]} dB`)
}

// 3) Mixagem: a música abaixa sob a voz (sidechain), limitador e normalização em duas passadas.
const mix = join(tmp, 'mix.wav')
ff([
  '-i', join(pastaTrilha, 'musica.wav'), '-i', join(pastaTrilha, 'efeitos.wav'), '-i', voz,
  '-filter_complex',
  `[0]volume=${ganho.musica}dB[mus];[1]volume=${ganho.efeitos}dB[fx];[2]volume=${ganho.voz}dB,asplit[voz][sc];` +
    `[mus][sc]sidechaincompress=threshold=0.04:ratio=6:attack=20:release=420:makeup=1[musd];` +
    `[musd][fx][voz]amix=inputs=3:normalize=0,alimiter=limit=0.89:attack=3:release=60`,
  '-t', String(DUR), '-c:a', 'pcm_f32le', mix,
])
const m = lufs(mix)
const final = join(tmp, 'final.wav')
ff([
  '-i', mix, '-af',
  `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'pcm_f32le', final,
])
console.log('mix final:', lufs(final).input_i, 'LUFS')

// 4) Vídeo: segura o último quadro 1 s e coloca o som.
ff([
  '-i', video, '-i', final, '-map', '0:v', '-map', '1:a',
  '-vf', 'tpad=stop_mode=clone:stop_duration=1', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-profile:v', 'high', '-level', '4.2', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '192k', '-t', String(DUR), '-movflags', '+faststart', saida,
])
console.log('pronto:', saida)
