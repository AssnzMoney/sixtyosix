// Gera cada fala do roteiro com voz neural e mede a duração (src/tempos.json), que o filme usa para sincronizar.
//   node motion/dev3d/voz.mjs [caminho-do-msedge-tts]
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const pacote = process.argv[2] || 'C:/Users/Alysson/ferramentas/tts/node_modules/msedge-tts'
const require = createRequire(join(AQUI, 'x.js'))
const { MsEdgeTTS, OUTPUT_FORMAT } = require(pacote)
const roteiro = JSON.parse(readFileSync(join(AQUI, 'roteiro.json'), 'utf8'))
const saida = join(AQUI, 'voz', 'falas')
mkdirSync(saida, { recursive: true })

const tempos = {}
for (const fala of roteiro.falas) {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(roteiro.voz, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const pasta = join(saida, `tmp-${fala.id}`)
  mkdirSync(pasta, { recursive: true })
  const { audioFilePath } = await tts.toFile(pasta, fala.texto, { rate: roteiro.velocidade })
  const final = join(saida, `${fala.id}.mp3`)
  renameSync(audioFilePath, final)
  rmSync(pasta, { recursive: true, force: true })
  tts.close()
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final], { encoding: 'utf8' }).trim())
  tempos[fala.id] = Math.round(dur * 100) / 100
  console.log(fala.id, tempos[fala.id] + 's', fala.texto)
}
writeFileSync(join(AQUI, 'src', 'tempos.json'), JSON.stringify(tempos, null, 2))
console.log('total falado:', Object.values(tempos).reduce((a, b) => a + b, 0).toFixed(1) + 's')