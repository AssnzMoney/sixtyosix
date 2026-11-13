// Link de afiliado: www.sixtysix.online/?ref=CODIGO. O código fica guardado no navegador por 30 dias
// (vale o primeiro link) e, quando a pessoa entra na conta, o site pede ao servidor para ligar a conta
// ao afiliado. O servidor só liga quem ainda não é cliente e ainda não foi indicado por ninguém.
const KEY = 'six-ref'
const DAYS = 30
const CODE = /^[a-z0-9][a-z0-9-]{2,29}$/

type Stored = { code: string; at: number }

function read(): Stored | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as Stored | null
    if (!value || !CODE.test(value.code) || Date.now() - value.at > DAYS * 86400000) return null
    return value
  } catch {
    return null
  }
}

/** Guarda o código do link (?ref=) se ainda não houver um válido. */
export function captureReferral(search = window.location.search) {
  const code = new URLSearchParams(search).get('ref')?.trim().toLowerCase() || ''
  if (!CODE.test(code) || read()) return
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })) } catch { /* navegador sem armazenamento */ }
}

let claiming = false
/** Liga a conta logada ao afiliado do link guardado. Só tenta de novo se a falha for de rede ou do servidor. */
export async function claimReferral(token: string) {
  const stored = read()
  if (!stored || claiming) return
  claiming = true
  try {
    const response = await fetch('/api/account/referral', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: stored.code }),
    })
    // Resposta definitiva (ligou, já era indicado, já era cliente, código desconhecido ou inválido): não tenta mais.
    // Sessão recusada (401/403, ex.: e-mail ainda não confirmado) ou falha do servidor: tenta de novo depois.
    if (response.ok || response.status === 400) localStorage.removeItem(KEY)
  } catch {
    /* sem conexão: tenta de novo na próxima vez */
  } finally {
    claiming = false
  }
}
