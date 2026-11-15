import { useState } from 'react'
import { Eye, Send, Trophy } from 'lucide-react'

type Entry = { key: string; name: string; tokens: number; requests: number; sessions: number; activeDays: number; topModel: string }
type Ranking = {
  from: string
  to: string
  days: number
  byTokens: Entry[]
  bySessions: Entry[]
  models: Array<{ model: string; requests: number; tokens: number; people: number }>
  total: { requests: number; tokens: number; people: number; sessions: number }
}

const int = (n: number) => n.toLocaleString('pt-BR')
const compact = (n: number) => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
const medal = (i: number) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`

/**
 * Ranking de uso no Discord (aba Consumo do admin). "Ver prévia" só mostra aqui; "Publicar" manda para o
 * canal do webhook DISCORD_RANK_WEBHOOK_URL. No Discord o nome sai curto (ex.: "Alisson M."), sem e-mail.
 */
export default function DiscordRankPanel({ run }: { run: <T>(body: Record<string, unknown>) => Promise<T> }) {
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState<'' | 'preview' | 'publish'>('')
  const [ranking, setRanking] = useState<Ranking | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function go(kind: 'preview' | 'publish') {
    if (kind === 'publish' && !window.confirm(`Publicar o ranking dos últimos ${days} dias no canal do Discord?`)) return
    setBusy(kind)
    setMessage(null)
    try {
      const result = await run<{ ranking: Ranking; configured: boolean }>({ action: `discord-rank-${kind}`, days })
      setRanking(result.ranking)
      setConfigured(result.configured)
      if (kind === 'publish') setMessage({ ok: true, text: 'Ranking publicado no Discord.' })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível concluir.' })
    } finally {
      setBusy('')
    }
  }

  const list = (title: string, rows: string[]) => (
    <div className="sx-discord-col">
      <h4>{title}</h4>
      {rows.length ? <ol>{rows.map((r, i) => <li key={i}>{r}</li>)}</ol> : <p className="sx-admin-hint">Ninguém usou neste período.</p>}
    </div>
  )

  return (
    <section className="sx-discord-rank">
      <header>
        <h3><Trophy size={17} /> Ranking no Discord</h3>
        <div className="sx-discord-actions">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={Boolean(busy)} aria-label="Período do ranking">
            <option value={1}>Últimas 24 horas</option>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
          </select>
          <button type="button" className="sx-btn" disabled={Boolean(busy)} onClick={() => go('preview')}>
            <Eye size={15} /> {busy === 'preview' ? 'Carregando…' : 'Ver prévia'}
          </button>
          <button type="button" className="sx-btn is-primary" disabled={Boolean(busy) || configured === false} onClick={() => go('publish')}>
            <Send size={15} /> {busy === 'publish' ? 'Publicando…' : 'Publicar no Discord'}
          </button>
        </div>
      </header>
      <p className="sx-admin-hint">
        Quem mais usou (tokens), quem mais trabalhou (sessões de trabalho: uso sem pausa maior que 30 min) e os modelos mais usados. No Discord o nome
        aparece curto, sem e-mail; contas de administrador ficam fora.
      </p>
      {configured === false && <p className="sx-admin-hint sx-admin-failure">Falta configurar DISCORD_RANK_WEBHOOK_URL no .env do servidor para publicar.</p>}
      {message && <p className={`sx-admin-hint ${message.ok ? 'sx-discord-ok' : 'sx-admin-failure'}`}>{message.text}</p>}
      {ranking && (
        <>
          <p className="sx-admin-hint">
            {int(ranking.total.people)} devs · {int(ranking.total.sessions)} sessões · {int(ranking.total.requests)} chamadas · {compact(ranking.total.tokens)} tokens
          </p>
          <div className="sx-discord-grid">
            {list('🔥 Mais tokens', ranking.byTokens.map((p, i) => `${medal(i)} ${p.name} · ${compact(p.tokens)} tokens`))}
            {list('🛠️ Mais sessões', ranking.bySessions.map((p, i) => `${medal(i)} ${p.name} · ${int(p.sessions)} sessões · ${int(p.activeDays)}d`))}
            {list('🤖 Modelos', ranking.models.map((m, i) => `${medal(i)} ${m.model} · ${int(m.requests)} chamadas`))}
          </div>
        </>
      )}
    </section>
  )
}
