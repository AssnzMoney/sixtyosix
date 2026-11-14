// Gera cada fala do roteiro com uma voz neural da Microsoft (a mesma da leitura em voz alta do Edge).
//   node motion/audio/voz.mjs <pasta-de-saida> [caminho-do-msedge-tts]
// O pacote msedge-tts não fica no projeto: instale numa pasta à parte e passe o caminho.
import { mkdirSync, readFileSync, renameSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const [, , saida, pacote = 'msedge-tts'] = process.argv
const require = createRequire(join(process.cwd(), 'x.js'))
const { MsEdgeTTS, OUTPUT_FORMAT } = require(pacote)
const roteiro = JSON.parse(readFileSync(new URL('./roteiro.json', import.meta.url), 'utf8'))
mkdirSync(saida, { recursive: true })

for (const fala of roteiro.falas) {
  const tts = new MsEdgeTTS()
  await tts.setMetadata(roteiro.voz, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3)
  const pasta = join(saida, `tmp-${fala.id}`)
  mkdirSync(pasta, { recursive: true })
  const { audioFilePath } = await tts.toFile(pasta, fala.texto, { rate: roteiro.velocidade })
  renameSync(audioFilePath, join(saida, `${fala.id}.mp3`))
  tts.close()
  console.log(fala.id, fala.texto)
}
