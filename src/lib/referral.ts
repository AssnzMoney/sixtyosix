// Link de afiliado: www.sixtysix.online/convite/CODIGO (o antigo ?ref=CODIGO leva para lá). O código fica
// guardado no navegador por 30 dias (vale o primeiro link) e, quando a pessoa entra na conta, o site pede ao
// servidor para ligar a conta ao afiliado. O servidor só liga quem ainda não é cliente e ainda não foi indicado.
const KEY = 'six-ref'
const DAYS = 30
export const REFERRAL_CODE = /^[a-z0-9][a-z0-9-]{2,29}$/
const CODE = REFERRAL_CODE
/** Código do link antigo (?ref=CODIGO), se for válido. */
export const referralFromSearch = (search: string) => {
  const code = new URLSearchParams(search).get('ref')?.trim().toLowerCase() || ''
  return CODE.test(code) ? code : null
}

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
  const code = referralFromSearch(search)
  if (!code || read()) return
  try { localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() })) } catch { /* navegador sem armazenamento */ }
}

/** Código guardado do link de convite (para preencher o campo no checkout). */
export const storedReferral = () => read()?.code || ''

/**
 * Código digitado no checkout: liga a conta ao afiliado antes do pagamento.
 * Devolve o resultado do servidor: ok, already, customer (já era cliente), self ou unknown.
 */
export async function applyReferralCode(token: string, code: string): Promise<string> {
  const value = code.trim().toLowerCase()
  if (!CODE.test(value)) return 'unknown'
  const response = await fetch('/api/account/referral', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: value }),
  })
  if (response.status === 400) return 'unknown'
  if (!response.ok) throw new Error('Não foi possível conferir o código de indicação. Tente de novo.')
  const { result } = (await response.json()) as { result: string }
  try { localStorage.removeItem(KEY) } catch { /* ignora */ }
  return result
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
