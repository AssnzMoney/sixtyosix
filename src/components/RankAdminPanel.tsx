import { useEffect, useState } from 'react'
import { Crown, EyeOff, Eye, ExternalLink, PencilLine, Trophy } from 'lucide-react'
import { adminHeaders } from '../lib/adminSession'
import { isLocalhost } from '../lib/isLocalhost'

type Entry = { id: string; title: string; description: string; link: string; cover: string | null; author: string; votes: number; created: string; userId: string; hidden: boolean }
type Challenge = {
  id: string; title: string; description: string; prizeDays: number; prizeText: string; startsAt: string; submitUntil: string; closesAt: string
  phase: 'upcoming' | 'submissions' | 'voting' | 'counting' | 'finished'; winner: string | null; winnerAt: string | null; winnerBy: string | null; winnerKeys: number | null; winnerSubscription: string | null
  entries: Entry[]
}
type User = Record<string, any>

const TZ = 'America/Sao_Paulo'
const PHASES: Record<Challenge['phase'], string> = { upcoming: 'Ainda não começou', submissions: 'Envios abertos', voting: 'Votação aberta', counting: 'Votação encerrada: confirme o campeão', finished: 'Campeão confirmado' }
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ })
const isoDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const monthOf = (iso: string) => isoDay(iso).slice(0, 7)
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: TZ })
const nextMonth = () => {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (now.getUTCDate() > 20 ? 1 : 0), 1))
  return d.toISOString().slice(0, 7)
}
// Prévia local do admin (/adminxv1?demo=1): exemplo de um mês apurando e um com campeão. Nada é salvo.
const DEMO_LIST = (): Challenge[] => {
  const e = (id: string, title: string, author: string, votes: number, extra: Partial<Entry> = {}): Entry => ({ id, title, author, votes, description: 'Projeto de exemplo para revisar o layout.', link: 'https://exemplo.com', cover: null, created: '2026-11-03T12:00:00Z', userId: '00000000-0000-4000-8000-00000000000' + id.slice(-1), hidden: false, ...extra })
  return [
    { id: 'c2', title: 'Um agente que organiza a sua semana', description: '', prizeDays: 30, prizeText: 'e destaque no Instagram', startsAt: '2026-11-01T03:00:00Z', submitUntil: '2026-11-26T02:59:59Z', closesAt: '2026-12-01T02:59:59Z', phase: 'counting', winner: null, winnerAt: null, winnerBy: null, winnerKeys: null, winnerSubscription: null,
      entries: [e('e1', 'Semana Zen', 'Luiz S.', 11), e('e2', 'Planner por voz', 'Ana R.', 7), e('e3', 'Spam de votos', 'Conta X.', 2, { hidden: true })] },
    { id: 'c1', title: 'Landing page em uma tarde', description: '', prizeDays: 30, prizeText: '', startsAt: '2026-10-01T03:00:00Z', submitUntil: '2026-10-26T02:59:59Z', closesAt: '2026-11-01T02:59:59Z', phase: 'finished', winner: 'e4', winnerAt: '2026-11-01T15:00:00Z', winnerBy: 'admin', winnerKeys: 1, winnerSubscription: 'sub',
      entries: [e('e4', 'Café Raiz', 'Eric M.', 18), e('e5', 'Portfólio Neon', 'Bruno C.', 9)] },
  ]
}

const EMPTY = () => ({ id: '', month: nextMonth(), title: '', description: '', prizeDays: '30', prizeText: '', submitUntil: '', closesAt: '' })

