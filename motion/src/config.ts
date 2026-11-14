/**
 * Filme da SixtySix: textos, dados e tempos num lugar só.
 * Tudo o que aparece sobre o produto foi tirado do site e do painel (HomePage.tsx, DashboardPage.tsx).
 */

export type Formato = '9x16' | '16x9'

export const FORMATOS: Record<Formato, { w: number; h: number; nome: string }> = {
  '9x16': { w: 1080, h: 1920, nome: 'Reels 9:16' },
  '16x9': { w: 1920, h: 1080, nome: 'Paisagem 16:9' },
}

/** Cenas em ordem. `duracao` é o tempo natural (s); `velocidade` acelera (>1) ou desacelera (<1) a cena. */
export const CENAS = [
  { id: 'gancho', nome: 'O gancho', duracao: 5, velocidade: 1 },
  { id: 'interrupcao', nome: 'A interrupção', duracao: 4, velocidade: 1 },
  { id: 'transicao', nome: 'A transição', duracao: 3, velocidade: 1 },
  { id: 'produto', nome: 'O produto', duracao: 10, velocidade: 1 },
  { id: 'encerramento', nome: 'Encerramento', duracao: 6, velocidade: 1 },
] as const

export type CenaId = (typeof CENAS)[number]['id']

export const MARCA = 'SixtySix'
export const SITE = 'sixtysix.online'

/** Textos da tela. Entre *asteriscos* fica o destaque (itálico verde, como no painel). */
export const TEXTOS = {
  gancho1: 'Você paga *caro* pela sua IA.',
  gancho2: 'Mas ela para quando você *mais precisa.*',
  conheca: 'Conheça a *SixtySix.*',
  tagline: 'Sua criatividade não deveria parar por causa de um limite.',
  painel: 'Consumo, chaves e conexão. *Em um só lugar.*',
  modelos: 'Os modelos que lideram o mercado. *Nas ferramentas que você já usa.*',
  conecte: 'Integre com IA *em minutos.*',
  fim1: 'Continue *criando.*',
  cta: 'Teste grátis de 3 horas',
}

/** Ferramentas da aba "Como conectar" do painel, na mesma ordem. */
export const FERRAMENTAS: [string, string, string][] = [
  ['Claude Code', 'Terminal · todos os modelos', 'claude'],
  ['Claude Code no VS Code', 'Extensão · todos os modelos', 'vscode'],
  ['Claude Desktop', 'Aplicativo · todos os modelos', 'claude'],
  ['Codex', 'Terminal e desktop', 'openai'],
  ['Cline', 'VS Code · Argon 4', 'vscode'],
  ['OpenCode', 'Terminal · Argon 4', 'gemini'],
  ['pi', 'Terminal · Argon 4', 'pi'],
]

/** Modelos do Claude Code no painel (CLAUDE_TOOL_MODELS). */
export const MODELOS = ['Fable 5.2', 'Opus 5.5', 'Astra 6', 'Argon 4']

/** Diferenciais do plano Pro, com as palavras do site. */
export const BENEFICIOS: [string, string, string][] = [
  ['infinito', 'Uso 100% ilimitado', 'Sem travas diárias no plano Pro'],
  ['chave', 'Chave individual', 'Zero rateio: a chave é só sua'],
  ['pix', 'Preço fixo em reais', 'Pago no Pix, sem IOF'],
]

/** Código que a IA gera na cena 1. Cada linha é uma lista de [classe, texto]. */
type Seg = [string, string]
export const CODIGO: Seg[][] = [
  [['k', 'import'], ['p', ' { '], ['i', 'pix'], ['p', ' } '], ['k', 'from'], ['s', " '@/lib/pix'"]],
  [],
  [['k', 'export async function'], ['f', ' checkout'], ['p', '(p: '], ['t', 'Pedido'], ['p', ') {']],
  [['p', '  '], ['k', 'const'], ['i', ' cobranca'], ['p', ' = '], ['k', 'await'], ['i', ' pix'], ['p', '.'], ['f', 'cobrar'], ['p', '({']],
  [['i', '    valor'], ['p', ': p.'], ['i', 'total'], ['p', ',']],
  [['i', '    descricao'], ['p', ': '], ['s', '`Pedido #${p.id}`'], ['p', ',']],
  [['i', '    expiraEm'], ['p', ': '], ['n', '30'], ['p', ' * '], ['n', '60'], ['p', ',']],
  [['p', '  })']],
  [['p', '  '], ['k', 'await'], ['i', ' db'], ['p', '.'], ['i', 'pedidos'], ['p', '.'], ['f', 'salvar'], ['p', '(p.'], ['i', 'id'], ['p', ', {']],
  [['i', '    status'], ['p', ': '], ['s', "'aguardando'"], ['p', ',']],
  [['i', '    txid'], ['p', ': cobranca.'], ['i', 'txid'], ['p', ',']],
  [['p', '  })']],
  [['p', '  '], ['k', 'return'], ['p', ' { '], ['i', 'qr'], ['p', ': cobranca.'], ['i', 'qrCode'], ['p', ' }']],
  [['p', '}']],
  [],
  [['k', 'export async function'], ['f', ' webhook'], ['p', '(ev: '], ['t', 'EventoPix'], ['p', ') {']],
  [['p', '  '], ['k', 'const'], ['i', ' pedido'], ['p', ' = '], ['k', 'await'], ['f', ' buscar'], ['p', '(ev.'], ['i', 'txid'], ['p', ')']],
  [['p', '  '], ['k', 'await'], ['f', ' confirmarPagamento'], ['p', '(pedido)']],
]
/** Na interrupção, a última linha para aqui (caracteres visíveis). */
export const CORTE_ULTIMA_LINHA = '  await confirmarPagam'.length

/** Terminal da cena do produto: os comandos reais do painel (Windows · PowerShell). */
export const TERMINAL: Seg[][] = [
  [['m', 'PS> '], ['i', "$env:ANTHROPIC_BASE_URL="], ['s', "'https://www.sixtysix.online'"]],
  [['m', 'PS> '], ['i', '$env:ANTHROPIC_API_KEY='], ['s', "'sk-rt-••••••••'"]],
  [['m', 'PS> '], ['f', 'claude'], ['i', ' --model '], ['s', 'claude-fable-5-2']],
]
