import roteiro from '../roteiro.json'
import tempos from './tempos.json'

export type Cena = 'quarto' | 'chamado' | 'investiga' | 'correcao' | 'deploy' | 'ideia' | 'final'
export type Fala = { id: string; cena: Cena; folga: number; texto: string; tela: string; dur: number }
export type Agenda = { id: string; cena: Cena; em: number; fim: number; ate: number }

const DUR = tempos as Record<string, number>

/** Falas do roteiro, já com a duração real do áudio gerado. */
export const FALAS: Fala[] = (roteiro.falas as Omit<Fala, 'dur'>[]).map((f) => ({ ...f, dur: DUR[f.id] ?? 4 }))

/** Quando cada fala começa (em), termina (fim) e até quando a cena dela fica na tela (ate). */
export function agendar(): Agenda[] {
  let t = 0.5
  return FALAS.map((f) => {
    const em = t
    const fim = em + f.dur
    t = fim + f.folga
    return { id: f.id, cena: f.cena, em, fim, ate: t }
  })
}

export const AGENDA = agendar()
export const DURACAO = AGENDA[AGENDA.length - 1].ate

/** Início e fim de cada cena (primeira fala até o fim da última fala dela). */
export function janelaDaCena(cena: Cena) {
  const a = AGENDA.filter((x) => x.cena === cena)
  return { de: a[0].em, ate: a[a.length - 1].ate }
}

export const CENAS: Cena[] = ['quarto', 'chamado', 'investiga', 'correcao', 'deploy', 'ideia', 'final']