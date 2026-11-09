/**
 * Verifica se o usuário está acessando em ambiente local (localhost / 127.0.0.1)
 * ou se possui bypass de teste de desenvolvimento.
 */
export const isLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  const search = window.location.search

  // Ambiente estritamente local (localhost e rede local interna)
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.')
  ) {
    return true
  }

  // Bypass para desenvolvedores caso queiram testar em produção via ?preview=local ou ?dev=true
  if (search.includes('preview=local') || search.includes('dev=true')) {
    return true
  }

  return false
}