/** Aba "Rank" do admin: cria o tema de cada mês, modera os projetos e confirma o campeão (que já ganha os dias). */
export default function RankAdminPanel({ token, users }: { token: string; users: User[] }) {
  const demo = !token && isLocalhost() && new URLSearchParams(window.location.search).has('demo')
  const [list, setList] = useState<Challenge[] | null>(demo ? DEMO_LIST() : null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState(EMPTY)

  async function call<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch('/api/management', { method: 'POST', headers: { ...adminHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
    return result as T
  }
  async function load() {
    if (demo) return
    try {
      setList((await call<{ challenges: Challenge[] }>({ action: 'rank-list' })).challenges)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o rank.')
      setList([])
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function run(key: string, body: Record<string, unknown>, message: string) {
    setBusy(key)
    setError('')
    setNotice('')
    try {
      if (demo) throw new Error('Prévia local: nada é salvo.')
      await call(body)
      setNotice(message)
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.')
      return false
    } finally {
      setBusy('')
    }
  }

  const who = (id: string) => users.find((u) => u.id === id)
  const edit = (c: Challenge) => {
    setForm({ id: c.id, month: monthOf(c.startsAt), title: c.title, description: c.description, prizeDays: String(c.prizeDays), prizeText: c.prizeText, submitUntil: isoDay(c.submitUntil), closesAt: isoDay(c.closesAt) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {error && (
        <p role="alert" className="sx-admin-message is-error">
          {error}
        </p>
      )}
      {notice && <p className="sx-admin-message">{notice}</p>}

      <section className="sx-admin-panel">
        <div className="sx-router-head">
          <h3>
            <Trophy size={17} /> {form.id ? 'Editar tema' : 'Tema do mês'}
          </h3>
        </div>
        <p className="sx-router-sub">
          O tema aparece para todos na aba Rank do mês no começo do mês escolhido. Só assinantes (plano ativo ou chave paga) enviam projeto e votam, um voto por
          pessoa. Sem datas, os envios vão até o dia 25 e a votação até o último dia, às 23:59 de Brasília. Quando a votação fecha, você confirma o campeão aqui e
          os dias do prêmio entram no plano e na chave dele na hora.
        </p>
        <form
          className="sx-form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            void run('save', { action: 'rank-save', ...form, id: form.id || undefined, prizeDays: Number(form.prizeDays) }, form.id ? 'Tema atualizado.' : 'Tema criado.').then((ok) => {
              if (ok) setForm(EMPTY())
            })
          }}
        >
          <label>
            Mês
            <input type="month" required value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          </label>
          <label>
            Tema
            <input required minLength={3} maxLength={80} placeholder="Ex.: Um agente que organiza a sua semana" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="is-wide">
            Explicação do desafio
            <textarea maxLength={2000} rows={4} placeholder="O que é para fazer, o que vale e o que conta na escolha." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Dias grátis para o campeão
            <input type="number" min={0} max={365} inputMode="numeric" required value={form.prizeDays} onChange={(e) => setForm({ ...form, prizeDays: e.target.value })} />
            <small>Entram no plano e na validade da chave quando você confirmar o campeão.</small>
          </label>
          <label>
            Prêmio extra (opcional)
            <input maxLength={200} placeholder="Ex.: e destaque no Instagram da SixtySix" value={form.prizeText} onChange={(e) => setForm({ ...form, prizeText: e.target.value })} />
            <small>Só texto: você entrega na mão.</small>
          </label>
          <label>
            Envios até (opcional)
            <input type="date" value={form.submitUntil} onChange={(e) => setForm({ ...form, submitUntil: e.target.value })} />
          </label>
          <label>
            Votação até (opcional)
            <input type="date" value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} />
          </label>
          <div className="sx-actions is-wide">
            <button type="submit" className="sx-btn is-primary" disabled={busy === 'save'}>
              {busy === 'save' ? 'Salvando…' : form.id ? 'Salvar tema' : 'Criar tema'}
            </button>
            {form.id && (
              <button type="button" className="sx-btn" onClick={() => setForm(EMPTY())}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      {list === null ? (
        <p className="sx-admin-empty">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="sx-admin-empty">Nenhum tema ainda. Crie o primeiro acima.</p>
      ) : (
        list.map((c) => {
          const visible = c.entries.filter((e) => !e.hidden)
          const winner = c.entries.find((e) => e.id === c.winner)
          return (
            <section key={c.id} className="sx-admin-panel">
              <div className="sx-router-head">
                <h3>
                  {c.phase === 'finished' ? <Crown size={17} /> : <Trophy size={17} />} {c.title}
                </h3>
                <button type="button" className="sx-btn" onClick={() => edit(c)}>
                  <PencilLine size={14} /> Editar
                </button>
              </div>
              <p className="sx-router-sub">
                <strong style={{ textTransform: 'capitalize' }}>{monthLabel(c.startsAt)}</strong> · {PHASES[c.phase]} · envios até {day(c.submitUntil)} · votação até{' '}
                {day(c.closesAt)} · prêmio: {c.prizeDays} dias{c.prizeText ? ` ${c.prizeText}` : ''} · {visible.length} {visible.length === 1 ? 'projeto' : 'projetos'},{' '}
                {visible.reduce((s, e) => s + e.votes, 0)} votos
                {winner && (
                  <>
                    <br />
                    Campeão: <strong>{winner.title}</strong> de {winner.author} ({who(winner.userId)?.email || 'conta'}), confirmado em {day(c.winnerAt!)}
                    {c.winnerSubscription ? `, ${c.prizeDays} dias no plano` : ', sem assinatura (dias só na chave)'}
                    {c.winnerKeys ? ` e em ${c.winnerKeys} ${c.winnerKeys === 1 ? 'chave' : 'chaves'}` : ''}.
                  </>
                )}
              </p>
              {c.entries.length === 0 ? (
                <p className="sx-admin-empty">Nenhum projeto enviado.</p>
              ) : (
                <div className="sx-admin-table">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Projeto</th>
                        <th>Quem enviou</th>
                        <th>Votos</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.entries.map((e, i) => {
                        const u = who(e.userId)
                        return (
                          <tr key={e.id} style={e.hidden ? { opacity: 0.55 } : undefined}>
                            <td>{e.hidden ? '–' : e.id === c.winner ? <Crown size={15} /> : i + 1}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                {e.cover && <img src={e.cover} alt="" width={72} height={40} style={{ objectFit: 'cover', borderRadius: 8, flex: 'none' }} />}
                                <div>
                                  <strong>{e.title}</strong>
                                  {e.hidden && <small style={{ display: 'block', color: 'var(--danger, #b42318)' }}>Removido do rank</small>}
                                  <small style={{ display: 'block', maxWidth: 420, whiteSpace: 'normal' }}>{e.description}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{e.author}</strong>
                              <small style={{ display: 'block' }}>{u?.email || e.userId.slice(0, 8)}</small>
                            </td>
                            <td>
                              <strong>{e.votes}</strong>
                            </td>
                            <td>
                              <div className="sx-actions">
                                <a className="sx-btn" href={e.link} target="_blank" rel="noopener noreferrer nofollow">
                                  <ExternalLink size={14} /> Abrir
                                </a>
                                {!c.winner && (
                                  <button
                                    type="button"
                                    className="sx-btn"
                                    disabled={busy === e.id}
                                    onClick={() => void run(e.id, { action: 'rank-hide', id: e.id, hidden: !e.hidden }, e.hidden ? 'Projeto voltou para o rank.' : 'Projeto removido do rank.')}
                                  >
                                    {e.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {e.hidden ? 'Devolver' : 'Remover'}
                                  </button>
                                )}
                                {c.phase === 'counting' && !e.hidden && (
                                  <button
                                    type="button"
                                    className="sx-btn is-primary"
                                    disabled={Boolean(busy)}
                                    onClick={() => {
                                      if (!window.confirm(`Confirmar "${e.title}" (${e.author}) como campeão de ${monthLabel(c.startsAt)}?\n\n${c.prizeDays} dias grátis entram agora no plano e na chave dessa conta. Não dá para desfazer por aqui.`)) return
                                      void run(e.id, { action: 'rank-winner', challenge_id: c.id, entry_id: e.id }, `Campeão confirmado: ${e.title}. Os ${c.prizeDays} dias já entraram.`)
                                    }}
                                  >
                                    <Crown size={14} /> Confirmar campeão
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )
        })
      )}
    </>
  )
}
