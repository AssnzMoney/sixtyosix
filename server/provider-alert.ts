/**
 * Alerta de queda do fornecedor, por e-mail para a administração.
 *
 * Em 16/11 o fornecedor recusou a key mestra ("Token inválido") por umas 6 horas, em duas janelas, e ninguém foi
 * avisado. Cada resposta final do fornecedor (depois das novas tentativas do gateway) passa por aqui:
 * - "auth": key mestra recusada (401, 402 = sem saldo, 403). 5 em 5 minutos já avisam.
 * - "down": falha do fornecedor (5xx, inclusive 504 nosso). 15 em 5 minutos e pelo menos 40% das chamadas.
 * Depois do aviso, quando a janela volta a ter só respostas boas, vai um e-mail de "voltou".
 * No máximo um aviso de cada tipo a cada 30 minutos; a chave de idempotência do Resend evita que os dois processos
 * da VPS mandem o mesmo aviso duas vezes. Nunca lança erro nem atrasa a resposta ao cliente.
 */
import { emailConfig, sendEmail, type EmailMessage } from './email.js'

export type AlertKind = 'auth' | 'down'
type Outcome = { at: number; kind: AlertKind | 'ok' | 'other'; status: number }
type Send = (subject: string, text: string, idempotencyKey: string) => Promise<void>

const WINDOW_MS = 5 * 60_000
const COOLDOWN_MS = 30 * 60_000
const AUTH_MIN = 5
const DOWN_MIN = 15
const DOWN_RATE = 0.4
const RECOVERY_OK_MIN = 10

export const DEFAULT_ADMIN_EMAILS = 'alissonmedeiroz007@gmail.com,alysontrx@gmail.com'

export function outcomeKind(status: number): Outcome['kind'] {
  if (status >= 200 && status < 300) return 'ok'
  if (status === 401 || status === 402 || status === 403) return 'auth'
  if (status >= 500) return 'down'
  return 'other'
}

const brTime = (at: number) => new Date(at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function createProviderAlert(send: Send, now: () => number = Date.now) {
  const recent = new Map<string, Outcome[]>()
  const alerted = new Map<string, number>() // `${provider}:${kind}` → quando avisou
  const lastSent = new Map<string, number>()

  function notify(subject: string, text: string, key: string) {
    send(subject, text, key).catch((error) => console.error('Alerta do fornecedor: não foi possível enviar o e-mail', error))
  }

  return {
    record(provider: string, status: number) {
      try {
        const at = now()
        const kind = outcomeKind(status)
        const list = (recent.get(provider) || []).filter((o) => at - o.at < WINDOW_MS)
        list.push({ at, kind, status })
        recent.set(provider, list)

        const count = (k: Outcome['kind']) => list.filter((o) => o.kind === k).length
        const total = list.length
        const codes = (k: AlertKind) => {
          const by: Record<number, number> = {}
          for (const o of list) if (o.kind === k) by[o.status] = (by[o.status] || 0) + 1
          return Object.entries(by).map(([code, n]) => `${n}× ${code}`).join(', ')
        }

        for (const k of ['auth', 'down'] as AlertKind[]) {
          const id = `${provider}:${k}`
          const failures = count(k)
          const tripped = k === 'auth' ? failures >= AUTH_MIN : failures >= DOWN_MIN && failures / total >= DOWN_RATE
          if (tripped && !alerted.has(id) && at - (lastSent.get(id) || 0) >= COOLDOWN_MS) {
            alerted.set(id, at)
            lastSent.set(id, at)
            const bucket = Math.floor(at / COOLDOWN_MS)
            const subject = k === 'auth'
              ? `⚠️ Fornecedor ${provider} recusando a key mestra`
              : `⚠️ Fornecedor ${provider} instável`
            const text = [
              k === 'auth'
                ? `O fornecedor ${provider} está recusando a key mestra do Roteador (${codes(k)} nos últimos 5 minutos).`
                : `O fornecedor ${provider} está falhando: ${failures} de ${total} chamadas nos últimos 5 minutos (${codes(k)}), mesmo depois das novas tentativas.`,
              k === 'auth'
                ? 'Os clientes recebem "temporariamente indisponível". Confira o saldo e a key no painel do fornecedor e, se trocar a key, atualize no admin (Roteador).'
                : 'Os clientes recebem "temporariamente indisponível". Se continuar, fale com o fornecedor.',
              `Desde: ${brTime(at)}. Você recebe outro e-mail quando normalizar.`,
            ].join('\n\n')
            notify(subject, text, `provider-alert:${id}:${bucket}`)
          } else if (alerted.has(id) && failures === 0 && count('ok') >= RECOVERY_OK_MIN) {
            const since = alerted.get(id)!
            alerted.delete(id)
            const minutes = Math.max(1, Math.round((at - since) / 60_000))
            notify(
              `✅ Fornecedor ${provider} voltou`,
              `As chamadas para ${provider} voltaram a funcionar (${count('ok')} respostas boas seguidas nos últimos minutos). O problema durou cerca de ${minutes} min, desde ${brTime(since)}.`,
              `provider-recovered:${id}:${since}`,
            )
          }
        }
      } catch (error) {
        console.error('Alerta do fornecedor: falha ao registrar', error)
      }
    },
  }
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Alerta real: e-mail pelo Resend para SIXTYSIX_ADMIN_EMAILS. Sem RESEND_API_KEY, só vai para o log. */
export function providerAlertFromEnv(env: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  return createProviderAlert(async (subject, text, idempotencyKey) => {
    console.error('Alerta do fornecedor:', subject)
    const config = emailConfig(env)
    if (!config) return
    const to = (env.SIXTYSIX_ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS).split(',').map((x) => x.trim()).filter(Boolean)
    const html = text.split('\n\n').map((p) => `<p style="font:15px/1.6 Arial,sans-serif;color:#1f4647">${escape(p)}</p>`).join('')
    await Promise.all(to.map((address) => {
      const message: EmailMessage = { to: address, subject, text, html }
      return sendEmail(config, message, request, `${idempotencyKey}:${address}`)
    }))
  })
}
