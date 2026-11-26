/** O dia escolhido continua visível, a partir de 00:00 UTC. */
export function errorVisibleSince(createdAt: unknown, since: string): boolean {
  if (!since) return true
  const cutoff = Date.parse(`${since}T00:00:00Z`)
  const timestamp = Date.parse(String(createdAt || ''))
  // Data inválida não deve ocultar evidências silenciosamente.
  return !Number.isFinite(cutoff) || !Number.isFinite(timestamp) || timestamp >= cutoff
}