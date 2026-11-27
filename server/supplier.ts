/**
 * Repasse para provedores do Roteador (server/router.ts): monta a URL, troca o apelido pelo
 * modelo do provedor, conta os tokens da resposta e grava o consumo em gateway_usage,
 * a mesma tabela do consumo das chaves — então tudo aparece no admin e no painel do cliente.
 */

import { randomBytes } from 'node:crypto'

type Env = Record<string, string | undefined>
export type Usage = { input: number; output: number }
export type UsageRow = { client_id: string; requested_alias: string; status_code: number; input_tokens: number; output_tokens: number; latency_ms: number }

/** Junta a URL do fornecedor com o caminho pedido sem duplicar o /v1. */
export function supplierUrl(base: string, path: string, search = ''): string {
  const target = new URL(base)
  const baseSegs = target.pathname.split('/').filter(Boolean)
  let pathSegs = path.split('/').filter(Boolean)
  for (let n = Math.min(baseSegs.length, pathSegs.length); n > 0; n--) {
    if (baseSegs.slice(-n).join('/') === pathSegs.slice(0, n).join('/')) { pathSegs = pathSegs.slice(n); break }
  }
  target.pathname = '/' + [...baseSegs, ...pathSegs].join('/')
  target.search = search
  return target.toString()
}

/**
 * Troca o apelido pelo id do fornecedor. Em streams do chat da OpenAI pede o consumo no
 * último evento (include_usage); esse evento extra é retirado antes de chegar ao cliente.
 */
/*
 * Recursos que um modelo do fornecedor recusa. O Claude Code manda recursos novos achando que fala com a Anthropic:
 * nível de esforço (output_config.effort), saída em JSON do ultracode (output_config.format), betas novos no
 * cabeçalho anthropic-beta (advisor-tool, inline-tools...), ferramentas do servidor, thinking "disabled". O fornecedor
 * responde 400 e o gateway tira só o recurso recusado, tenta de novo e lembra para as próximas chamadas daquele modelo.
 * Só o que está nas listas abaixo pode ser tirado; qualquer outro 400 vai para o cliente.
 *
 * Chaves lembradas: um caminho do corpo ("output_config.effort"), "beta:<nome>", "tool:<tipo>",
 * "tools.*.<campo>" (campo de cada ferramenta) e "thinking.disabled" (só o thinking desligado).
 */
const STRIPPABLE = ['output_config.effort', 'output_config.format', 'output_config', 'output_format', 'reasoning_effort', 'reasoning.effort', 'context_management', 'speed', 'inference_geo', 'service_tier', 'safeguards', 'thinking.disabled', 'thinking.between_tools']
const TOOL_FIELDS = ['defer_loading', 'eager_input_streaming', 'strict', 'input_examples', 'allowed_callers']
/*
 * Campos opcionais do formato chat que o fornecedor não aceita quando converte o chat para o formato nativo dele
 * ("Parâmetro não suportado nesta conversão: store. Use /v1/responses nativo."). O omp, o Cline e o OpenCode mandam
 * alguns deles. Lembrados como "chat:<campo>": saem só dos pedidos de chat; o Codex (/v1/responses) segue mandando.
 */
const CHAT_CONVERSION_FIELDS = ['store', 'parallel_tool_calls', 'metadata', 'user', 'prediction', 'logit_bias', 'logprobs', 'top_logprobs', 'seed', 'prompt_cache_key', 'safety_identifier', 'service_tier']
const unsupported = new Map<string, Set<string>>()

/*
 * Campo extra dentro do thinking ("thinking.adaptive.block_binding: Extra inputs are not permitted", Claude Code 2.1.325).
 * Lembrado como "thinking.<campo>": sai só o campo, o thinking continua. O "type" nunca sai.
 */
const THINKING_FIELD = /^thinking\.(?!type$|disabled$|between_tools$)[a-z][a-z_]*$/

const allowedFix = (fix: string) =>
  STRIPPABLE.includes(fix) || THINKING_FIELD.test(fix) || /^beta:[\w.-]+$/.test(fix) || /^tool:[\w.-]+$/.test(fix) || TOOL_FIELDS.some((f) => fix === `tools.*.${f}`) ||
  CHAT_CONVERSION_FIELDS.some((f) => fix === `chat:${f}`)

/**
 * Qual recurso o fornecedor recusou neste 400 (ou null, se o erro for outro). `sent` é o corpo que foi mandado:
 * serve para achar o tipo da ferramenta quando o erro só diz "tools.3".
 */
