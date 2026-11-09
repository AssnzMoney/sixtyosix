import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Key,
  Terminal,
  MessageSquare,
  CreditCard,
  Copy,
  Check,
  Plus,
  Trash2,
  LogOut,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  TrendingUp,
  X,
  Send,
  Bot,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { getApiKeys, createApiKey, revokeApiKey, ApiKeyItem } from '../lib/apiKeys'

const GoogleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
      fill="#EA4335"
    />
  </svg>
)

const DiscordIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="#5865F2">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'ide' | 'playground' | 'pix'>('overview')
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null)

  // Playground state
  const [selectedModel, setSelectedModel] = useState('claude-fable-5.1')
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Olá! Estou conectado através do SixtySix Gateway com latência ultrabaixa. Como posso te ajudar a codificar hoje?',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Pix state
  const [pixCopied, setPixCopied] = useState(false)
  const pixCopyCode = '00020126580014br.gov.bcb.pix013666f8e21a-6666-4f9b-9876-sixtysixonline520400005303986540579.005802BR5916SIXTYSIX DEV LTDA6009SAO PAULO62070503***6304E8A2'

  useEffect(() => {
    const loadKeys = async () => {
      const uid = user?.id || 'guest-user'
      const items = await getApiKeys(uid)
      setKeys(items)
      setLoadingKeys(false)
    }
    loadKeys()
  }, [user])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKeyId(id)
    setTimeout(() => setCopiedKeyId(null), 2000)
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const uid = user?.id || 'guest-user'
    const { key, fullKey } = await createApiKey(uid, newKeyName || 'Minha IDE')
    setKeys([key, ...keys])
    setJustCreatedKey(fullKey)
    setNewKeyName('')
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!window.confirm('Tem certeza que deseja revogar esta chave? Qualquer IDE conectada a ela deixará de responder.')) return
    const uid = user?.id || 'guest-user'
    await revokeApiKey(uid, keyId)
    setKeys(keys.filter((k) => k.id !== keyId))
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const userText = chatInput.trim()
    setChatMessages((prev) => [...prev, { role: 'user', text: userText }])
    setChatInput('')
    setIsTyping(true)

    setTimeout(() => {
      let reply = ''
      if (selectedModel.includes('claude')) {
        reply = `[Claude Fable 5.1 via SixtySix]: Recebi sua requisição de "${userText}". O modelo está operando em 22ms com contexto total de 200k tokens ativado.`
      } else if (selectedModel.includes('astra')) {
        reply = `[GPT Astra 6 via SixtySix]: Resposta de alta precisão gerada sem restrição de cota diária. Parâmetros otimizados para Cursor e VS Code.`
      } else {
        reply = `[GLM-4 Plus via SixtySix]: Requisição executada com sucesso. Modo trilíngue e raciocínio técnico ativado.`
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply }])
      setIsTyping(false)
    }, 700)
  }

  const primaryKey = keys[0]?.fullKey || keys[0]?.keyPrefix || 'sk-live-66-9a2f7c41b8e05d39f'

  return (
    <div className="dash-container">
      {/* Sidebar Lateral */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-top">
          <Link to="/" className="dash-brand-link" title="Voltar para a Home">
            <img src="/assets/sidebar-logo.png" alt="SixtySix" className="dash-brand-logo" />
          </Link>

          <nav className="dash-nav">
            <button
              type="button"
              className={`dash-nav-item ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <Activity size={18} />
              <span>Visão Geral</span>
            </button>
            <button
              type="button"
              className={`dash-nav-item ${activeTab === 'keys' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('keys')}
            >
              <Key size={18} />
              <span>Chaves de API</span>
              <span className="dash-nav-badge">{keys.length}</span>
            </button>
            <button
              type="button"
              className={`dash-nav-item ${activeTab === 'ide' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('ide')}
            >
              <Terminal size={18} />
              <span>Conectar na IDE</span>
            </button>
            <button
              type="button"
              className={`dash-nav-item ${activeTab === 'playground' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('playground')}
            >
              <MessageSquare size={18} />
              <span>Playground</span>
            </button>
            <button
              type="button"
              className={`dash-nav-item ${activeTab === 'pix' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('pix')}
            >
              <CreditCard size={18} />
              <span>Plano &amp; Pix</span>
            </button>
          </nav>
        </div>

        {/* Rodapé da Sidebar: Perfil do Desenvolvedor */}
        <div className="dash-sidebar-bottom">
          <div className="dash-user-card">
            <div className="dash-user-avatar-wrap">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="dash-user-avatar" />
              ) : (
                <div className="dash-user-avatar-fallback">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
                </div>
              )}
              <span className="dash-user-provider-badge">
                {user?.provider === 'google' ? <GoogleIcon /> : <DiscordIcon />}
              </span>
            </div>
            <div className="dash-user-info">
              <span className="dash-user-name">{user?.name || 'Desenvolvedor'}</span>
              <span className="dash-user-email">{user?.email || 'conectado@sixtysix.online'}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut()
                navigate('/login')
              }}
              className="dash-logout-btn"
              title="Desconectar"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="dash-main">
        {/* Top Header Bar */}
        <header className="dash-header">
          <div className="dash-header-left">
            <h1 className="dash-title">
              {activeTab === 'overview' && 'Visão Geral da Conta'}
              {activeTab === 'keys' && 'Gerenciamento de Chaves de API'}
              {activeTab === 'ide' && 'Configuração Rápida na sua IDE'}
              {activeTab === 'playground' && 'Playground dos Três Modelos'}
              {activeTab === 'pix' && 'Assinatura & Recarga Pix'}
            </h1>
            <p className="dash-subtitle">
              {activeTab === 'overview' && 'Acompanhe seu consumo, economia estimada e status do gateway.'}
              {activeTab === 'keys' && 'Chaves ativas para conectar no Cursor, Claude Code e VS Code.'}
              {activeTab === 'ide' && 'Copie os parâmetros de configuração e programe sem travas de cota.'}
              {activeTab === 'playground' && 'Teste prompts em tempo real no Claude, GPT Astra ou GLM-4.'}
              {activeTab === 'pix' && 'Sem cartão de crédito internacional. Pagamento fixo e imediato via Pix.'}
            </p>
          </div>

          <div className="dash-header-actions">
            <div className="dash-status-pill">
              <span className="dash-status-dot" />
              <span>Gateway 99.9% Uptime</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="dash-primary-btn"
            >
              <Plus size={16} />
              <span>Nova Chave</span>
            </button>
          </div>
        </header>

        {/* ABA 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="dash-tab-content">
            {/* 4 Cards de Métricas (Idêntico ao mock da landing) */}
            <div className="dash-stats-grid">
              <div className="dash-stat-card">
                <div className="dash-stat-top">
                  <span className="dash-stat-label">Requisições</span>
                  <span className="dash-badge-green">+5%</span>
                </div>
                <div className="dash-stat-number">8.940</div>
                <span className="dash-stat-sub">Esse Mês</span>
              </div>

              <div className="dash-stat-card">
                <div className="dash-stat-top">
                  <span className="dash-stat-label">Economia no Pix</span>
                  <span className="dash-badge-green">+5%</span>
                </div>
                <div className="dash-stat-number stat-money">R$ 3.500,00</div>
                <span className="dash-stat-sub">vs. Fatura em Dólar + IOF</span>
              </div>

              <div className="dash-stat-card">
                <div className="dash-stat-top">
                  <span className="dash-stat-label">Plano Ativo</span>
                  <span className="dash-badge-pro">PRO ILIMITADO</span>
                </div>
                <div className="dash-stat-number stat-plan">Cotas 5 Horas</div>
                <span className="dash-stat-sub">Renovação sem cortes</span>
              </div>

              <div className="dash-stat-card">
                <div className="dash-stat-top">
                  <span className="dash-stat-label">Latência Média</span>
                  <span className="dash-badge-green">25ms</span>
                </div>
                <div className="dash-stat-number">99.9%</div>
                <span className="dash-stat-sub">Uptime dos modelos</span>
              </div>
            </div>

            {/* Banner de Chave Rápida para o Cursor */}
            <div className="dash-quick-key-banner">
              <div className="dash-quick-key-left">
                <div className="dash-quick-key-badge">
                  <Zap size={14} />
                  <span>Sua Chave Pronta para Uso</span>
                </div>
                <h3 className="dash-quick-key-title">Conecte seu Cursor ou Claude Code agora</h3>
                <p className="dash-quick-key-sub">
                  Use sua chave própria para liberar o Claude Fable 5.1 e GPT Astra 6 direto na sua IDE favorita.
                </p>
                <div className="dash-key-code-wrap">
                  <code className="dash-key-code">{primaryKey}</code>
                  <button
                    type="button"
                    onClick={() => handleCopy(primaryKey, 'primary')}
                    className="dash-key-copy-btn"
                  >
                    {copiedKeyId === 'primary' ? (
                      <>
                        <Check size={14} className="text-green-600" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        <span>Copiar Chave</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('ide')}
                className="dash-setup-shortcut-btn"
              >
                <span>Ver Guia de Configuração</span>
                <ExternalLink size={14} />
              </button>
            </div>

            {/* Gráfico de Desempenho em Tempo Real (Barras Verdes) */}
            <div className="dash-chart-card">
              <div className="dash-chart-header">
                <div>
                  <h3 className="dash-chart-title">Desempenho de Requisições</h3>
                  <p className="dash-chart-sub">Volume de tokens processados por período</p>
                </div>
                <span className="dash-chart-live-tag">Em tempo real</span>
              </div>

              <div className="dash-bars-visual">
                <div className="dash-bar-col" style={{ height: '35%' }} title="00h - 410 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">00h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '52%' }} title="04h - 680 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">04h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '44%' }} title="08h - 590 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">08h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '70%' }} title="12h - 1.250 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">12h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '62%' }} title="14h - 980 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">14h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '88%' }} title="16h - 1.640 req">
                  <div className="dash-bar-fill is-peak" />
                  <span className="dash-bar-label">16h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '75%' }} title="18h - 1.320 req">
                  <div className="dash-bar-fill" />
                  <span className="dash-bar-label">18h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '94%' }} title="20h - 1.820 req">
                  <div className="dash-bar-fill is-peak" />
                  <span className="dash-bar-label">20h</span>
                </div>
                <div className="dash-bar-col" style={{ height: '100%' }} title="Agora - 2.150 req">
                  <div className="dash-bar-fill is-peak" />
                  <span className="dash-bar-label">Agora</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: CHAVES DE API */}
        {activeTab === 'keys' && (
          <div className="dash-tab-content">
            <div className="dash-keys-header-bar">
              <div>
                <h2 className="dash-section-title">Suas Chaves Secretas</h2>
                <p className="dash-section-sub">
                  Cada chave possui permissão para chamar Claude, GPT Astra e GLM através da base URL oficial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="dash-primary-btn"
              >
                <Plus size={16} />
                <span>Criar Nova Chave</span>
              </button>
            </div>

            <div className="dash-keys-list">
              {loadingKeys ? (
                <div className="dash-keys-loading">Carregando chaves...</div>
              ) : keys.length === 0 ? (
                <div className="dash-keys-empty">
                  <Key size={32} className="text-gray-400" />
                  <h3>Nenhuma chave criada ainda</h3>
                  <p>Crie sua primeira chave para conectar sua IDE favorita.</p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="dash-primary-btn"
                  >
                    Criar Chave Agora
                  </button>
                </div>
              ) : (
                keys.map((k) => (
                  <div key={k.id} className="dash-key-card">
                    <div className="dash-key-left">
                      <div className="dash-key-name-row">
                        <span className="dash-key-name">{k.name}</span>
                        <span className="dash-key-status-badge">Ativa</span>
                      </div>
                      <code className="dash-key-prefix-text">{k.keyPrefix}</code>
                      <span className="dash-key-created-date">
                        Criada em {new Date(k.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="dash-key-actions">
                      <button
                        type="button"
                        onClick={() => handleCopy(k.fullKey || k.keyPrefix, k.id)}
                        className="dash-action-btn"
                      >
                        {copiedKeyId === k.id ? (
                          <>
                            <Check size={14} className="text-green-600" />
                            <span>Copiada!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(k.id)}
                        className="dash-action-btn is-danger"
                        title="Revogar chave"
                      >
                        <Trash2 size={14} />
                        <span>Revogar</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA 3: CONECTAR NA IDE */}
        {activeTab === 'ide' && (
          <div className="dash-tab-content">
            <div className="dash-ide-grid">
              {/* Card Cursor */}
              <div className="dash-ide-card">
                <div className="dash-ide-card-header">
                  <div className="dash-ide-badge">Cursor</div>
                  <h3>Configuração no Cursor</h3>
                </div>
                <p className="dash-ide-desc">
                  Abra <strong>Cursor Settings &gt; Models &gt; OpenAI API Key</strong> e configure os campos abaixo:
                </p>
                <div className="dash-ide-field">
                  <label>Base URL</label>
                  <div className="dash-copy-field">
                    <code>https://sixtysix.online/v1</code>
                    <button
                      type="button"
                      onClick={() => handleCopy('https://sixtysix.online/v1', 'curl-base')}
                    >
                      {copiedKeyId === 'curl-base' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="dash-ide-field">
                  <label>API Key</label>
                  <div className="dash-copy-field">
                    <code>{primaryKey}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(primaryKey, 'curl-key')}
                    >
                      {copiedKeyId === 'curl-key' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div className="dash-ide-field">
                  <label>Model Name</label>
                  <div className="dash-copy-field">
                    <code>claude-fable-5.1</code>
                    <button
                      type="button"
                      onClick={() => handleCopy('claude-fable-5.1', 'curl-model')}
                    >
                      {copiedKeyId === 'curl-model' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Claude Code CLI */}
              <div className="dash-ide-card">
                <div className="dash-ide-card-header">
                  <div className="dash-ide-badge is-claude">Claude Code</div>
                  <h3>Terminal &amp; Claude CLI</h3>
                </div>
                <p className="dash-ide-desc">
                  Cole no seu terminal (Bash/Zsh/PowerShell) antes de rodar o Claude Code:
                </p>
                <div className="dash-code-block">
                  <pre>
                    <code>{`export ANTHROPIC_BASE_URL="https://sixtysix.online/v1"
export ANTHROPIC_API_KEY="${primaryKey}"`}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `export ANTHROPIC_BASE_URL="https://sixtysix.online/v1"\nexport ANTHROPIC_API_KEY="${primaryKey}"`,
                        'cli-export'
                      )
                    }
                    className="dash-copy-code-btn"
                  >
                    {copiedKeyId === 'cli-export' ? <Check size={14} /> : <Copy size={14} />}
                    <span>Copiar Comando</span>
                  </button>
                </div>
              </div>

              {/* Card VS Code / Cline */}
              <div className="dash-ide-card">
                <div className="dash-ide-card-header">
                  <div className="dash-ide-badge is-vscode">VS Code</div>
                  <h3>Cline / Continue / Roo</h3>
                </div>
                <p className="dash-ide-desc">
                  Configuração para a extensão Continue ou Cline (OpenAI-compatible):
                </p>
                <div className="dash-code-block">
                  <pre>
                    <code>{`{
  "apiBase": "https://sixtysix.online/v1",
  "apiKey": "${primaryKey}",
  "model": "gpt-6-astra"
}`}</code>
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        `{\n  "apiBase": "https://sixtysix.online/v1",\n  "apiKey": "${primaryKey}",\n  "model": "gpt-6-astra"\n}`,
                        'json-export'
                      )
                    }
                    className="dash-copy-code-btn"
                  >
                    {copiedKeyId === 'json-export' ? <Check size={14} /> : <Copy size={14} />}
                    <span>Copiar JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ABA 4: PLAYGROUND */}
        {activeTab === 'playground' && (
          <div className="dash-tab-content">
            <div className="dash-playground-card">
              <div className="dash-playground-top">
                <div className="dash-model-selector-wrap">
                  <label>Modelo Selecionado:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="dash-model-select"
                  >
                    <option value="claude-fable-5.1">Claude Fable 5.1 (Raciocínio &amp; Código)</option>
                    <option value="gpt-astra-6">GPT Astra 6 (Super Veloz &amp; Completo)</option>
                    <option value="glm-4-plus">GLM-4 Plus (Refatoração &amp; Documentação)</option>
                  </select>
                </div>
                <span className="dash-playground-status">Online via SixtySix Proxy</span>
              </div>

              <div className="dash-chat-messages">
                {chatMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`dash-chat-bubble ${m.role === 'user' ? 'is-user' : 'is-ai'}`}
                  >
                    <div className="dash-chat-avatar">
                      {m.role === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                    </div>
                    <div className="dash-chat-text">{m.text}</div>
                  </div>
                ))}
                {isTyping && (
                  <div className="dash-chat-bubble is-ai">
                    <div className="dash-chat-avatar">
                      <Bot size={14} />
                    </div>
                    <div className="dash-chat-text is-loading-dots">
                      <span>•</span>
                      <span>•</span>
                      <span>•</span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="dash-chat-input-row">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Escreva uma pergunta ou código para testar a resposta do modelo..."
                  className="dash-chat-input"
                />
                <button type="submit" disabled={isTyping} className="dash-chat-send-btn">
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ABA 5: PLANOS & PIX */}
        {activeTab === 'pix' && (
          <div className="dash-tab-content">
            <div className="dash-pix-wrap">
              <div className="dash-pix-card">
                <div className="dash-pix-badge">Assinatura Ativa</div>
                <h2 className="dash-pix-title">Plano Pro Ilimitado</h2>
                <div className="dash-pix-price">
                  <span className="dash-pix-currency">R$</span>
                  <span className="dash-pix-val">79</span>
                  <span className="dash-pix-period">/mês no Pix</span>
                </div>
                <ul className="dash-pix-features">
                  <li><Check size={16} className="text-green-600" /> Sem IOF de 4,38% e sem taxa cambial abusiva</li>
                  <li><Check size={16} className="text-green-600" /> Acesso total aos 3 modelos (Claude, GPT Astra, GLM-4)</li>
                  <li><Check size={16} className="text-green-600" /> Cotas renovadas a cada 5 horas automaticamente</li>
                  <li><Check size={16} className="text-green-600" /> Latência garantida de 25ms para Cursor e VS Code</li>
                </ul>
              </div>

              <div className="dash-pix-checkout-card">
                <h3>Recarregar ou Renovar via Pix Imediato</h3>
                <p>Escaneie o QR Code ou copie o código Pix abaixo para aprovação instantânea:</p>
                <div className="dash-pix-qr-box">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=00020126580014br.gov.bcb.pix013666f8e21a-6666-4f9b-9876-sixtysixonline520400005303986540579.005802BR5916SIXTYSIXDEV6009SAOPAULO62070503***6304E8A2"
                    alt="QR Code Pix SixtySix"
                    className="dash-pix-qr-img"
                  />
                  <span className="dash-pix-qr-label">Aprovação em menos de 10 segundos</span>
                </div>

                <div className="dash-pix-copy-row">
                  <input
                    type="text"
                    readOnly
                    value={pixCopyCode}
                    className="dash-pix-copy-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(pixCopyCode)
                      setPixCopied(true)
                      setTimeout(() => setPixCopied(false), 2000)
                    }}
                    className="dash-pix-copy-btn"
                  >
                    {pixCopied ? (
                      <>
                        <Check size={16} />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        <span>Copiar Pix</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Criar Nova Chave */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="dash-modal-overlay" onClick={() => setShowCreateModal(false)}>
            <motion.div
              className="dash-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
            >
              <div className="dash-modal-header">
                <h3>Criar Nova Chave de API</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setJustCreatedKey(null)
                  }}
                  className="dash-modal-close"
                >
                  <X size={18} />
                </button>
              </div>

              {justCreatedKey ? (
                <div className="dash-modal-created">
                  <div className="dash-modal-success-badge">
                    <Check size={18} />
                    <span>Chave Gerada com Sucesso!</span>
                  </div>
                  <p className="dash-modal-warning">
                    Copie esta chave agora. Por segurança, você não poderá vê-la por completo novamente.
                  </p>
                  <div className="dash-modal-key-display">
                    <code>{justCreatedKey}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(justCreatedKey, 'modal-key')}
                      className="dash-modal-copy-btn"
                    >
                      {copiedKeyId === 'modal-key' ? (
                        <>
                          <Check size={16} />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setJustCreatedKey(null)
                    }}
                    className="dash-primary-btn w-full mt-4"
                  >
                    Concluir e Fechar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateKey} className="dash-modal-form">
                  <label htmlFor="key-name">Identificador da Chave</label>
                  <input
                    id="key-name"
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Ex: Cursor MacBook Pro, Cline VSCode..."
                    className="dash-modal-input"
                    autoFocus
                  />
                  <div className="dash-modal-actions">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="dash-modal-cancel-btn"
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="dash-primary-btn">
                      Gerar Chave Agora
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
