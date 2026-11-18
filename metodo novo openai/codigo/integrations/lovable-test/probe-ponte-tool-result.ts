/**
 * UMA chamada direta à ponte publicada, sem Six e sem Claude Code no meio, com o histórico
 * sintético que deu 502: user → assistant tool_use → user tool_result. Nenhum conteúdo seu vai junto.
 *
 * A chave da ponte vem do ambiente, nunca de argumento:
 *   $env:SIX_TEST_BRIDGE_KEY = '<chave da ponte>'
 *   node --experimental-strip-types integrations/lovable-test/probe-ponte-tool-result.ts
 *
 * Sem retry: cada execução gasta uma das 3 tentativas da instância da ponte e créditos de IA.
 */
const PONTE = process.env.SIX_TEST_BRIDGE_URL || 'https://radar-tech-ticker.lovable.app/api/public/six-test/v1/messages'

const chave = process.env.SIX_TEST_BRIDGE_KEY
if (!chave || chave.length < 32) {
  console.error('Defina SIX_TEST_BRIDGE_KEY no ambiente (mínimo 32 caracteres). Não passe a chave como argumento.')
  process.exit(2)
}

const corpo = {
  model: 'anthropic/claude-opus-5-5',
  max_tokens: 32,
  stream: false,
  tools: [
    {
      name: 'listar_arquivos',
      description: 'Lista os arquivos de uma pasta.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
  ],
  messages: [
    { role: 'user', content: 'Liste os arquivos e responda só com a quantidade.' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_01SixProbe', name: 'listar_arquivos', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01SixProbe', content: 'a.txt\nb.txt' }] },
  ],
}

const inicio = Date.now()
const resposta = await fetch(PONTE, {
  method: 'POST',
  headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(corpo),
  redirect: 'manual',
  signal: AbortSignal.timeout(75_000),
})
const texto = await resposta.text()
let json: any
try {
  json = JSON.parse(texto)
} catch {
  json = undefined
}

const cabecalhos: Record<string, string> = {}
for (const [nome, valor] of resposta.headers) if (nome.startsWith('x-six-bridge-')) cabecalhos[nome] = valor

console.log(
  JSON.stringify(
    {
      status: resposta.status,
      ms: Date.now() - inicio,
      diagnostico: Object.keys(cabecalhos).length ? cabecalhos : 'ausente (ponte publicada ainda é a versão sem diagnóstico)',
      erro: json?.error,
      resposta: json?.type === 'message' ? { model: json.model, stop_reason: json.stop_reason, content: json.content, usage: json.usage } : undefined,
      corpoNaoJson: json === undefined ? texto.slice(0, 200) : undefined,
    },
    null,
    2,
  ),
)
if (resposta.status !== 200) process.exitCode = 1
