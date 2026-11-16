import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, History, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react'
import { billingRequest } from '../lib/billing'
import { useAuth } from '../lib/AuthContext'
import { ROUTER_MODEL_NAMES } from '../lib/routerModels'
import { Bubble, BubbleContent } from '@/components/ui/c-message-3-utils/bubble'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/components/ui/c-message-3-utils/message'

/** Nome bonito do modelo: o conhecido (ponto ou hífen tanto faz) ou 'claude-opus-5-5' → 'Opus 5.5'. */
const KNOWN: Record<string, string> = { 'claude-fable-5-2': 'Fable 5.2', 'claude-fable-5-1': 'Fable 5.1', 'argon-4': 'Argon 4', 'gpt-6-astra': 'Astra 6', 'glm-5': 'GLM 5', ...ROUTER_MODEL_NAMES }
export function modelLabel(alias: string) {
  const key = alias.toLowerCase().replace(/\./g, '-')
  if (KNOWN[alias]) return KNOWN[alias]
  if (KNOWN[key]) return KNOWN[key]
  // claude-opus-5-5 → Opus 5.5 · gpt-7-nova → Gpt 7 Nova (números seguidos viram versão: 5-5 → 5.5)
  const words = key.replace(/^claude-/, '').split('-').filter(Boolean)
  const out: string[] = []
  for (const w of words) {
    const last = out[out.length - 1]
    if (/^\d+$/.test(w) && last && /^\d+(\.\d+)*$/.test(last)) out[out.length - 1] = `${last}.${w}`
    else out.push(/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))
  }
  return out.join(' ') || alias
}

/** Modelos de imagem não respondem texto: ficam fora do chat. */
const isChatModel = (alias: string) => !/image/i.test(alias)

type ChatMessage = { role: 'user' | 'assistant'; content: string; at: number; model?: string }
type Conversation = { id: string; title: string; model: string; updatedAt: number; messages: ChatMessage[] }

const SUGGESTIONS = [
  'Crie uma landing page em React com Tailwind',
  'Explique este erro e como corrigir',
  'Monte um script em Python para organizar planilhas',
]

/*
 * Histórico: fica no navegador (localStorage), separado por conta. Guarda as 30 conversas mais
 * recentes; se o navegador não tiver espaço, as mais antigas saem primeiro.
 */
const MAX_CONVERSATIONS = 30
const MAX_MESSAGES = 60
const historyKey = (userId?: string) => `six-chat-history:${userId || 'visitante'}`

function loadHistory(key: string): Conversation[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.messages) && c.messages.length) : []
  } catch {
    return []
  }
}

