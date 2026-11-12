/**
 * Sessão do aparelho para a administração (verificação em duas etapas por e-mail).
 * Depois do código certo, o servidor devolve uma sessão assinada que vale 30 dias neste aparelho.
 */
const KEY = 'sixtysix_admin_session'

export function adminSession() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function saveAdminSession(value: string) {
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* navegador sem armazenamento: o código é pedido de novo na próxima vez */
  }
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada a limpar */
  }
}

/** Cabeçalhos de toda chamada ao /api/management: login do site e sessão do aparelho. */
export function adminHeaders(token: string): Record<string, string> {
  const session = adminSession()
  return { Authorization: `Bearer ${token}`, ...(session ? { 'x-admin-session': session } : {}) }
}

/** O servidor pediu o código do e-mail (sessão do aparelho ausente, vencida ou de outra conta). */
export class AdminCodeRequired extends Error {}
