/**
 * Criativo SixtySix (Reels/TikTok 9:16): a narração manda no tempo.
 * `texto` é o que a voz fala (escrito para soar bem na ElevenLabs); `tela` é o que aparece,
 * palavra por palavra, no tempo da fala. Entre *asteriscos* fica o destaque.
 * `folga` = segundos de imagem depois que a fala termina, antes da próxima cena.
 */
import tempos from '../voz/tempos.json'
import roteiro from '../voz/falas.json'

export type Fala = { id: string; texto: string; tela: string; folga: number }

/** As falas ficam em voz/falas.json: o mesmo arquivo que gera a voz na ElevenLabs. */
export const FALAS: Fala[] = roteiro.falas

export type Tempo = { dur: number; palavras: { w: string; t: number }[] }

/** Tempos medidos na voz gerada (voz/tempos.json); sem voz ainda, uma estimativa pelo número de palavras. */
export function tempoDa(f: Fala): Tempo {
  const medido = (tempos as Record<string, Tempo>)[f.id]
  if (medido) return medido
  const ws = f.texto.split(/\s+/)
  let t = 0
  const palavras = ws.map((w) => {
    const p = { w, t }
    t += 0.17 + w.length * 0.045 + (/[,.?!:]$/.test(w) ? 0.18 : 0)
    return p
  })
  return { dur: t, palavras }
}

export const SITE = 'sixtysix.online'
export const PRECO = 'R$ 79,99'
export const LETRA_MIUDA = 'A partir de R$ 79,99 no Pix · conforme cotas e disponibilidade'
/** Fatura de exemplo: assinatura de US$ 200 no dólar efetivo de ~R$ 6,37 (câmbio + IOF + spread, a conta do site). */
export const FATURA = { usd: 200, brl: 1274 }
