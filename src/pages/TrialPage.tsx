import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, Clock, Copy, Eye, EyeOff, KeyRound, ShieldCheck, Turtle } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { accountRequest, accountSummary, type AccountSummary } from '../lib/account'
import './trial.css'

/**
 * Área do teste grátis: 3 horas, uma vez por conta, mais lento que os planos pagos.
 * Só ativa quando a pessoa clica (visitar a página não gasta o teste).
 */
type TrialResult = { active: boolean; revoked: boolean; expires: string; key: string | null }
const SITE = 'https://www.sixtysix.online'
const today = () => new Date().toISOString().slice(0, 10)

function remaining(expires: string, now: number) {
  const left = Math.max(0, Date.parse(expires) - now)
  const h = Math.floor(left / 3600000)
  const m = Math.floor((left % 3600000) / 60000)
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

export default function TrialPage() {
  const { session, user, loading } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AccountSummary | null>(null)
  const [trial, setTrial] = useState<TrialResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (loading) return
    sessionStorage.setItem('sixtysix_pending_trial', '1')
    sessionStorage.removeItem('sixtysix_pending_purchase')
    sessionStorage.removeItem('sixtysix_pending_subscription')
    if (!session) {
      navigate('/login?mode=cadastro', { replace: true })
      return
    }
    if (!user?.hasCompletedOnboarding) {
      navigate('/onboarding', { replace: true })
      return
    }
    sessionStorage.removeItem('sixtysix_pending_trial')
    const controller = new AbortController()
    setError('')
    accountSummary(today(), today(), controller.signal)
      .then(async (data) => {
        if (controller.signal.aborted) return
        setSummary(data)
        // Teste em andamento: busca a chave (não cria outro teste).
        if (data.trial?.active) {
          const current = await accountRequest<TrialResult>('trial', {}, controller.signal)
          if (!controller.signal.aborted) setTrial(current)
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Não foi possível consultar sua conta.')
      })
    return () => controller.abort()
  }, [loading, session?.user.id, user?.hasCompletedOnboarding, navigate])

  async function activate() {
    setBusy(true)
    setError('')
    try {
      setTrial(await accountRequest<TrialResult>('trial', {}))
      // Recarrega a conta para mostrar os modelos liberados no teste.
      setSummary(await accountSummary(today(), today()).catch(() => summary))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ativar seu teste.')
    } finally {
      setBusy(false)
    }
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setReveal(true)
      setError('Selecione e copie a chave exibida abaixo.')
    }
  }

  const paid = Boolean(summary?.subscription?.active)
  const used = summary?.trial && !summary.trial.active
  const active = trial?.active && trial.key
  const models = summary?.trial?.models || []
  const end = trial?.expires ? new Date(trial.expires).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

  return (
    <main className="six-trial-page">
      <section className="six-trial-card">
        <Link to="/" aria-label="SixtySix, início" className="six-trial-brand">
          <img src="/assets/sidebar-logo.png" alt="SixtySix" />
          <span>SixtySix</span>
        </Link>
        <span className="six-trial-pill">
          <ShieldCheck size={15} /> Teste grátis · 3 horas
        </span>

        {!summary && !error ? (
          <>
            <h1>Conferindo sua conta…</h1>
            <p role="status">Um instante.</p>
          </>
        ) : paid ? (
          <>
            <h1>Você já tem um plano ativo.</h1>
            <p>O teste grátis é para quem ainda não assinou. Use a chave do seu plano no painel.</p>
            <Link className="six-trial-primary" to="/dashboard">
              Abrir meu painel <ArrowRight size={17} />
            </Link>
          </>
        ) : active ? (
          <>
            <h1>Seu teste está rodando.</h1>
            <p>
              Faltam <strong>{remaining(trial.expires, now)}</strong> (termina em {end}). Use a chave abaixo nas ferramentas dos tutoriais.
            </p>
            <label className="six-trial-key">
              <span>
                <KeyRound size={17} /> Sua chave de teste
              </span>
              <div>
                <input aria-label="Sua chave de teste" type={reveal ? 'text' : 'password'} readOnly value={trial.key || ''} />
                <button type="button" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Ocultar chave' : 'Mostrar chave'}>
                  {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button type="button" className="six-trial-primary" onClick={() => copy(trial.key || '')}>
              {copied ? <Check size={17} /> : <Copy size={17} />} {copied ? 'Chave copiada' : 'Copiar minha chave'}
            </button>
            <dl className="six-trial-facts">
              <div>
                <dt>Claude Code</dt>
                <dd>
                  <code>{SITE}</code>
                </dd>
              </div>
              <div>
                <dt>Codex, Cline, OpenCode</dt>
                <dd>
                  <code>{SITE}/v1</code>
                </dd>
              </div>
              {models.length > 0 && (
                <div>
                  <dt>Modelos</dt>
                  <dd>{models.join(', ')}</dd>
                </div>
              )}
            </dl>
            <p className="six-trial-note">
              <Turtle size={15} aria-hidden="true" /> No teste a velocidade é reduzida: poucas chamadas por minuto e uma resposta por vez. Nos planos pagos é bem mais rápido.
            </p>
            <Link className="six-trial-secondary" to="/claude-code#passo-a-passo">
              Ver tutorial de conexão <ArrowRight size={17} />
            </Link>
          </>
        ) : used ? (
          <>
            <h1>Seu teste já foi usado.</h1>
            <p>Cada conta pode fazer o teste uma vez. Para continuar, escolha um plano: a liberação é rápida e bem mais veloz que no teste.</p>
            <Link className="six-trial-primary" to="/dashboard">
              Ver planos <ArrowRight size={17} />
            </Link>
          </>
        ) : (
          <>
            <h1>Teste a SixtySix por 3 horas.</h1>
            <p>Grátis, sem cartão. Você recebe uma chave na hora para usar no Claude Code, no Codex e nas outras ferramentas.</p>
            <ul className="six-trial-list">
              <li>
                <Clock size={15} aria-hidden="true" /> Dura 3 horas a partir de quando você ativar.
              </li>
              <li>
                <Turtle size={15} aria-hidden="true" /> Velocidade reduzida em relação aos planos pagos.
              </li>
              <li>
                <ShieldCheck size={15} aria-hidden="true" /> Uma vez por conta.
              </li>
            </ul>
            <button type="button" className="six-trial-primary" disabled={busy} onClick={() => void activate()}>
              {busy ? 'Ativando…' : 'Ativar meu teste de 3 horas'}
            </button>
            <Link className="six-trial-secondary" to="/dashboard">
              Voltar ao painel
            </Link>
          </>
        )}
        {error && (
          <p role="alert" className="six-trial-error">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
