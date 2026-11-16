import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, Crown, ImagePlus, PencilLine, Sparkles, ThumbsUp, Trophy, X } from 'lucide-react'
import { LeaderboardPodium } from '@/components/ui/leaderboard-podium'
import { UpvoteButton } from '@/components/ui/upvote-button'
import { accountRequest } from '../lib/account'
import { isLocalhost } from '../lib/isLocalhost'
import './rank-panel.css'

export type RankPhase = 'upcoming' | 'submissions' | 'voting' | 'counting' | 'finished'
export type RankEntry = { id: string; title: string; description: string; link: string; cover: string | null; author: string; votes: number; mine: boolean; voted: boolean; created: string }
export type RankChampion = { month: string; theme: string; prizeDays: number; title: string; author: string; link: string; cover: string | null; votes: number; description: string }
export type RankState = {
  challenge: { id: string; title: string; description: string; prizeDays: number; prizeText: string; startsAt: string; submitUntil: string; closesAt: string; phase: RankPhase; winner: string | null; totalVotes: number } | null
  entries: RankEntry[]
  mine: (RankEntry & { hidden: boolean; coverPath: string | null }) | null
  myVote: string | null
  eligible: boolean
  champions: RankChampion[]
}

const TZ = 'America/Sao_Paulo'
const PHASES: Record<RankPhase, string> = { upcoming: 'Começa em breve', submissions: 'Envios abertos', voting: 'Votação aberta', counting: 'Apurando o campeão', finished: 'Campeão definido' }
const monthName = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', timeZone: TZ })
const monthYear = (iso: string) => {
  const d = new Date(iso)
  const m = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: TZ })
  return `${m[0].toUpperCase()}${m.slice(1)} de ${d.toLocaleDateString('pt-BR', { year: 'numeric', timeZone: TZ })}`
}
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
/** Contagem regressiva do prazo atual (dias, horas, minutos e segundos), com os números deslizando. */
function Countdown({ to, label }: { to: string; label: string }) {
  const reduce = useReducedMotion()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const ms = Math.max(0, Date.parse(to) - now)
  const parts: [number, string][] = [
    [Math.floor(ms / 86400000), 'dias'],
    [Math.floor(ms / 3600000) % 24, 'horas'],
    [Math.floor(ms / 60000) % 60, 'min'],
    [Math.floor(ms / 1000) % 60, 'seg'],
  ]
  return (
    <div className="six-rank-countdown" role="timer" aria-label={`${label}: ${parts.map(([v, u]) => `${v} ${u}`).join(', ')}`}>
      <span>{label}</span>
      <div aria-hidden="true">
        {parts.map(([value, unit]) => (
          <div key={unit} className="six-rank-unit">
            <b>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.i key={value} initial={reduce ? false : { y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 14, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                  {String(value).padStart(2, '0')}
                </motion.i>
              </AnimatePresence>
            </b>
            <small>{unit}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Voto aplicado na hora na tela (o servidor confirma em seguida): soma, tira e reordena o ranking. */
function applyVote(d: RankState, id: string): RankState {
  const was = d.myVote
  const next = was === id ? null : id
  const bump = (e: RankEntry) => ({ ...e, voted: e.id === next, votes: e.votes + (e.id === next ? 1 : 0) - (e.id === was ? 1 : 0) })
  const entries = d.entries.map(bump).sort((a, b) => b.votes - a.votes || Date.parse(a.created) - Date.parse(b.created))
  const total = (d.challenge?.totalVotes || 0) + (next ? 1 : 0) - (was ? 1 : 0)
  return { ...d, entries, myVote: next, mine: d.mine ? { ...d.mine, ...bump(d.mine) } : null, challenge: d.challenge ? { ...d.challenge, totalVotes: total } : null }
}

/** Corta a imagem em 16:9 e reduz para no máximo 1280×720 (WebP, ou JPG onde o navegador não gera WebP). */
async function prepareCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha uma imagem (PNG, JPG ou WebP).')
  if (file.size > 20 * 1024 * 1024) throw new Error('Imagem muito grande. Use uma de até 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Não deu para abrir essa imagem. Use PNG, JPG ou WebP.'))
      el.src = url
    })
    const ratio = 16 / 9
    const w = img.naturalWidth, h = img.naturalHeight
    const sw = w / h > ratio ? h * ratio : w
    const sh = w / h > ratio ? h : w / ratio
    const tw = Math.min(1280, Math.round(sw)), th = Math.round(tw / ratio)
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, tw, th)
    let out = canvas.toDataURL('image/webp', 0.84)
    if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.86)
    if (out.length * 0.75 > 880 * 1024) out = canvas.toDataURL('image/jpeg', 0.68)
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Prévia no computador local, sem conta: /dashboard?demo=1 (aba Rank do mês).
const DEMO: RankState = {
  challenge: { id: 'demo', title: 'Um agente que organiza a sua semana', description: 'Crie um projeto com IA que pegue a bagunça da semana (agenda, tarefas, e-mails) e devolva um plano simples. Vale site, bot, extensão ou app.\nO que conta: ideia, utilidade e capricho.', prizeDays: 30, prizeText: 'e destaque no Instagram da SixtySix', startsAt: '2026-11-01T03:00:00Z', submitUntil: new Date(Date.now() + 9 * 86400000).toISOString(), closesAt: new Date(Date.now() + 14 * 86400000).toISOString(), phase: 'submissions', winner: null, totalVotes: 23 },
  entries: [
    { id: 'a', title: 'Semana Zen', description: 'Junta Google Agenda, Notion e Gmail e monta o plano da semana em blocos de foco, com lembretes no WhatsApp.', link: 'https://exemplo.com', cover: null, author: 'Luiz S.', votes: 11, mine: false, voted: true, created: '2026-11-03T12:00:00Z' },
    { id: 'b', title: 'Planner por voz', description: 'Você fala o que precisa fazer e ele organiza por prioridade, com estimativa de tempo de cada tarefa.', link: 'https://exemplo.com', cover: null, author: 'Você', votes: 7, mine: true, voted: false, created: '2026-11-04T12:00:00Z' },
    { id: 'c', title: 'Inbox Zero Bot', description: 'Lê os e-mails, separa o que é urgente e escreve rascunhos de resposta.', link: 'https://exemplo.com', cover: null, author: 'Marina C.', votes: 5, mine: false, voted: false, created: '2026-11-05T12:00:00Z' },
  ],
  mine: null,
  myVote: 'a',
  eligible: true,
  champions: [{ month: '2026-10-01T03:00:00Z', theme: 'Landing page em uma tarde', prizeDays: 30, title: 'Café Raiz', author: 'Eric M.', link: 'https://exemplo.com', cover: null, votes: 18, description: 'Landing de cafeteria feita do zero com o Claude Code.' }],
}
DEMO.mine = { ...DEMO.entries[1], hidden: false, coverPath: null }

const EMPTY_FORM = { title: '', description: '', link: '' }

/** Aba "Rank do mês": tema do mês, projeto do cliente, ranking ao vivo e hall dos campeões. */
export default function RankPanel({ token, onPlans }: { token?: string; onPlans: () => void }) {
  const demo = !token && isLocalhost() && new URLSearchParams(window.location.search).has('demo')
  const [data, setData] = useState<RankState | null>(demo ? DEMO : null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [cover, setCover] = useState<{ path: string | null; url: string | null }>({ path: null, url: null })
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const load = () => {
      if (document.hidden) return
      accountRequest<RankState>('rank', undefined, controller.signal)
        .then((state) => {
          setData(state)
          setError('')
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível carregar o rank.')
        })
    }
    load()
    // Votos ao vivo: atualiza a cada 30 s enquanto a aba está aberta.
    const timer = setInterval(load, 30000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [token])

  if (!data)
    return (
      <section className="six-panel six-rank-loading" role={error ? 'alert' : 'status'}>
        {error || 'Carregando o rank…'}
      </section>
    )

  const ch = data.challenge
  const canSubmit = Boolean(data.eligible && ch?.phase === 'submissions')
  const canVote = Boolean(data.eligible && (ch?.phase === 'submissions' || ch?.phase === 'voting'))
  const showForm = canSubmit && !data.mine?.hidden && (editing || !data.mine)
  const prize = ch && ch.prizeDays > 0 ? `${ch.prizeDays} dias grátis no seu plano` : 'o prêmio do mês'
  const step = ch?.phase === 'submissions' ? 0 : ch?.phase === 'voting' ? 1 : ch?.phase === 'upcoming' ? -1 : 2
  const myPosition = data.mine ? data.entries.findIndex((e) => e.id === data.mine?.id) + 1 : 0

  function startEdit() {
    const mine = data?.mine
    setForm(mine ? { title: mine.title, description: mine.description, link: mine.link } : EMPTY_FORM)
    setCover({ path: mine?.coverPath || null, url: mine?.cover || null })
    setEditing(true)
    setNotice('')
    setError('')
  }

  async function pickCover(file: File | undefined) {
    if (!file) return
    setBusy('cover')
    setError('')
    try {
      const image = await prepareCover(file)
      if (demo) setCover({ path: null, url: image })
      else setCover(await accountRequest<{ path: string; url: string }>('rank-cover', { image }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.')
    } finally {
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function submit() {
    setBusy('save')
    setError('')
    try {
      if (demo) throw new Error('Prévia local: nada é salvo.')
      const state = await accountRequest<RankState>('rank-entry', { ...form, cover: cover.path })
      setData(state)
      setEditing(false)
      setNotice(data?.mine ? 'Projeto atualizado.' : 'Projeto enviado! Agora é chamar a galera para votar.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o projeto.')
    } finally {
      setBusy('')
    }
  }

  async function vote(id: string) {
    if (!data || busy) return
    const before = data
    setBusy(id)
    setError('')
    setData(applyVote(data, id))
    try {
      if (!demo) setData(await accountRequest<RankState>('rank-vote', { id }))
    } catch (e) {
      setData(before)
      setError(e instanceof Error ? e.message : 'Não foi possível registrar o voto.')
    } finally {
      setBusy('')
    }
  }

  const coverBox = (src: string | null, title: string) =>
    src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className="six-rank-cover-empty" aria-hidden="true">{title.trim()[0]?.toUpperCase() || '?'}</span>

  return (
    <div className="six-rank">
      {error && (
        <p role="alert" className="six-rank-message is-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="six-rank-message">
          {notice}
        </p>
      )}

      {ch ? (
        <section className="six-rank-hero" aria-labelledby="six-rank-theme">
          <Trophy className="six-rank-hero-art" size={170} strokeWidth={0.9} aria-hidden="true" />
          <div className="six-rank-hero-top">
            <span className="six-rank-chip">
              <Sparkles size={14} aria-hidden="true" /> Desafio de {monthName(ch.startsAt)}
            </span>
            <span className={`six-rank-phase is-${ch.phase}`}>{PHASES[ch.phase]}</span>
          </div>
          <h2 id="six-rank-theme">{ch.title}</h2>
          {ch.description && <p className="six-rank-desc">{ch.description}</p>}
          <div className="six-rank-prize">
            <Trophy size={22} aria-hidden="true" />
            <div>
              <strong>{ch.prizeDays > 0 ? `${ch.prizeDays} dias grátis no plano` : 'Prêmio do mês'}</strong>
              {ch.prizeText && <span>{ch.prizeText}</span>}
              <small>para o projeto campeão</small>
            </div>
          </div>
          <ol className="six-rank-steps">
            {[
              ['Envie seu projeto', `até ${dayMonth(ch.submitUntil)}`],
              ['Votação', `até ${dayMonth(ch.closesAt)}`],
              ['Campeão', ch.phase === 'finished' ? 'definido' : 'logo depois'],
            ].map(([title, when], i) => (
              <li key={title} className={i === step ? 'is-now' : i < step ? 'is-done' : ''}>
                <b>{title}</b>
                <span>{when}</span>
              </li>
            ))}
          </ol>
          <div className="six-rank-hero-foot">
            <span>{plural(data.entries.length, 'projeto', 'projetos')}</span>
            <span>{plural(ch.totalVotes, 'voto', 'votos')}</span>
            {(ch.phase === 'counting' || ch.phase === 'finished') && <strong>{ch.phase === 'counting' ? 'O campeão sai em breve' : 'Parabéns ao campeão!'}</strong>}
          </div>
          {ch.phase === 'submissions' && <Countdown to={ch.submitUntil} label="Envios encerram em" />}
          {ch.phase === 'voting' && <Countdown to={ch.closesAt} label="Votação encerra em" />}
          {ch.phase === 'upcoming' && <Countdown to={ch.startsAt} label="Começa em" />}
        </section>
      ) : (
        <section className="six-rank-hero is-empty">
          <Trophy className="six-rank-hero-art" size={170} strokeWidth={0.9} aria-hidden="true" />
          <span className="six-rank-chip">
            <Sparkles size={14} aria-hidden="true" /> Rank do mês
          </span>
          <h2>O primeiro desafio começa em breve.</h2>
          <p className="six-rank-desc">Todo mês sai um tema novo. Você manda seu projeto, a galera vota e o campeão ganha dias grátis no plano.</p>
        </section>
      )}

      {ch && (
        <section className="six-panel six-rank-mine" aria-labelledby="six-rank-mine-title">
          <div className="six-panel-head">
            <div>
              <h2 id="six-rank-mine-title">Seu projeto</h2>
              <p>{data.mine && !editing ? 'É assim que ele aparece no ranking.' : 'Um projeto por mês. Dá para editar até o fim dos envios.'}</p>
            </div>
            {data.mine && !data.mine.hidden && canSubmit && !editing && (
              <button type="button" className="six-secondary" onClick={startEdit}>
                <PencilLine size={16} aria-hidden="true" /> Editar
              </button>
            )}
          </div>

          {!data.eligible ? (
            <div className="six-rank-locked">
              <p>
                O rank é para assinantes. Com um plano ativo você envia seu projeto, vota nos outros e concorre a <strong>{prize}</strong>.
              </p>
              <button type="button" className="six-primary" onClick={onPlans}>
                Ver planos
              </button>
            </div>
          ) : data.mine?.hidden ? (
            <p className="six-rank-message is-error">Seu projeto deste mês foi removido pela moderação. Se acha que foi engano, fale com a gente no WhatsApp.</p>
          ) : showForm ? (
            <form
              className="six-rank-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div className="six-rank-fields">
                <label>
                  Nome do projeto
                  <input required minLength={3} maxLength={80} value={form.title} placeholder="Ex.: Semana Zen" onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label>
                  Sobre o projeto
                  <textarea required minLength={10} maxLength={1000} rows={5} value={form.description} placeholder="O que ele faz, como você fez e por que ele é útil." onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <small>{form.description.length}/1000</small>
                </label>
                <label>
                  Link do projeto
                  <input required type="url" inputMode="url" maxLength={300} value={form.link} placeholder="https://… (site, GitHub, vídeo)" onChange={(e) => setForm({ ...form, link: e.target.value })} />
                </label>
              </div>
              <div className="six-rank-cover-field">
                <span>Capa</span>
                <button
                  type="button"
                  className={`six-rank-drop${cover.url ? ' has-image' : ''}${dragging ? ' is-drag' : ''}`}
                  disabled={busy === 'cover'}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    void pickCover(e.dataTransfer.files?.[0])
                  }}
                >
                  {cover.url ? (
                    <img src={cover.url} alt="Capa do projeto" />
                  ) : (
                    <span>
                      <ImagePlus size={26} aria-hidden="true" />
                      <b>{busy === 'cover' ? 'Enviando…' : 'Escolher imagem'}</b>
                      <small>Arraste aqui ou clique. Print ou arte do projeto, fica em 16:9.</small>
                    </span>
                  )}
                </button>
                {cover.url && (
                  <button type="button" className="six-rank-remove" onClick={() => setCover({ path: null, url: null })}>
                    <X size={14} aria-hidden="true" /> Tirar capa
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pickCover(e.target.files?.[0])} />
              </div>
              <div className="six-rank-form-actions">
                <button type="submit" className="six-primary" disabled={busy === 'save' || busy === 'cover'}>
                  {busy === 'save' ? 'Enviando…' : data.mine ? 'Salvar alterações' : 'Enviar projeto'}
                </button>
                {editing && (
                  <button type="button" className="six-secondary" onClick={() => setEditing(false)}>
                    Cancelar
                  </button>
                )}
                <small>Aparece com o nome do seu perfil. Projetos fora do tema ou ofensivos são removidos.</small>
              </div>
            </form>
          ) : data.mine ? (
            <div className="six-rank-minecard">
              <div className="six-rank-cover">{coverBox(data.mine.cover, data.mine.title)}</div>
              <div>
                <h3>{data.mine.title}</h3>
                <p>{data.mine.description}</p>
                <div className="six-rank-mine-stats">
                  <span>
                    <b>#{myPosition || '–'}</b> de {data.entries.length}
                  </span>
                  <span>
                    <b>{data.mine.votes}</b> {data.mine.votes === 1 ? 'voto' : 'votos'}
                  </span>
                  <a href={data.mine.link} target="_blank" rel="noopener noreferrer nofollow ugc">
                    Abrir projeto <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <p className="six-rank-note">
              {ch.phase === 'voting'
                ? `Os envios deste mês encerraram. Você ainda pode votar nos projetos abaixo até ${dayMonth(ch.closesAt)}.`
                : ch.phase === 'upcoming'
                  ? `Os envios abrem em ${dayMonth(ch.startsAt)}.`
                  : 'Os envios deste mês encerraram. O próximo tema sai no começo do mês que vem.'}
            </p>
          )}
        </section>
      )}

      {ch && ch.phase !== 'upcoming' && (
        <section className="six-panel six-rank-board" aria-labelledby="six-rank-board-title">
          <div className="six-panel-head">
            <div>
              <h2 id="six-rank-board-title">{ch.phase === 'finished' ? 'Resultado do mês' : 'Ranking ao vivo'}</h2>
              <p>
                {canVote
                  ? 'Você tem 1 voto por mês e pode trocar até o fim da votação. Clique de novo para tirar o voto.'
                  : !data.eligible
                    ? 'Só assinantes votam. Os votos atualizam sozinhos.'
                    : 'A votação deste mês encerrou.'}
              </p>
            </div>
          </div>
          {data.entries.some((e) => e.votes > 0) && (
            <div className="six-rank-podium">
              <LeaderboardPodium
                items={data.entries.slice(0, 3).map((e, i) => ({ id: e.id, rank: (i + 1) as 1 | 2 | 3, title: e.title, subtitle: `por ${e.author}`, value: e.votes, image: e.cover }))}
                valueLabel={(v) => plural(v, 'voto', 'votos')}
              />
            </div>
          )}
          {data.entries.length === 0 ? (
            <p className="six-rank-note">Nenhum projeto ainda. {canSubmit ? 'O seu pode ser o primeiro!' : ''}</p>
          ) : (
            <ol className="six-rank-grid">
              {data.entries.map((e, i) => {
                const winner = ch.winner === e.id
                return (
                  <motion.li layout transition={{ type: 'spring', stiffness: 360, damping: 34 }} key={e.id} className={`six-rank-card${e.voted ? ' is-voted' : ''}${winner ? ' is-winner' : ''}`}>
                    <div className="six-rank-cover">
                      {coverBox(e.cover, e.title)}
                      <span className={`six-rank-pos pos-${i + 1}`}>
                        {winner ? (
                          <>
                            <Crown size={13} aria-hidden="true" /> Campeão
                          </>
                        ) : (
                          `#${i + 1}`
                        )}
                      </span>
                    </div>
                    <div className="six-rank-body">
                      <h3>{e.title}</h3>
                      <span className="six-rank-author">
                        por {e.author}
                        {e.mine && <em>Seu projeto</em>}
                      </span>
                      <p>{e.description}</p>
                    </div>
                    <div className="six-rank-foot">
                      <a href={e.link} target="_blank" rel="noopener noreferrer nofollow ugc">
                        Abrir projeto <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                      <UpvoteButton
                        count={e.votes}
                        voted={e.voted}
                        disabled={!canVote || e.mine || Boolean(busy)}
                        ariaLabel={`${e.voted ? 'Tirar voto de' : 'Votar em'} ${e.title}, ${plural(e.votes, 'voto', 'votos')}`}
                        title={e.mine ? 'Não vale votar no próprio projeto' : !data.eligible ? 'Só assinantes votam' : undefined}
                        onToggle={() => void vote(e.id)}
                      />
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          )}
        </section>
      )}

      <section className="six-panel six-rank-hall" aria-labelledby="six-rank-hall-title">
        <div className="six-panel-head">
          <div>
            <h2 id="six-rank-hall-title">
              <Crown size={18} aria-hidden="true" /> Hall dos campeões
            </h2>
            <p>Os projetos que venceram cada mês.</p>
          </div>
        </div>
        {data.champions.length === 0 ? (
          <p className="six-rank-note">O primeiro campeão aparece aqui no fim do mês. Pode ser você.</p>
        ) : (
          <ul className="six-rank-grid">
            {data.champions.map((c) => (
              <li key={c.month} className="six-rank-card is-champion">
                <div className="six-rank-cover">
                  {coverBox(c.cover, c.title)}
                  <span className="six-rank-pos pos-1">
                    <Crown size={13} aria-hidden="true" /> {monthYear(c.month)}
                  </span>
                </div>
                <div className="six-rank-body">
                  <small className="six-rank-theme">Tema: {c.theme}</small>
                  <h3>{c.title}</h3>
                  <span className="six-rank-author">por {c.author}</span>
                  <p>{c.description}</p>
                </div>
                <div className="six-rank-foot">
                  <a href={c.link} target="_blank" rel="noopener noreferrer nofollow ugc">
                    Abrir projeto <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                  <span className="six-rank-votes">
                    <ThumbsUp size={14} aria-hidden="true" /> {plural(c.votes, 'voto', 'votos')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
