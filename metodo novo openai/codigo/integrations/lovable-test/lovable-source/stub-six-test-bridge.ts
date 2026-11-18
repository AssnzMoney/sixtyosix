// Stub local de @/lib/six-test-bridge.server: mesma regra descrita no handoff
// (data ISO no futuro, no máximo 1 hora adiante).
export function expiracaoSixTestValida(expiraEm: string | undefined, agora: number): boolean {
  if (!expiraEm) return false
  const limite = Date.parse(expiraEm)
  return Number.isFinite(limite) && limite > agora && limite - agora <= 60 * 60 * 1000
}
