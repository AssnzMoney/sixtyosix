/** Nome antigo: saiu do Roteador. Assinaturas e chaves que ainda o têm passam a usar o Fable 5.2. */
const FABLE_51 = 'claude-fable-5-1'
/** Fable do plano Pro. */
const FABLE_52 = 'claude-fable-5-2'
/** Argon 4 (Gemini), usado no Cline e no OpenCode. Exclusivo do plano Pro. */
export const ARGON_4 = 'argon-4'
/** Modelos gravados no plano Pro e liberados no teste grátis (billingPlans.pro em api/mercadopago.ts). */
export const PRO_BASE_MODELS = ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5'] as const

/**
 * Modelos efetivos de um plano a partir da lista gravada na assinatura.
 * O Fable só existe no Pro, então quem tem Fable (o 5.2 ou o antigo 5.1) é Pro:
 * recebe o Fable 5.2 e o Argon 4 logo depois dele e, no fim, os modelos do Roteador
 * marcados para o Pro (`proExtras`, de loadRouter).
 */
export function withPlanModels(models: readonly string[], proExtras: readonly string[] = []): string[] {
  const firstFable = models.findIndex(model => model === FABLE_51 || model === FABLE_52)
  const result = models.filter(model => model !== FABLE_51 && model !== FABLE_52 && model !== ARGON_4)
  if (firstFable < 0) return models.includes(ARGON_4) ? [...result, ARGON_4] : result
  result.splice(Math.min(firstFable, result.length), 0, FABLE_52, ARGON_4)
  for (const alias of proExtras) if (!result.includes(alias)) result.push(alias)
  return result
}