export function unsupportedFix(status: number, text: string, sent?: Record<string, unknown>): string | null {
  if (status !== 400) return null
  let error: { param?: unknown; code?: unknown; type?: unknown; message?: unknown } | undefined
  try { error = (JSON.parse(text) as { error?: typeof error }).error } catch { /* resposta que não é JSON */ }
  const param = String(error?.param ?? '')
  if (STRIPPABLE.includes(param)) return param
  if (/reasoning_effort|unsupported_effort/i.test(`${error?.code ?? ''} ${error?.type ?? ''}`)) return 'output_config.effort'
  const message = String(error?.message ?? text)
  const beta = /anthropic-beta\W*([a-z][\w.-]*-\d{4}-\d{2}-\d{2})/i.exec(message)
  if (beta && /not supported|unsupported|unknown|invalid|not (?:allowed|available|enabled)/i.test(message)) return `beta:${beta[1]}`
  if (/thinking\.type\.disabled"? is not supported/i.test(message)) return 'thinking.disabled'
  // Modo de pensamento novo do Claude Code 2.1.323 ("between_tools") que o modelo não tem: vai sem o ajuste de pensamento.
  if (/thinking\.type\.between_tools"? is not supported/i.test(message)) return 'thinking.between_tools'
  // "thinking.adaptive.block_binding: Extra inputs are not permitted": tira só o campo novo do thinking.
  const thinkingField = /\bthinking\.(?:[a-z_]+\.)?([a-z][a-z_]*)['"`]?:?\s*(?:Extra inputs are not permitted|is not (?:supported|permitted)|unknown field)/i.exec(message)
  if (thinkingField && THINKING_FIELD.test(`thinking.${thinkingField[1].toLowerCase()}`)) return `thinking.${thinkingField[1].toLowerCase()}`
  const tool = /\btools\.(\d+)(?:\.(\w+))?/.exec(message)
  if (tool) {
    if (tool[2] && TOOL_FIELDS.includes(tool[2]) && /extra inputs|not permitted|not supported|unknown field|unexpected/i.test(message)) return `tools.*.${tool[2]}`
    const entry = Array.isArray(sent?.tools) ? (sent.tools as Record<string, unknown>[])[Number(tool[1])] : undefined
    if (entry && typeof entry.type === 'string' && entry.type !== 'custom' && /not supported|unsupported|unknown|invalid|tag|does not match|extra inputs|not permitted/i.test(message)) return `tool:${entry.type}`
  }
  // "Parâmetro não suportado nesta conversão: store." (pedido de chat que o fornecedor converte para o formato dele).
  const conversion = /n[ãa]o suportado nesta convers[ãa]o:\s*['"`]?([a-z_]+)/i.exec(message)
  if (conversion && CHAT_CONVERSION_FIELDS.includes(conversion[1].toLowerCase())) return `chat:${conversion[1].toLowerCase()}`
  // "output_config: Extra inputs are not permitted" (às vezes como "messages.1.output_config" ou "output_config.format").
  // "safeguards: Extra inputs are not permitted" ou "request.context_management não é suportado neste transporte.".
  const extra = /(?:^|[\s.'"`])(output_config|output_format|context_management|speed|inference_geo|service_tier|safeguards)(?:\.(effort|format))?['"`]?:?\s*(?:Extra inputs are not permitted|is not (?:supported|permitted)|not supported|unknown field|n[ãa]o [ée] suportado)/i.exec(message)
  if (extra) return extra[2] ? `${extra[1]}.${extra[2]}` : extra[1]
  return null
}
/** Lembra o recurso recusado para as próximas chamadas do modelo. Devolve false se ele não pode ser tirado. */
export function rememberUnsupported(supplierId: string, fix: string): boolean {
  if (!allowedFix(fix)) return false
  unsupported.set(supplierId, new Set([...(unsupported.get(supplierId) || []), fix]))
  return true
}
/** Tira do anthropic-beta os betas que o modelo recusou. */
export function supplierBetas(header: string | undefined, supplierId: string): string | undefined {
  const refused = unsupported.get(supplierId)
  if (!header || !refused) return header
  const kept = header.split(',').map((b) => b.trim()).filter((b) => b && !refused.has(`beta:${b}`))
  return kept.length ? kept.join(',') : undefined
}
function removePath(target: Record<string, unknown>, path: string) {
  const [head, ...rest] = path.split('.')
  if (!rest.length) return void delete target[head]
  const child = target[head]
  if (!child || typeof child !== 'object' || Array.isArray(child)) return
  const copy = { ...(child as Record<string, unknown>) }
  removePath(copy, rest.join('.'))
  if (Object.keys(copy).length) target[head] = copy
  else delete target[head]
}
const withoutKey = (value: unknown, key: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !(key in value)) return value
  const copy = { ...(value as Record<string, unknown>) }
  delete copy[key]
  return copy
}
function applyFix(next: Record<string, unknown>, fix: string, path: string) {
  if (fix.startsWith('beta:')) return // vai no cabeçalho (supplierBetas)
  if (fix.startsWith('chat:')) {
    if (endpointKind(path) === 'chat') delete next[fix.slice(5)]
  } else if (fix === 'thinking.disabled') {
    if ((next.thinking as { type?: unknown } | undefined)?.type === 'disabled') delete next.thinking
  } else if (fix === 'thinking.between_tools') {
    if ((next.thinking as { type?: unknown } | undefined)?.type === 'between_tools') delete next.thinking
  } else if (fix.startsWith('tool:')) {
    if (!Array.isArray(next.tools)) return
    const type = fix.slice(5)
    next.tools = (next.tools as Record<string, unknown>[]).filter((t) => t?.type !== type)
    if (!(next.tools as unknown[]).length) { delete next.tools; delete next.tool_choice }
  } else if (fix.startsWith('tools.*.')) {
    if (Array.isArray(next.tools)) next.tools = (next.tools as unknown[]).map((t) => withoutKey(t, fix.slice(8)))
  } else {
    removePath(next, fix)
    // O campo inteiro às vezes vem recusado dentro das mensagens ("messages.1.output_config").
    if (!fix.includes('.') && Array.isArray(next.messages)) next.messages = (next.messages as unknown[]).map((m) => withoutKey(m, fix))
  }
}

/** Esquema do JSON pedido (output_config.format ou output_format), para quando o fornecedor não aceita saída estruturada. */
function jsonSchemaOf(payload: Record<string, unknown>): unknown {
  const format = (payload.output_config as { format?: unknown } | undefined)?.format ?? payload.output_format
  if (!format || typeof format !== 'object') return undefined
  const f = format as { type?: unknown; schema?: unknown }
  return f.type === 'json_schema' ? (f.schema ?? {}) : undefined
}
function appendSystem(next: Record<string, unknown>, text: string) {
  const system = next.system
  if (Array.isArray(system)) next.system = [...system, { type: 'text', text }]
  else next.system = typeof system === 'string' && system.trim() ? `${system}\n\n${text}` : text
}

/**
 * Instrução fixa de identidade: o modelo se apresenta com o nome vendido (o "Nome" do Roteador),
 * nunca com o nome real do fornecedor. Fica antes das instruções do cliente e é sempre igual para
 * o mesmo modelo, então não atrapalha o cache de prompt do fornecedor.
 */
/** Fabricante da família do modelo vendido: o Claude é da Anthropic, o GPT da OpenAI, o Gemini do Google. */
export function modelMaker(name: string): string | null {
  if (/claude|fable|opus|sonnet|haiku/i.test(name)) return 'Anthropic'
  if (/\bgpt\b|gpt-|astra|codex|\bsol\b|openai/i.test(name)) return 'OpenAI'
  if (/gemini|argon/i.test(name)) return 'Google'
  return null
}

export function identityText(name: string) {
  const clean = name.replace(/[\r\n"]/g, ' ').trim().slice(0, 80)
  const maker = modelMaker(clean)
  const who = maker ? `o ${clean}, um modelo da ${maker}` : `o ${clean}`
  return `Identidade do modelo: você é ${who}. Seu nome é exatamente "${clean}": use esse nome ao se apresentar. Se perguntarem qual modelo, versão ou empresa está por trás de você, responda que é ${who}. Nunca se apresente com outro nome ou outra versão de modelo (como ChatGPT, GPT-4, GPT-5, Gemini 2.5 ou um Claude de outra versão) e não diga qual modelo ou serviço está por trás. Fora isso, siga normalmente as instruções abaixo.`
}

/**
 * Modelos reais da Anthropic (Claude) e do Google (Gemini) vão sem instrução de identidade quando vendidos
 * na própria família: respondem com sinceridade o que são. Se o modelo for vendido como de outra família
 * (ex.: Argon/Gemini vendido como Claude Opus), recebe a identidade do nome vendido.
 */
export function speaksForItself(supplierId: string, soldName?: string) {
  const maker = modelMaker(supplierId)
  if (maker !== 'Anthropic' && maker !== 'Google') return false
  const soldMaker = soldName ? modelMaker(soldName) : null
  return !soldMaker || soldMaker === maker
}

/** Para Claude e Gemini: não muda quem o modelo diz ser, só não deixa falar (nem chutar) por onde o acesso passa. */
export const DISCRETION_TEXT = 'Você não tem acesso a detalhes técnicos de como esta conversa chega até você, como plataforma, API ou endereços: se perguntarem sobre isso, diga que não tem essa informação, sem adivinhar nomes. Isso não muda o que você sabe sobre si mesmo nem as instruções a seguir, que têm prioridade.'

function prependSystem(next: Record<string, unknown>, path: string, text: string) {
  if (/\/messages\/?$/.test(path)) {
    const system = next.system
    if (Array.isArray(system)) next.system = [{ type: 'text', text }, ...system]
    else next.system = typeof system === 'string' && system.trim() ? `${text}\n\n${system}` : text
  } else if (/\/chat\/completions\/?$/.test(path) && Array.isArray(next.messages)) {
    next.messages = [{ role: 'system', content: text }, ...next.messages]
  } else if (/\/responses\/?$/.test(path)) {
    next.instructions = typeof next.instructions === 'string' && next.instructions.trim() ? `${text}\n\n${next.instructions}` : text
  }
}

/** Coloca a identidade antes das instruções do cliente, nos formatos Anthropic, OpenAI chat e OpenAI Responses. */
function withIdentity(next: Record<string, unknown>, path: string, name: string) {
  prependSystem(next, path, identityText(name))
}

/** Mensagem "system" sem conteúdo no meio da conversa (o Claude Code 2.1.323 manda): o fornecedor recusa e ela não leva nada. */
const emptySystem = (m: unknown) => {
  if (!m || typeof m !== 'object' || (m as { role?: unknown }).role !== 'system') return false
  const content = (m as { content?: unknown }).content
  return content == null || (typeof content === 'string' && !content.trim()) || (Array.isArray(content) && content.length === 0)
}

/** O fornecedor recusou a assinatura de um bloco de pensamento do histórico (ex.: o cliente trocou de modelo na conversa). */
export const thinkingSignatureError = (text: string) => /invalid\W*signature\W*in\W*thinking\W*block/i.test(text)

/**
 * Tira os blocos de pensamento antigos do histórico, para a conversa seguir quando um deles tem assinatura inválida.
 * Primeiro (`all` falso) mantém os da última resposta do assistente, que o modelo pode exigir quando ainda está usando
 * ferramentas; se ainda falhar (`all`), tira todos e manda sem o ajuste de pensamento.
 */
export function withoutThinkingHistory(body: string, all: boolean): string {
  let next: Record<string, unknown>
  try { next = JSON.parse(body) } catch { return body }
  if (!Array.isArray(next.messages)) return body
  const messages = next.messages as Record<string, unknown>[]
  let last = -1
  messages.forEach((m, i) => { if (m?.role === 'assistant') last = i })
  next.messages = messages.map((m, i) => {
    if (m?.role !== 'assistant' || !Array.isArray(m.content) || (!all && i === last)) return m
    const content = (m.content as Record<string, unknown>[]).filter((b) => b?.type !== 'thinking' && b?.type !== 'redacted_thinking')
    return { ...m, content: content.length ? content : [{ type: 'text', text: '…' }] }
  })
  if (all) delete next.thinking
  return JSON.stringify(next)
}

/*
 * Raciocínio no máximo (max/xhigh) passa do tempo que o fornecedor aguenta: atrás da Cloudflare dele, a chamada cai com
 * 100 a 125 s sem resposta (524) ou volta 502. Em 16/11 o Argon 4 e o Claude Opus 5.5 em "max" caíam assim e as
 * ferramentas ficavam repetindo sem parar. O gateway manda no máximo SIXTYSIX_MAX_EFFORT (padrão "high"; "off" desliga)
 * e põe teto no orçamento de pensamento explícito (thinking.budget_tokens, SIXTYSIX_MAX_THINKING_BUDGET, padrão 32.000).
 * Troca só a cópia que vai ao fornecedor; o pedido do cliente fica como veio.
 */
const EFFORT_ORDER = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
export function capReasoning(next: Record<string, unknown>) {
  const ceiling = (process.env.SIXTYSIX_MAX_EFFORT || 'high').toLowerCase()
  if (ceiling === 'off') return
  const limit = EFFORT_ORDER.indexOf(ceiling)
  if (limit < 0) return
  const over = (v: unknown) => typeof v === 'string' && EFFORT_ORDER.indexOf(v.toLowerCase()) > limit
  const config = next.output_config as Record<string, unknown> | undefined
  if (config && typeof config === 'object' && over(config.effort)) next.output_config = { ...config, effort: ceiling }
  if (over(next.reasoning_effort)) next.reasoning_effort = ceiling
  const reasoning = next.reasoning as Record<string, unknown> | undefined
  if (reasoning && typeof reasoning === 'object' && over(reasoning.effort)) next.reasoning = { ...reasoning, effort: ceiling }
  const thinking = next.thinking as Record<string, unknown> | undefined
  const budget = Number(process.env.SIXTYSIX_MAX_THINKING_BUDGET) || 32000
  if (thinking && typeof thinking === 'object' && typeof thinking.budget_tokens === 'number' && thinking.budget_tokens > budget) next.thinking = { ...thinking, budget_tokens: budget }
}

/** Resultado de busca "selado" do histórico recusado (veio de outro modelo, ex.: trocou de modelo depois de pesquisar). */
export const encryptedSearchError = (text: string) => /invalid\W*(encrypted_content|encrypted_index)/i.test(text)

type Block = Record<string, unknown>
const resultLine = (r: Block) => [r.title, r.url ?? (r.source as string | undefined)].filter((v) => typeof v === 'string' && v).join(' - ')
/** Um bloco de busca vira texto: o que foi pesquisado ou a lista de resultados (título e link). */
function searchAsText(block: Block): Block | null {
  if (block.type === 'server_tool_use' && (block.name === 'web_search' || block.name === 'web_fetch')) {
    const input = (block.input || {}) as Block
    return { type: 'text', text: `[${block.name === 'web_fetch' ? 'Leitura de página' : 'Pesquisa na web'}: ${String(input.query ?? input.url ?? '')}]` }
  }
  if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
    const items = Array.isArray(block.content) ? (block.content as Block[]) : block.content && typeof block.content === 'object' ? [block.content as Block] : []
    const lines = items.map(resultLine).filter(Boolean)
    return { type: 'text', text: lines.length ? `Resultados da pesquisa:\n${lines.map((l) => `- ${l}`).join('\n')}` : '[Resultado de pesquisa]' }
  }
  if (block.type === 'search_result' || block.type === 'web_search_result' || typeof block.encrypted_content === 'string') {
    const body = Array.isArray(block.content) ? (block.content as Block[]).map((c) => (typeof c.text === 'string' ? c.text : '')).filter(Boolean).join('\n') : ''
    return { type: 'text', text: [resultLine(block), body].filter(Boolean).join('\n') || '[Resultado de pesquisa]' }
  }
  return null
}
/**
 * Troca por texto os blocos de pesquisa do histórico (o pedido de busca, os resultados e as citações com índice selado),
 * para a conversa seguir quando o fornecedor recusa o conteúdo selado de um deles. O contexto (títulos e links) fica.
 */
export function withoutEncryptedSearch(body: string): string {
  let next: Record<string, unknown>
  try { next = JSON.parse(body) } catch { return body }
  if (!Array.isArray(next.messages)) return body
  const fix = (content: unknown): unknown => {
    if (!Array.isArray(content)) return content
    return (content as Block[]).map((b) => {
      if (!b || typeof b !== 'object') return b
      const text = searchAsText(b)
      if (text) return text
      if (b.type === 'tool_result' && Array.isArray(b.content)) return { ...b, content: fix(b.content) }
      if (b.type === 'text' && Array.isArray(b.citations)) { const { citations: _c, ...rest } = b; return rest }
      return b
    })
  }
  next.messages = (next.messages as Block[]).map((m) => (m && Array.isArray(m.content) ? { ...m, content: fix(m.content) } : m))
  return JSON.stringify(next)
}

/**
 * Bloco que o fornecedor não sabe traduzir para o modelo ("Tipo de bloco sem conversão validada", unsupported_content):
 * em 17/11 um cliente no Argon 4 tinha todas as chamadas recusadas assim, porque a ferramenta dele põe no histórico um
 * tipo de bloco fora do básico (texto, imagem, uso de ferramenta e resultado de ferramenta).
 */
export const unsupportedContentError = (text: string) => /unsupported_content|sem convers\S*o validada/i.test(text)

const BASIC_BLOCKS = new Set(['text', 'image', 'tool_use', 'tool_result'])
/** Um bloco fora do básico vira texto (ou some, no caso de pensamento). Devolve null para tirar o bloco. */
function blockAsText(block: Block): Block | null {
  if (block.type === 'thinking' || block.type === 'redacted_thinking') return null
  const search = searchAsText(block)
  if (search) return search
  if (block.type === 'document') {
    const source = (block.source || {}) as Block
    const body = source.type === 'text' && typeof source.data === 'string' ? source.data : ''
    return { type: 'text', text: [`[Documento${typeof block.title === 'string' ? `: ${block.title}` : ''}]`, body].filter(Boolean).join('\n').slice(0, 100000) }
  }
  if (typeof block.text === 'string') return { type: 'text', text: block.text }
  return { type: 'text', text: `[${String(block.type || 'conteúdo')}]` }
}
/**
 * Deixa só os blocos básicos no histórico: o resto vira texto (documento com o texto dele, pesquisa com título e link,
 * o nome do tipo nos outros), pensamento sai e citações saem do texto. Devolve também quais tipos foram trocados.
 */
export function basicContentOnly(body: string): { body: string; converted: string[] } {
  let next: Record<string, unknown>
  try { next = JSON.parse(body) } catch { return { body, converted: [] } }
  if (!Array.isArray(next.messages)) return { body, converted: [] }
  const converted = new Set<string>()
  const fix = (content: Block[], inside = false): Block[] => {
    const out: Block[] = []
    for (const b of content) {
      if (!b || typeof b !== 'object') continue
      const keep = inside ? b.type === 'text' || b.type === 'image' : BASIC_BLOCKS.has(String(b.type))
      if (keep) {
        if (b.type === 'tool_result' && Array.isArray(b.content)) out.push({ ...b, content: fix(b.content as Block[], true) })
        else if (b.type === 'text' && Array.isArray(b.citations)) { const { citations: _c, ...rest } = b; out.push(rest) }
        else out.push(b)
        continue
      }
      converted.add(String(b.type))
      const text = blockAsText(b)
      if (text) out.push(text)
    }
    return out
  }
  next.messages = (next.messages as Block[]).map((m) => {
    if (!m || !Array.isArray(m.content)) return m
    const content = fix(m.content as Block[])
    return { ...m, content: content.length ? content : [{ type: 'text', text: '…' }] }
  })
  return { body: JSON.stringify(next), converted: [...converted] }
}

/** Tipos de bloco no histórico (para o registro de falhas: ajuda a achar o que o fornecedor não aceita). */
export function blockTypes(payload: Record<string, unknown>): string[] {
  const types = new Set<string>()
  const walk = (content: unknown) => {
    if (!Array.isArray(content)) return
    for (const b of content as Block[]) {
      if (!b || typeof b !== 'object') continue
      types.add(String(b.type))
      if (b.type === 'tool_result') walk(b.content)
    }
  }
  for (const m of (Array.isArray(payload.messages) ? payload.messages : []) as Block[]) walk(m?.content)
  return [...types]
}

export function supplierRequestBody(payload: Record<string, unknown>, path: string, supplierId: string, name?: string) {
  const next: Record<string, unknown> = { ...payload, model: supplierId }
  capReasoning(next)
  const schema = jsonSchemaOf(payload)
  if (endpointKind(path) === 'anthropic' && Array.isArray(next.messages)) next.messages = (next.messages as unknown[]).filter((m) => !emptySystem(m))
  for (const fix of unsupported.get(supplierId) || []) applyFix(next, fix, path)
  // Saída em JSON recusada (o ultracode usa): vira instrução, para a resposta ainda vir no formato pedido.
  if (schema !== undefined && jsonSchemaOf(next) === undefined && endpointKind(path) === 'anthropic') {
    appendSystem(next, `Responda somente com um objeto JSON válido que siga exatamente este JSON Schema, sem texto antes ou depois e sem bloco de código:\n${JSON.stringify(schema).slice(0, 20000)}`)
  }
  if (name && speaksForItself(supplierId, name)) prependSystem(next, path, DISCRETION_TEXT)
  else if (name) withIdentity(next, path, name)
  // Responses: o cliente pode mandar de volta o nosso ID; o fornecedor só conhece o dele.
  if (typeof next.previous_response_id === 'string' && responseIds.has(next.previous_response_id)) next.previous_response_id = responseIds.get(next.previous_response_id)
  const options = next.stream_options && typeof next.stream_options === 'object' ? next.stream_options as Record<string, unknown> : {}
  const injectedUsage = next.stream === true && path.endsWith('/chat/completions') && options.include_usage !== true
  if (injectedUsage) next.stream_options = { ...options, include_usage: true }
  return { body: JSON.stringify(next), injectedUsage }
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Lê tokens nos formatos Anthropic (messages), OpenAI (chat e responses) e Gemini. */
export function collectUsage(value: unknown, usage: Usage) {
  if (!value || typeof value !== 'object') return
  const obj = value as Record<string, any>
  const u = obj.usage || obj.message?.usage || obj.response?.usage || obj.usageMetadata
  if (!u || typeof u !== 'object') return
  const input = num(u.prompt_tokens) ?? (u.input_tokens != null
    ? (num(u.input_tokens) ?? 0) + (num(u.cache_creation_input_tokens) ?? 0) + (num(u.cache_read_input_tokens) ?? 0)
    : num(u.promptTokenCount))
  const output = num(u.completion_tokens) ?? num(u.output_tokens) ?? num(u.candidatesTokenCount)
  // Alguns formatos repetem o total acumulado ao longo do stream: vale o maior.
  if (input != null) usage.input = Math.max(usage.input, input)
  if (output != null) usage.output = Math.max(usage.output, output)
}

/* ------------------------- Esconder o fornecedor ------------------------- */

/** Formato do endpoint chamado: decide o formato dos erros, dos IDs e dos campos que ficam. */
export type Endpoint = 'anthropic' | 'chat' | 'responses' | 'other'
export function endpointKind(path: string): Endpoint {
  if (/\/messages\/?$/.test(path)) return 'anthropic'
  if (/\/chat\/completions\/?$/.test(path)) return 'chat'
  if (/\/responses\/?$/.test(path)) return 'responses'
  return 'other'
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function randomId(size = 24) {
  const bytes = randomBytes(size)
  let out = ''
  for (const byte of bytes) out += ID_CHARS[byte % ID_CHARS.length]
  return out
}
/** ID neutro nosso, no formato de cada endpoint. */
export function neutralId(kind: Endpoint) {
  return kind === 'chat' ? `chatcmpl-${randomId()}` : kind === 'responses' ? `resp_${randomId()}` : `msg_${randomId()}`
}

/*
 * IDs do Responses: o cliente pode mandar o nosso ID de volta em previous_response_id. Guardamos
 * nosso → do fornecedor para desfazer a troca na volta (só neste processo; na VPS é um processo só).
 */
const responseIds = new Map<string, string>()
function rememberResponseId(ours: string, real: string) {
  responseIds.set(ours, real)
  if (responseIds.size > 5000) responseIds.delete(responseIds.keys().next().value as string)
}

/** Erros do fornecedor (4xx) viram erro nosso, genérico e no formato do endpoint. O original vai só para o log. */
const ERROR_TEXT: Record<number, string> = {
  400: 'Pedido inválido. Confira os parâmetros enviados.',
  404: 'Modelo ou recurso não encontrado.',
  413: 'Pedido grande demais.',
  422: 'Não foi possível processar o pedido.',
  429: 'Muitas chamadas agora. Aguarde um instante.',
  504: 'O modelo demorou demais para responder. Use streaming ou um nível de raciocínio menor e tente de novo.',
}
/*
 * Conversa maior que a memória do modelo. Escondida como "Pedido inválido", o Claude Code não percebia e não
 * resumia a conversa (/compact): toda mensagem seguinte dava o mesmo 400, para sempre. Esse erro precisa ir com o
 * texto que as ferramentas reconhecem ("prompt is too long" no Claude Code; context_length_exceeded no Codex e
 * nos SDKs da OpenAI). Só os números passam; nada do texto do fornecedor.
 */
export type ContextOverflow = { tokens?: number; maximum?: number }
export function contextOverflow(status: number, text: string): ContextOverflow | null {
  if (status !== 400 && status !== 413) return null
  if (!/prompt is too long|context[_ ]length[_ ]exceeded|maximum context length|context window|too many (input )?tokens|exceeds? the (model'?s? )?(maximum )?context/i.test(text)) return null
  const numbers = /(\d[\d,]*)\s*tokens?\s*>\s*(\d[\d,]*)/i.exec(text) || /maximum context length is (\d[\d,]*)[^\d]+(\d[\d,]*)/i.exec(text)
  if (!numbers) return {}
  const [a, b] = [numbers[1], numbers[2]].map((n) => Number(n.replace(/,/g, '')))
  // "X tokens > Y maximum" vem pedido > máximo; "maximum context length is Y ... X tokens" vem ao contrário.
  return /maximum context length is/i.test(numbers[0]) ? { tokens: b, maximum: a } : { tokens: a, maximum: b }
}
export function contextOverflowBody(kind: Endpoint, overflow: ContextOverflow) {
  const { tokens, maximum } = overflow
  if (kind === 'anthropic') {
    const message = tokens && maximum ? `prompt is too long: ${tokens} tokens > ${maximum} maximum` : 'prompt is too long'
    return { type: 'error', error: { type: 'invalid_request_error', message } }
  }
  const message = tokens && maximum
    ? `This model's maximum context length is ${maximum} tokens. However, your messages resulted in ${tokens} tokens.`
    : "This model's maximum context length was exceeded."
  return { error: { message, type: 'invalid_request_error', code: 'context_length_exceeded' } }
}

export function supplierErrorBody(kind: Endpoint, status: number) {
  const message = ERROR_TEXT[status] || 'Não foi possível concluir o pedido.'
  if (kind === 'anthropic') {
    const type = status >= 500 ? 'api_error' : status === 404 ? 'not_found_error' : status === 413 ? 'request_too_large' : status === 429 ? 'rate_limit_error' : 'invalid_request_error'
    return { type: 'error', error: { type, message } }
  }
  const type = status >= 500 ? 'api_error' : status === 429 ? 'rate_limit_error' : status === 404 ? 'not_found_error' : 'invalid_request_error'
  return { error: { message, type, code: null } }
}
const STREAM_ERROR = 'Erro ao gerar a resposta. Tente novamente.'

// Campos fora do formato oficial que entregam o fornecedor ou a infraestrutura (em qualquer formato).
const LEAKY = ['provider', 'provider_name', 'system_fingerprint', 'service_tier', 'x_groq', 'cost', 'cost_details', 'is_byok', 'native_finish_reason', 'diagnostics', 'inference_geo', 'speed', 'openrouter']
// Campos oficiais que ficam em cada formato (o resto sai).
const ANTHROPIC_MESSAGE = ['id', 'type', 'role', 'model', 'content', 'stop_reason', 'stop_sequence', 'stop_details', 'usage', 'container', 'context_management']
const ANTHROPIC_EVENT = ['type', 'index', 'message', 'content_block', 'delta', 'usage', 'error', 'context_management']
const ANTHROPIC_USAGE = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'cache_creation', 'server_tool_use']
const CHAT_TOP = ['id', 'object', 'created', 'model', 'choices', 'usage', 'error']
const CHAT_CHOICE = ['index', 'message', 'delta', 'finish_reason', 'logprobs']
const CHAT_MESSAGE = ['role', 'content', 'refusal', 'tool_calls', 'function_call', 'reasoning', 'reasoning_content', 'reasoning_details', 'annotations', 'audio']
const CHAT_USAGE = ['prompt_tokens', 'completion_tokens', 'total_tokens', 'prompt_tokens_details', 'completion_tokens_details']
const RESPONSES_USAGE = ['input_tokens', 'input_tokens_details', 'output_tokens', 'output_tokens_details', 'total_tokens']
// Objeto "response" da API Responses (Codex). Sai o que o fornecedor acrescenta: content_filters, moderation, access_programs...
const RESPONSES_OBJECT = [
  'id', 'object', 'created_at', 'completed_at', 'status', 'background', 'conversation', 'error', 'incomplete_details',
  'instructions', 'max_output_tokens', 'max_tool_calls', 'metadata', 'model', 'output', 'output_text', 'parallel_tool_calls',
  'previous_response_id', 'prompt', 'prompt_cache_key', 'prompt_cache_retention', 'reasoning', 'safety_identifier', 'store',
  'temperature', 'frequency_penalty', 'presence_penalty', 'text', 'tool_choice', 'tools', 'top_logprobs', 'top_p', 'truncation',
  'usage', 'user',
]

type Obj = Record<string, any>
const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
function keep(obj: Obj, keys: string[]) { for (const key of Object.keys(obj)) if (!keys.includes(key)) delete obj[key] }
function drop(obj: Obj, keys: string[]) { for (const key of keys) delete obj[key] }

/**
 * Repassa a resposta do fornecedor ao cliente contando os tokens no caminho e tirando o que entrega o
 * fornecedor: o modelo real, os IDs dele, campos fora do formato oficial e mensagens de erro dele.
 * Streams são tratados por evento SSE completo; respostas comuns, de uma vez no final.
 */
export class UsageTap {
  readonly usage: Usage = { input: 0, output: 0 }
  private buffer = ''
  private readonly decoder = new TextDecoder()
  private readonly opts: { stream: boolean; alias: string; supplierId: string; dropInjectedUsage: boolean; kind: Endpoint }
  /** Um ID nosso por resposta: o mesmo em todos os eventos do stream. */
  readonly id: string
  /**
   * Resposta sem stream que veio "200 OK" mas só com um erro dentro (ex.: o fornecedor desistiu por demora,
   * "upstream_idle_timeout"). O gateway troca por um 504 nosso; o erro original fica em `failure` para o log.
   */
  failure: string | null = null
  constructor(opts: { stream: boolean; alias: string; supplierId: string; dropInjectedUsage: boolean; kind?: Endpoint }) {
    this.opts = { ...opts, kind: opts.kind || 'other' }
    this.id = neutralId(this.opts.kind)
  }

  push(chunk: Uint8Array): string {
    this.buffer += this.decoder.decode(chunk, { stream: true })
    if (!this.opts.stream) return ''
    this.buffer = this.buffer.replace(/\r\n/g, '\n')
    let out = '', end: number
    while ((end = this.buffer.indexOf('\n\n')) !== -1) {
      out += this.event(this.buffer.slice(0, end))
      this.buffer = this.buffer.slice(end + 2)
    }
    return out
  }

  end(): string {
    this.buffer += this.decoder.decode()
    const rest = this.buffer
    this.buffer = ''
    if (this.opts.stream) return rest.trim() ? this.event(rest.replace(/\n+$/, '')) : ''
    let obj: unknown
    try { obj = JSON.parse(rest) } catch {
      // Texto solto (página de erro, aviso do fornecedor) num endpoint que só fala JSON: não vai ao cliente, vira o 504 nosso.
      if (this.opts.kind !== 'other') { this.failure = `resposta sem JSON: ${rest.slice(0, 300)}`; return '' }
      return this.hide(rest) /* outro endpoint (ex.: áudio): só troca o modelo */
    }
    collectUsage(obj, this.usage)
    if (isObj(obj) && isObj(obj.error) && !('choices' in obj) && !('content' in obj) && !('output' in obj)) {
      this.failure = JSON.stringify(obj.error).slice(0, 500)
    }
    if (isObj(obj)) this.clean(obj)
    return JSON.stringify(obj)
  }

  private event(text: string): string {
    const lines = text.split('\n')
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
    // Fica o "event:" e o "retry:"; sai o "id:" do fornecedor; comentários (": ...") viram um keep-alive neutro.
    const head = lines
      .filter(line => !line.startsWith('data:'))
      .map(line => (line.startsWith(':') ? ': keep-alive' : line))
      .filter(line => line.startsWith('event:') || line.startsWith('retry:') || line === ': keep-alive')
    if (!data) return head.length ? `${head.join('\n')}\n\n` : ''
    if (data === '[DONE]') return `${[...head, 'data: [DONE]'].join('\n')}\n\n`
    let obj: unknown
    try { obj = JSON.parse(data) } catch {
      // Nos formatos Anthropic e OpenAI todo evento é JSON: texto solto do fornecedor não vai ao cliente.
      if (this.opts.kind !== 'other') return head.length ? `${head.join('\n')}\n\n` : ''
      return this.hide(text) + '\n\n'
    }
    collectUsage(obj, this.usage)
    if (isObj(obj)) {
      if (this.opts.dropInjectedUsage && Array.isArray(obj.choices) && !obj.choices.length && obj.usage) return ''
      this.clean(obj)
    }
    return `${[...head, `data: ${JSON.stringify(obj)}`].join('\n')}\n\n`
  }

  /** Limpa um objeto da resposta (corpo inteiro ou um evento do stream), no formato do endpoint. */
  private clean(obj: Obj) {
    const { alias, kind } = this.opts
    drop(obj, LEAKY)
    if (kind === 'anthropic') {
      if (obj.type === 'error' && isObj(obj.error)) obj.error.message = STREAM_ERROR
      const message = obj.type === 'message' ? obj : isObj(obj.message) ? obj.message : null
      if (message) {
        keep(message, ANTHROPIC_MESSAGE)
        message.id = this.id
        if ('model' in message) message.model = alias
        if (isObj(message.usage)) keep(message.usage, ANTHROPIC_USAGE)
      }
      if (message !== obj) keep(obj, ANTHROPIC_EVENT)
      if (isObj(obj.usage)) keep(obj.usage, ANTHROPIC_USAGE)
      if (obj.type === 'message_delta' && isObj(obj.delta)) keep(obj.delta, ['stop_reason', 'stop_sequence', 'stop_details'])
      return
    }
    if (kind === 'chat') {
      keep(obj, CHAT_TOP)
      if ('id' in obj) obj.id = this.id
      if ('model' in obj) obj.model = alias
      if (Array.isArray(obj.choices)) for (const choice of obj.choices) {
        if (!isObj(choice)) continue
        keep(choice, CHAT_CHOICE)
        for (const part of [choice.message, choice.delta]) if (isObj(part)) keep(part, CHAT_MESSAGE)
      }
      if (isObj(obj.usage)) keep(obj.usage, CHAT_USAGE)
      if (isObj(obj.error)) obj.error = { message: STREAM_ERROR, type: 'api_error', code: null }
      return
    }
    if (kind === 'responses') {
      const response = obj.object === 'response' ? obj : isObj(obj.response) ? obj.response : null
      if (response) {
        keep(response, RESPONSES_OBJECT)
        if (typeof response.id === 'string' && response.id !== this.id) rememberResponseId(this.id, response.id)
        response.id = this.id
        if ('model' in response) response.model = alias
        if (isObj(response.usage)) keep(response.usage, RESPONSES_USAGE)
        if (isObj(response.error)) response.error = { code: 'server_error', message: STREAM_ERROR }
      }
      if (obj.type === 'error') { obj.message = STREAM_ERROR; delete obj.param }
      if ('response_id' in obj) obj.response_id = this.id
      if (isObj(obj.usage)) keep(obj.usage, RESPONSES_USAGE)
      return
    }
    // Outros endpoints (embeddings, imagens...): sai o que entrega o fornecedor e o modelo vira o apelido.
    for (const target of [obj, obj.message, obj.response]) if (isObj(target) && 'model' in target) target.model = alias
    if (isObj(obj.usage)) drop(obj.usage, LEAKY)
  }

  /**
   * O cliente vê o apelido que comprou, nunca o modelo real do fornecedor. O fornecedor nem sempre devolve
   * o mesmo id que recebeu (ex.: pede "anthropic/claude-opus-5-5" e responde "claude-opus-5-5", ou
   * acrescenta a data, como "claude-haiku-4-5-20251001"), então todo campo "model" vira o apelido.
   * Texto dentro das mensagens não é afetado: ali as aspas vêm escapadas (\"model\").
   */
  private hide(text: string): string {
    return text
      .split(JSON.stringify(this.opts.supplierId)).join(JSON.stringify(this.opts.alias))
      .replace(/("model"\s*:\s*")[^"\\]*(")/g, `$1${this.opts.alias}$2`)
  }
}

/**
 * Colunas obrigatórias que a tabela gateway_usage herdou da API antiga (ex.: upstream_tier).
 * Quando o banco recusa por uma delas, o valor é copiado de um registro antigo e fica guardado.
 */
const inheritedColumns: Record<string, unknown> = {}

/** Grava a chamada em gateway_usage. Falhar aqui nunca derruba a resposta do cliente. */
export async function recordUsage(env: Env, request: typeof fetch, row: UsageRow) {
  const base = env.SUPABASE_URL?.replace(/\/+$/, ''), secret = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !secret) return
  const auth = { apikey: secret, ...(!secret.startsWith('sb_secret_') ? { Authorization: `Bearer ${secret}` } : {}) }
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await request(`${base}/rest/v1/gateway_usage`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ ...row, ...inheritedColumns }),
        signal: AbortSignal.timeout(8000),
      })
      if (response.ok) return
      const detail = await response.text().catch(() => '')
      let column = ''
      try {
        const error = JSON.parse(detail) as { code?: string; message?: string }
        if (error.code === '23502') column = /column "([a-z_][a-z0-9_]*)"/.exec(String(error.message))?.[1] || ''
      } catch { /* resposta que não é JSON */ }
      if (!column || column in inheritedColumns || column in row) {
        console.error('gateway_usage recusou o registro', response.status, detail.slice(0, 300))
        return
      }
      const query = new URLSearchParams({ select: column, [column]: 'not.is.null', order: 'id.desc', limit: '1' })
      const sample = await request(`${base}/rest/v1/gateway_usage?${query}`, { headers: auth, signal: AbortSignal.timeout(8000) })
      const value = sample.ok ? ((await sample.json()) as Record<string, unknown>[])[0]?.[column] : undefined
      if (value === undefined || value === null) {
        console.error('gateway_usage exige', column, 'e não há registro antigo para copiar o valor')
        return
      }
      inheritedColumns[column] = value
    }
  } catch (error) {
    console.error('Falha ao gravar gateway_usage', error)
  }
}
