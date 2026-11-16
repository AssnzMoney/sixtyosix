import { useEffect, useRef, useState } from 'react'
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react'
import { billingRequest } from '../lib/billing'
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

const SUGGESTIONS = [
  'Crie uma landing page em React com Tailwind',
  'Explique este erro e como corrigir',
  'Monte um script em Python para organizar planilhas',
]

const time = (at: number) => new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Ponto decorativo entre o nome e a hora; aria-hidden para o leitor de tela ler "Opus 5.5 09:38". */
const Dot = () => <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-current opacity-40" />

export default function SiteChat({ models: all }: { models: string[] }) {
  const models = all.filter(isChatModel)
  const [selected, setSelected] = useState(models[0] || 'gpt-6-astra')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const labels: Record<string, string> = Object.fromEntries(models.map((m) => [m, modelLabel(m)]))
  const current = models.includes(selected) ? selected : models[0]

  // Cada mensagem nova (ou o "digitando") rola o histórico até o fim.
  useEffect(() => {
    const el = historyRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, busy])

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    const next: ChatMessage[] = [...messages.slice(-19), { role: 'user', content: text.trim(), at: Date.now() }]
    setMessages(next)
    setText('')
    try {
      const result = await billingRequest<{ reply: string }>('chat', {
        model: current,
        messages: next.map(({ role, content }) => ({ role, content })),
      })
      setMessages([...next, { role: 'assistant', content: result.reply, at: Date.now(), model: current }])
    } catch (err) {
      // A mensagem volta para a caixa, para a pessoa tentar de novo sem redigitar.
      setMessages(messages)
      setText(next[next.length - 1].content)
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
        <>
          <div className="six-chat-tools">
            <select aria-label="Modelo da conversa" value={current} onChange={(e) => setSelected(e.target.value)} disabled={busy}>
              {models.map((m) => (
                <option key={m} value={m}>{labels[m] || m}</option>
              ))}
            </select>
            <button type="button" className="six-secondary six-chat-reset" disabled={busy || !messages.length} onClick={() => { setMessages([]); setError('') }}>
              <RotateCcw size={14} aria-hidden="true" /> Nova conversa
            </button>
          </div>

          <div ref={historyRef} className="six-chat-history" aria-live="polite">
            {!messages.length && !busy ? (
              <div className="six-chat-empty">
                <span className="six-chat-empty-icon"><Sparkles size={20} aria-hidden="true" /></span>
                <strong>Sua próxima ideia começa aqui.</strong>
                <p>O histórico fica nesta tela enquanto ela estiver aberta.</p>
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
                          {labels[m.model || current] || m.model || current}
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
        </>
      )}
    </section>
  )
}
