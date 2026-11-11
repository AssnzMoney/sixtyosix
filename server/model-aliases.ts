const FABLE_51 = 'claude-fable-5-1'
/** Saiu do catálogo: é removido até de assinaturas antigas que o tenham gravado. */
const FABLE_52 = 'claude-fable-5-2'
/** Argon 4 (Gemini), usado no Cline e no OpenCode. Exclusivo do plano Pro. */
export const ARGON_4 = 'argon-4'

/**
 * Modelos efetivos de um plano a partir da lista gravada na assinatura.
 * O Fable só existe no Pro, então quem tem Fable (5.1 ou o antigo 5.2) é Pro:
 * recebe o Fable 5.1 e o Argon 4 logo depois dele. O Fable 5.2 nunca é devolvido.
 */
export function withPlanModels(models: readonly string[]): string[] {
  const firstFable = models.findIndex(model => model === FABLE_51 || model === FABLE_52)
  const result = models.filter(model => model !== FABLE_51 && model !== FABLE_52 && model !== ARGON_4)
  if (firstFable < 0) return models.includes(ARGON_4) ? [...result, ARGON_4] : result
  result.splice(Math.min(firstFable, result.length), 0, FABLE_51, ARGON_4)
  return result
}
