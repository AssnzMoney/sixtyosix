const FABLE_51 = 'claude-fable-5-1'
const FABLE_52 = 'claude-fable-5-2'

/** Keep both customer-facing Fable choices attached to the existing Fable entitlement. */
export function withFableVariants(models: readonly string[]): string[] {
  const result = [...models]
  const firstFable = result.findIndex(model => model === FABLE_51 || model === FABLE_52)
  if (firstFable < 0) return result

  const withoutFable = result.filter(model => model !== FABLE_51 && model !== FABLE_52)
  withoutFable.splice(Math.min(firstFable, withoutFable.length), 0, FABLE_51, FABLE_52)
  return withoutFable
}
