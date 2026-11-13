/**
 * Nomes e sugestões dos modelos do Roteador (aba "Roteador" do /admin).
 * Os modelos vendidos ficam no banco (router_models); aqui só há nomes bonitos para as telas
 * e a sugestão de apelido quando o admin importa a lista de um provedor.
 */

/** Nomes de exibição já conhecidos. Um apelido sem nome aqui aparece como está. */
export const ROUTER_MODEL_NAMES: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'gpt-6.1-sol': 'GPT-6.1 Sol',
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gpt-5.6-terra': 'GPT-5.6 Terra',
  'gpt-5.6-luna': 'GPT-5.6 Luna',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
}

/** Modelos do Pro gravados no plano (o resto vem do Roteador, pelo servidor). */
export const PRO_BASE_MODELS = ['claude-fable-5-2', 'argon-4', 'gpt-6-astra', 'glm-5']

/** Apelidos que o SixtySix já vende com outro nome: o modelo do provedor assume esse apelido. */
const KNOWN_ALIASES: Record<string, string> = { 'gemini-4-argon': 'argon-4' }

/** "anthropic/claude-opus-5-5" → "claude-opus-5-5". O cliente nunca vê o prefixo do provedor. */
export function suggestAlias(upstreamId: string): string {
  const bare = upstreamId.split('/').pop()!.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').slice(0, 80)
  return KNOWN_ALIASES[bare] || bare
}

/** Nome para as telas: o conhecido, o que o provedor mandou, ou o próprio apelido. */
export function suggestLabel(alias: string, providerName?: string): string {
  return ROUTER_MODEL_NAMES[alias] || (alias === 'argon-4' ? 'Argon 4' : providerName?.trim()) || alias
}