function saveHistory(key: string, list: Conversation[]) {
  let kept = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CONVERSATIONS)
  for (;;) {
    try {
      localStorage.setItem(key, JSON.stringify(kept))
      return
    } catch {
      if (!kept.length) return
      kept = kept.slice(0, -1)
    }
  }
}

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const titleOf = (text: string) => {
  const line = text.trim().split('\n')[0].trim()
  return line.length > 48 ? `${line.slice(0, 47)}…` : line || 'Nova conversa'
}
const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const when = (at: number) => {
  const d = new Date(at)
  return d.toDateString() === new Date().toDateString() ? time(at) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Ponto decorativo entre o nome e a hora; aria-hidden para o leitor de tela ler "Opus 5.5 09:38". */
const Dot = () => <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current opacity-40" />

export default function SiteChat({ models: all }: { models: string[] }) {
  const { session } = useAuth()
  const key = historyKey(session?.user.id)
  const models = all.filter(isChatModel)
  const [conversations, setConversations] = useState<Conversation[]>(() => loadHistory(key))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selected, setSelected] = useState(models[0] || 'gpt-6-astra')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showList, setShowList] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const labels: Record<string, string> = Object.fromEntries(models.map((m) => [m, modelLabel(m)]))
  const current = models.includes(selected) ? selected : models[0]
  const active = conversations.find((c) => c.id === activeId) || null
  const messages = active?.messages || []
  const sorted = useMemo(() => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt), [conversations])

  useEffect(() => { saveHistory(key, conversations) }, [key, conversations])

  // Cada mensagem nova (ou o "digitando") rola o histórico até o fim.
  useEffect(() => {
    const el = historyRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [activeId, messages.length, busy])

  function open(id: string | null) {
    if (busy) return
    setActiveId(id)
    setError('')
    setShowList(false)
    const conv = conversations.find((c) => c.id === id)
    if (conv && models.includes(conv.model)) setSelected(conv.model)
    if (!id) inputRef.current?.focus()
  }

  function remove(id: string) {
    if (busy) return
    setConversations((list) => list.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  function update(id: string, change: (c: Conversation) => Conversation | null) {
    setConversations((list) => list.flatMap((c) => {
      if (c.id !== id) return [c]
      const next = change(c)
      return next ? [next] : []
    }))
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    setError('')
    const userMessage: ChatMessage = { role: 'user', content, at: Date.now() }
    const id = active?.id || newId()
    const history = [...messages, userMessage]
    if (active) {
      update(id, (c) => ({ ...c, model: current, updatedAt: userMessage.at, messages: history }))
    } else {
      setConversations((list) => [{ id, title: titleOf(content), model: current, updatedAt: userMessage.at, messages: history }, ...list])
      setActiveId(id)
    }
    setText('')
    try {
      const result = await billingRequest<{ reply: string }>('chat', {
        model: current,
        messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
      })
      const reply: ChatMessage = { role: 'assistant', content: result.reply, at: Date.now(), model: current }
      update(id, (c) => ({ ...c, updatedAt: reply.at, messages: [...c.messages, reply].slice(-MAX_MESSAGES) }))
    } catch (err) {
      // A mensagem volta para a caixa, para a pessoa tentar de novo sem redigitar; conversa que ficou vazia some.
      update(id, (c) => {
        const rest = c.messages.filter((m) => m !== userMessage)
        return rest.length ? { ...c, messages: rest } : null
      })
      if (!active) setActiveId(null)
      setText(content)
      setError(err instanceof Error ? err.message : 'Não foi possível responder.')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <section className="six-panel six-site-chat">
      <div className="six-panel-head">
        <div>
          <h2>Conversar no site</h2>
          <p>Crie, programe e tire suas dúvidas.</p>
        </div>
      </div>

      {!models.length ? (
        <>
          <p>Contrate um plano ou peça seu teste grátis pelo WhatsApp para começar sua conversa.</p>
          <a href={`https://wa.me/5581992376036?text=${encodeURIComponent('Olá! Quero usar o chat da SixtySix.')}`} target="_blank" rel="noopener noreferrer" className="six-primary">
            Falar no WhatsApp
          </a>
        </>
      ) : (
        <div className="six-chat-layout">
          <aside className="six-chat-sidebar" data-open={showList}>
            <button type="button" className="six-chat-new" onClick={() => open(null)} disabled={busy}>
              <Plus size={16} aria-hidden="true" /> Nova conversa
            </button>
            <p className="six-chat-sidebar-title">Conversas</p>
            {!sorted.length ? (
              <p className="six-chat-sidebar-empty">As conversas que você começar ficam guardadas aqui.</p>
            ) : (
              <ul className="six-chat-list">
                {sorted.map((c) => (
                  <li key={c.id} data-active={c.id === activeId}>
                    <button type="button" className="six-chat-item" onClick={() => open(c.id)} disabled={busy} aria-current={c.id === activeId ? 'true' : undefined}>
                      <MessageSquare size={14} aria-hidden="true" />
                      <span className="six-chat-item-text">
                        <span className="six-chat-item-title">{c.title}</span>
                        <span className="six-chat-item-when">{when(c.updatedAt)}</span>
                      </span>
                    </button>
                    <button type="button" className="six-chat-item-delete" onClick={() => remove(c.id)} disabled={busy} aria-label={`Apagar a conversa "${c.title}"`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="six-chat-main">
            <div className="six-chat-tools">
              <button type="button" className="six-secondary six-chat-history-toggle" onClick={() => setShowList((v) => !v)} aria-expanded={showList}>
                <History size={14} aria-hidden="true" /> Conversas{sorted.length ? ` (${sorted.length})` : ''}
              </button>
              <select aria-label="Modelo da conversa" value={current} onChange={(e) => setSelected(e.target.value)} disabled={busy}>
                {models.map((m) => (
                  <option key={m} value={m}>{labels[m] || m}</option>
                ))}
              </select>
              {active && <span className="six-chat-current" title={active.title}>{active.title}</span>}
            </div>

            <div ref={historyRef} className="six-chat-history" aria-live="polite">
              {!messages.length && !busy ? (
                <div className="six-chat-empty">
                  <span className="six-chat-empty-icon"><Sparkles size={20} aria-hidden="true" /></span>
                  <strong>Sua próxima ideia começa aqui.</strong>
                  <p>Suas conversas ficam salvas neste navegador.</p>
                  <div className="six-chat-suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} type="button" onClick={() => { setText(s); inputRef.current?.focus() }}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 py-2">
                  {messages.map((m, i) =>
                    m.role === 'user' ? (
                      <Message key={i} align="end">
                        <MessageContent>
                          <Bubble>
                            <BubbleContent>{m.content}</BubbleContent>
                          </Bubble>
                          <MessageFooter className="gap-1.5">
                            <span>Enviada</span>
                            <Dot />
                            <span className="tabular-nums">{time(m.at)}</span>
                          </MessageFooter>
                        </MessageContent>
                      </Message>
                    ) : (
                      <Message key={i}>
                        <MessageContent>
                          <MessageHeader className="gap-1.5">
                            {labels[m.model || current] || modelLabel(m.model || current)}
                            <Dot />
                            <span className="tabular-nums">{time(m.at)}</span>
                          </MessageHeader>
                          <Bubble variant="muted">
                            <BubbleContent className="six-chat-answer">{m.content}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    ),
                  )}
                  {busy && (
                    <Message>
                      <MessageContent>
                        <MessageHeader>{labels[current] || current}</MessageHeader>
                        <Bubble variant="muted">
                          <BubbleContent className="six-chat-typing" role="status" aria-label="Preparando resposta">
                            <span /><span /><span />
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                </div>
              )}
            </div>

            {error && <p role="alert" className="six-chat-error">{error}</p>}

            <form onSubmit={send} className="six-chat-composer">
              <textarea
                ref={inputRef}
                aria-label="Sua mensagem"
                placeholder="Descreva o que você quer criar…"
                maxLength={12000}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={busy}
              />
              <button type="submit" className="six-chat-send" disabled={busy || !text.trim()} aria-label="Enviar mensagem">
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <small>Enter envia · Shift + Enter quebra a linha</small>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
