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
  Menu,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Building2,
  Lock,
  Edit3,
  HelpCircle,
  Clock,
  ArrowUpRight,
  Layers,
  Coins,
  ArrowLeft,
  DollarSign,
  TrendingDown,
  Cpu,
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

/* Ícone 3D Isometric Pedestal com Maço de Notas Verdes Neon (Idêntico ao print) */
const MoneyPedestalIcon = () => (
  <svg width="105" height="105" viewBox="0 0 130 130" fill="none" className="neon-pedestal-svg">
    <defs>
      <filter id="neon-glow-money" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <linearGradient id="money-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#dcfce7" />
        <stop offset="40%" stopColor="#86efac" />
        <stop offset="100%" stopColor="#22c55e" />
      </linearGradient>
    </defs>
    {/* Base Pedestal Isométrico Escuro */}
    <ellipse cx="65" cy="104" rx="46" ry="16" fill="#090d13" opacity="0.8" />
    <path d="M24 88 L65 104 L106 88 L65 72 Z" fill="#1e2634" stroke="#2d3748" strokeWidth="1.5" />
    <path d="M24 88 L24 97 L65 113 L65 104 Z" fill="#111827" />
    <path d="M65 104 L65 113 L106 97 L106 88 Z" fill="#1b2432" />
    {/* Anel de Neon Verde Brilhante no Pedestal */}
    <ellipse cx="65" cy="88" rx="30" ry="11" fill="#22c55e" fillOpacity="0.5" filter="url(#neon-glow-money)" />
    <ellipse cx="65" cy="88" rx="25" ry="8.5" stroke="#86efac" strokeWidth="2.5" />
    {/* Maço Isométrico de Dinheiro Flutuando */}
    <g transform="translate(0, -6)">
      {/* Camadas inferiores */}
      <path d="M42 54 L75 38 L98 50 L65 66 Z" fill="#15803d" />
      <path d="M42 54 L42 60 L65 72 L65 66 Z" fill="#166534" />
      <path d="M65 66 L65 72 L98 56 L98 50 Z" fill="#14532d" />
      {/* Camada topo neon */}
      <path d="M40 48 L73 32 L96 44 L63 60 Z" fill="url(#money-grad)" stroke="#4ade80" strokeWidth="1.5" />
      <ellipse cx="68" cy="46" rx="8" ry="4" fill="#166534" fillOpacity="0.35" stroke="#22c55e" strokeWidth="1.2" />
      <path d="M52 38 L55 39.5" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M81 52 L84 53.5" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  </svg>
)

/* Ícone 3D Isometric Pedestal com Calendário & Ciclo Neon (Idêntico ao print) */
const CalendarPedestalIcon = () => (
  <svg width="105" height="105" viewBox="0 0 130 130" fill="none" className="neon-pedestal-svg">
    <defs>
      <filter id="neon-glow-cal" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Base Pedestal Isométrico Escuro */}
    <ellipse cx="65" cy="104" rx="46" ry="16" fill="#090d13" opacity="0.8" />
    <path d="M24 88 L65 104 L106 88 L65 72 Z" fill="#1e2634" stroke="#2d3748" strokeWidth="1.5" />
    <path d="M24 88 L24 97 L65 113 L65 104 Z" fill="#111827" />
    <path d="M65 104 L65 113 L106 97 L106 88 Z" fill="#1b2432" />
    {/* Anel de Neon Verde */}
    <ellipse cx="65" cy="88" rx="30" ry="11" fill="#22c55e" fillOpacity="0.5" filter="url(#neon-glow-cal)" />
    <ellipse cx="65" cy="88" rx="25" ry="8.5" stroke="#86efac" strokeWidth="2.5" />
    {/* Ícone de Ciclo & Calendário Neon */}
    <g transform="translate(34, 20)">
      {/* Círculo com seta de renovação */}
      <circle cx="31" cy="31" r="28" stroke="#86efac" strokeWidth="3" strokeDasharray="130 35" fill="none" filter="url(#neon-glow-cal)" />
      <path d="M54 18 L60 25 L50 27" fill="none" stroke="#86efac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Calendário Central */}
      <rect x="18" y="18" width="26" height="24" rx="5" fill="#14532d" stroke="#4ade80" strokeWidth="2" />
      <line x1="18" y1="26" x2="44" y2="26" stroke="#4ade80" strokeWidth="2" />
      <circle cx="24" cy="32" r="1.5" fill="#86efac" />
      <circle cx="31" cy="32" r="1.5" fill="#86efac" />
      <circle cx="38" cy="32" r="1.5" fill="#86efac" />
      <circle cx="24" cy="37" r="1.5" fill="#86efac" />
      <circle cx="31" cy="37" r="1.5" fill="#86efac" />
      {/* Moeda frontal */}
      <circle cx="45" cy="42" r="10" fill="#22c55e" stroke="#dcfce7" strokeWidth="1.8" />
      <text x="41.5" y="46.5" fill="#0b1311" fontSize="12" fontWeight="bold">S</text>
    </g>
  </svg>
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, signOut, toggleSubscriptionPlan, updateDisplayName } = useAuth()

  // Se o usuário estiver logado mas nunca escolheu como ser chamado, redireciona para onboarding
  useEffect(() => {
    if (user && !user.hasCompletedOnboarding) {
      navigate('/onboarding')
    }
  }, [user, navigate])

  const [activeTab, setActiveTab] = useState<'overview' | 'keys' | 'ide' | 'playground' | 'pix'>('overview')
  const [selectedPeriod, setSelectedPeriod] = useState('Hoje')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [sandboxMode, setSandboxMode] = useState(true)

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loadingKeys, setLoadingKeys] = useState(true)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showEditNameModal, setShowEditNameModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState(user?.name || '')

  // Menus sanfonados do Drawer / Sidebar
  const [groupStoreOpen, setGroupStoreOpen] = useState(true)
  const [groupIntegrationOpen, setGroupIntegrationOpen] = useState(true)

  // Playground state
  const [selectedModel, setSelectedModel] = useState('claude-fable-5.1')
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: `Olá, ${user?.name || 'Desenvolvedor'}! Conexão oficial ativa com SixtySix Gateway (24ms). Como posso acelerar seu código hoje?`,
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Pix state
  const [pixCopied, setPixCopied] = useState(false)
  const pixCopyCode = '00020126580014br.gov.bcb.pix013666f8e21a-6666-4f9b-9876-sixtysixonline520400005303986540579.005802BR5916SIXTYSIX DEV LTDA6009SAO PAULO62070503***6304E8A2'

  // Carrega chaves
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

  // Regra de negócio: sem plano ativo => limite de 1 chave
  const handleOpenCreateModal = () => {
    const hasPlan = user?.hasActivePlan ?? false
    if (!hasPlan && keys.length >= 1) {
      setShowLimitModal(true)
      return
    }
    setShowCreateModal(true)
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const hasPlan = user?.hasActivePlan ?? false
    if (!hasPlan && keys.length >= 1) {
      setShowCreateModal(false)
      setShowLimitModal(true)
      return
    }

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

  const handleSaveChosenName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editNameValue.trim()) return
    await updateDisplayName(editNameValue.trim())
    setShowEditNameModal(false)
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
        reply = `[Claude 3.7 Fable]: Resposta gerada via SixtySix Gateway em 24ms. Tokens economizados com cota ilimitada.`
      } else if (selectedModel.includes('astra')) {
        reply = `[GPT Astra 6]: Processamento concluído com raciocínio profundo. Chaves ativas respondendo normalmente.`
      } else {
        reply = `[GLM-4 Plus]: Execução ultrarrápida via SixtySix. Custo total: R$ 0,00.`
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', text: reply }])
      setIsTyping(false)
    }, 700)
  }

  const periodOptions = ['Hoje', 'Esse Mês', 'Últimos 30 Dias', 'Último ano', 'Todo o Período', 'Personalizar']

  return (
    <div className="pc-dash-wrapper">
      {/* =========================================================================
          BANNER SUPERIOR DE STATUS DE ASSINATURA (Desktop & Mobile)
         ========================================================================= */}
      {!user?.hasActivePlan ? (
        <div className="pc-top-alert-banner is-free">
          <div className="pc-alert-left">
            <span className="pc-alert-icon">⚠️</span>
            <span className="pc-alert-badge">Modo de Teste / Gratuito</span>
            <span className="pc-alert-text">
              Sem assinatura ativa — Limite de <strong>1 chave de API</strong>. Assine para liberar chaves ilimitadas para Cursor, Claude Code CLI e VS Code.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('pix')}
            className="pc-alert-btn"
          >
            Ir para produção
          </button>
        </div>
      ) : (
        <div className="pc-top-alert-banner is-pro">
          <div className="pc-alert-left">
            <span className="pc-alert-icon">✨</span>
            <span className="pc-alert-badge">Assinatura Pro Ativa</span>
            <span className="pc-alert-text">
              Plano Pro ativo. Chaves de API ilimitadas e latência máxima de 24ms via SixtySix Gateway.
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSubscriptionPlan}
            className="pc-alert-btn-subtle"
            title="Clique para testar o comportamento de bloqueio do plano gratuito"
          >
            Simular Sem Plano
          </button>
        </div>
      )}

      {/* =========================================================================
          TOP HEADER BAR (Mobile & PC)
         ========================================================================= */}
      <header className="pc-top-header">
        <div className="pc-top-left">
          {/* Hambúrguer visível no Mobile */}
          <button
            type="button"
            className="pc-mobile-menu-btn"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} color="#f8fafc" />
          </button>

          <Link to="/" className="pc-header-logo-link">
            <img src="/assets/sidebar-logo.png" alt="SixtySix" className="pc-header-logo-img" />
            <span className="pc-header-logo-badge">Pay</span>
          </Link>

          {/* Breadcrumb de Página (PC) */}
          <div className="pc-header-breadcrumb">
            <Activity size={18} color="#9eea6c" />
            <span className="pc-breadcrumb-title">Dashboard</span>
          </div>
        </div>

        <div className="pc-top-right">
          {/* Alternador de Tema */}
          <button type="button" className="pc-header-icon-btn" title="Alternar tema">
            <Sun size={18} color="#94a3b8" />
          </button>

          {/* Sino de Notificações */}
          <button type="button" className="pc-header-icon-btn has-dot" title="Notificações">
            <Bell size={18} color="#94a3b8" />
            <span className="pc-bell-dot" />
          </button>

          {/* Perfil Compacto no Topo (Com o Nome Escolhido pelo Usuário) */}
          <div
            className="pc-header-user-pill"
            onClick={() => {
              setEditNameValue(user?.name || '')
              setShowEditNameModal(true)
            }}
            title="Clique para alterar seu nome de exibição"
          >
            <div className="pc-header-avatar-wrap">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="pc-header-avatar" />
              ) : (
                <div className="pc-header-avatar-fallback">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="pc-header-user-meta">
              <span className="pc-header-user-name">{user?.name || 'Desenvolvedor'}</span>
              <span className="pc-header-user-sub">
                {user?.hasActivePlan ? 'Pro' : 'Gratuito'}
              </span>
            </div>
            <Edit3 size={13} color="#64748b" className="pc-edit-icon" />
          </div>
        </div>
      </header>

      {/* =========================================================================
          BODY: SIDEBAR ESQUERDA + PAINEL PRINCIPAL COM BORDAS ARREDONDADAS
         ========================================================================= */}
      <div className="pc-dash-layout">
        {/* Backdrop para fechar o menu no Mobile */}
        <AnimatePresence>
          {mobileDrawerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pc-drawer-backdrop"
              onClick={() => setMobileDrawerOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* SIDEBAR (Desktop fixa + Mobile Drawer animado) */}
        <aside className={`pc-sidebar ${mobileDrawerOpen ? 'is-mobile-open' : ''}`}>
          {/* Header Mobile com botão Fechar */}
          <div className="pc-drawer-mobile-header">
            <div className="pc-header-logo-link">
              <img src="/assets/sidebar-logo.png" alt="SixtySix" className="pc-header-logo-img" />
              <span className="pc-header-logo-badge">Pay</span>
            </div>
            <button
              type="button"
              className="pc-drawer-close-btn"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <X size={20} color="#94a3b8" />
            </button>
          </div>

          {/* Card Seletor de Organização SixtySix (Bordas Arredondadas) */}
          <div className="pc-org-card">
            <div className="pc-org-icon-box">
              <Building2 size={18} color="#94a3b8" />
            </div>
            <div className="pc-org-details">
              <span className="pc-org-title">Sixtysix</span>
              <span className="pc-org-sub">
                {user?.hasActivePlan ? '69.864.497/0001-92' : 'Plano Gratuito (1 chave)'}
              </span>
            </div>
            <div className="pc-org-chevrons">
              <ChevronUp size={12} color="#64748b" />
              <ChevronDown size={12} color="#64748b" />
            </div>
          </div>

          {/* Lista de Navegação da Sidebar */}
          <div className="pc-sidebar-menu">
            {/* Item 1: Dashboard (Pill com Fundo Verde Neon Arredondado) */}
            <button
              type="button"
              className={`pc-nav-pill ${activeTab === 'overview' ? 'is-active-green' : ''}`}
              onClick={() => {
                setActiveTab('overview')
                setMobileDrawerOpen(false)
              }}
            >
              <Activity size={18} />
              <span>Dashboard</span>
            </button>

            {/* Grupo 1: Plataforma & Modelos ("Sua Loja" na referência) */}
            <div className="pc-nav-group">
              <button
                type="button"
                className="pc-group-header"
                onClick={() => setGroupStoreOpen(!groupStoreOpen)}
              >
                <div className="pc-group-title">
                  <Layers size={17} color="#94a3b8" />
                  <span>Sua Conta &amp; Chaves</span>
                </div>
                {groupStoreOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {groupStoreOpen && (
                <div className="pc-group-content">
                  <button
                    type="button"
                    className={`pc-sub-nav-item ${activeTab === 'keys' ? 'is-current' : ''}`}
                    onClick={() => {
                      setActiveTab('keys')
                      setMobileDrawerOpen(false)
                    }}
                  >
                    <Key size={16} />
                    <span>Chaves de API</span>
                    <span className="pc-keys-count-badge">
                      {keys.length}{!user?.hasActivePlan ? '/1' : ''}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`pc-sub-nav-item ${activeTab === 'ide' ? 'is-current' : ''}`}
                    onClick={() => {
                      setActiveTab('ide')
                      setMobileDrawerOpen(false)
                    }}
                  >
                    <Terminal size={16} />
                    <span>Conectar IDEs (Cursor)</span>
                  </button>

                  <button
                    type="button"
                    className={`pc-sub-nav-item ${activeTab === 'playground' ? 'is-current' : ''}`}
                    onClick={() => {
                      setActiveTab('playground')
                      setMobileDrawerOpen(false)
                    }}
                  >
                    <MessageSquare size={16} />
                    <span>Playground Oficial</span>
                  </button>

                  <button
                    type="button"
                    className={`pc-sub-nav-item ${activeTab === 'pix' ? 'is-current' : ''}`}
                    onClick={() => {
                      setActiveTab('pix')
                      setMobileDrawerOpen(false)
                    }}
                  >
                    <CreditCard size={16} />
                    <span>Assinatura &amp; Pix</span>
                  </button>
                </div>
              )}
            </div>

            {/* Grupo 2: Integração & Sandbox */}
            <div className="pc-nav-group">
              <button
                type="button"
                className="pc-group-header"
                onClick={() => setGroupIntegrationOpen(!groupIntegrationOpen)}
              >
                <div className="pc-group-title">
                  <Zap size={17} color="#94a3b8" />
                  <span>Integração</span>
                </div>
                {groupIntegrationOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {groupIntegrationOpen && (
                <div className="pc-group-content">
                  {/* Modo Teste Sandbox Switch (Idêntico ao print) */}
                  <div className="pc-sandbox-switch-row">
                    <div className="pc-sandbox-info">
                      <Sparkles size={16} color="#9eea6c" />
                      <span>Modo Teste (Sandbox)</span>
                    </div>
                    <label className="pc-toggle-wrap">
                      <input
                        type="checkbox"
                        checked={sandboxMode}
                        onChange={(e) => setSandboxMode(e.target.checked)}
                      />
                      <span className="pc-toggle-slider" />
                    </label>
                  </div>

                  {/* Alterar Como Ser Chamado */}
                  <button
                    type="button"
                    className="pc-sub-nav-item"
                    onClick={() => {
                      setEditNameValue(user?.name || '')
                      setShowEditNameModal(true)
                      setMobileDrawerOpen(false)
                    }}
                  >
                    <Edit3 size={16} />
                    <span>Alterar como sou chamado</span>
                  </button>

                  {/* Suporte WhatsApp */}
                  <a
                    href="https://wa.me/5584999999999?text=Ol%C3%A1%20SixtySix,%20preciso%20de%20ajuda%20com%20minha%20conta"
                    target="_blank"
                    rel="noreferrer"
                    className="pc-sub-nav-item"
                  >
                    <HelpCircle size={16} />
                    <span>Suporte</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Rodapé da Sidebar: Perfil do Usuário com o NOME ESCOLHIDO */}
          <div className="pc-sidebar-footer">
            <div
              className="pc-user-footer-card"
              onClick={() => {
                setEditNameValue(user?.name || '')
                setShowEditNameModal(true)
              }}
              title="Clique para alterar seu nome"
            >
              <div className="pc-user-footer-avatar-wrap">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="pc-user-footer-avatar" />
                ) : (
                  <div className="pc-user-footer-fallback">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="pc-footer-prov-badge">
                  {user?.provider === 'google' ? <GoogleIcon /> : <DiscordIcon />}
                </span>
              </div>

              <div className="pc-user-footer-meta">
                <span className="pc-user-footer-name">{user?.name || 'Desenvolvedor'}</span>
                <span className="pc-user-footer-sub">
                  {user?.customName ? 'Nome personalizado' : (user?.email || 'dev@sixtysix.online')}
                </span>
              </div>

              <button
                type="button"
                className="pc-footer-signout-btn"
                title="Desconectar"
                onClick={(e) => {
                  e.stopPropagation()
                  signOut()
                  navigate('/login')
                }}
              >
                <LogOut size={15} color="#94a3b8" />
              </button>
            </div>
          </div>
        </aside>

        {/* =======================================================================
            PAINEL PRINCIPAL DO DASHBOARD COM BORDAS SEMPRE ARREDONDADAS (24px)
           ======================================================================= */}
        <main className="pc-main-viewport">
          {/* O Card Maior de Conteúdo (Bordas sempre arredondadas: 24px) */}
          <div className="pc-large-rounded-container">
            {/* TAB 1: VISÃO GERAL (IDÊNTICO AO PRINT DO PC) */}
            {activeTab === 'overview' && (
              <div className="pc-content-flow">
                {/* 1. Barra de Período (Pills Arredondadas) + Status Demo */}
                <div className="pc-period-filter-row">
                  <div className="pc-pills-list">
                    {periodOptions.map((period) => (
                      <button
                        key={period}
                        type="button"
                        className={`pc-filter-pill ${selectedPeriod === period ? 'is-active' : ''}`}
                        onClick={() => setSelectedPeriod(period)}
                      >
                        {period}
                      </button>
                    ))}
                  </div>

                  <div className="pc-status-demo-tag">
                    <span className="pc-status-dot-pulse" />
                    <span>{sandboxMode ? 'Dados de demonstração' : 'Conexão Real SixtySix Gateway'}</span>
                  </div>
                </div>

                {/* 2. Card Hero Topo: Faturamento / Economia + MRR / Requisições (Bordas Arredondadas: 22px) */}
                <div className="pc-hero-stats-card">
                  {/* Coluna 1: Faturamento / Economia */}
                  <div className="pc-hero-col">
                    <div className="pc-hero-meta">
                      <span className="pc-hero-label">Faturamento</span>
                      <div className="pc-hero-amount">
                        R$ <strong>3.500</strong>,00
                        <span className="pc-hero-trend">↗ 5%</span>
                      </div>
                    </div>
                    <div className="pc-hero-illustration">
                      <MoneyPedestalIcon />
                    </div>
                  </div>

                  {/* Divisória Vertical Sutil */}
                  <div className="pc-hero-col-divider" />

                  {/* Coluna 2: MRR / Cotas */}
                  <div className="pc-hero-col">
                    <div className="pc-hero-meta">
                      <div className="pc-label-with-hint">
                        <span className="pc-hero-label">MRR</span>
                        <HelpCircle size={14} color="#64748b" />
                      </div>
                      <div className="pc-hero-amount">
                        R$ <strong>3.500</strong>,00
                        <span className="pc-hero-trend">↗ 5%</span>
                      </div>
                    </div>
                    <div className="pc-hero-illustration">
                      <CalendarPedestalIcon />
                    </div>
                  </div>
                </div>

                {/* 3. Card de Métricas em Linha: 5 Itens (Bordas Arredondadas: 20px) */}
                <div className="pc-metric-strip-card">
                  {/* Item 1: Total de transações */}
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <Coins size={16} color="#94a3b8" />
                      <span>Total de transações</span>
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">10</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  {/* Item 2: Novas */}
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <ArrowUpRight size={16} color="#94a3b8" />
                      <span>Novas</span>
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">5</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  {/* Item 3: Renovações */}
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <Clock size={16} color="#94a3b8" />
                      <span>Renovações</span>
                      <HelpCircle size={12} color="#64748b" />
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">6</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  {/* Item 4: Ticket Médio */}
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <DollarSign size={16} color="#94a3b8" />
                      <span>Ticket Médio</span>
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">R$ 350,00</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  {/* Item 5: Churn */}
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <TrendingDown size={16} color="#94a3b8" />
                      <span>Churn</span>
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">25%</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>
                </div>

                {/* 4. Segundo Card de Métricas: Modelos e Desempenho (Bordas Arredondadas: 20px) */}
                <div className="pc-metric-strip-card">
                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <CreditCard size={16} color="#94a3b8" />
                      <span>Conversão no cartão</span>
                      <HelpCircle size={12} color="#64748b" />
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">85%</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <ShieldCheck size={16} color="#94a3b8" />
                      <span>Aprovação por tentativa</span>
                      <HelpCircle size={12} color="#64748b" />
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">73,91%</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <Clock size={16} color="#94a3b8" />
                      <span>Salvas após recusa</span>
                      <HelpCircle size={12} color="#64748b" />
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">5</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>

                  <div className="pc-strip-divider" />

                  <div className="pc-strip-item">
                    <div className="pc-strip-header">
                      <X size={16} color="#94a3b8" />
                      <span>Vendas perdidas</span>
                      <HelpCircle size={12} color="#64748b" />
                    </div>
                    <div className="pc-strip-val-wrap">
                      <strong className="pc-strip-val">6</strong>
                      <span className="pc-strip-trend">↗ 5%</span>
                    </div>
                  </div>
                </div>

                {/* 5. Seção de Chaves de API com Validação de Plano (Bordas Arredondadas: 20px) */}
                <div className="pc-keys-section-box">
                  <div className="pc-keys-box-header">
                    <div>
                      <h3 className="pc-box-title">Chaves de API para IDEs</h3>
                      <p className="pc-box-desc">
                        {user?.hasActivePlan
                          ? 'Sua assinatura Pro permite chaves ilimitadas para conectar no Cursor, Claude Code CLI e VS Code.'
                          : 'Plano gratuito ativo: limite de 1 chave de API. Faça upgrade para gerar mais chaves.'}
                      </p>
                    </div>

                    <div className="pc-keys-box-actions">
                      <span className={`pc-plan-status-badge ${user?.hasActivePlan ? 'is-pro' : 'is-free'}`}>
                        {user?.hasActivePlan ? 'Chaves Ilimitadas (Pro)' : `${keys.length} de 1 Chave em Uso`}
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="pc-add-key-btn"
                      >
                        <Plus size={16} />
                        <span>Criar Chave</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de Chaves Criadas */}
                  <div className="pc-keys-grid">
                    {loadingKeys ? (
                      <div className="pc-empty-keys">Carregando chaves...</div>
                    ) : keys.length === 0 ? (
                      <div className="pc-empty-keys">
                        <Key size={36} color="#64748b" />
                        <p>Nenhuma chave criada ainda. Crie sua primeira chave para conectar sua IDE.</p>
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="pc-add-key-btn"
                        >
                          Criar Minha Primeira Chave
                        </button>
                      </div>
                    ) : (
                      keys.map((k) => (
                        <div key={k.id} className="pc-single-key-card">
                          <div className="pc-key-top">
                            <span className="pc-key-title">{k.name}</span>
                            <span className="pc-key-active-dot">Ativa</span>
                          </div>

                          <div className="pc-key-code-wrap">
                            <code>{k.key_prefix}••••••••••••</code>
                            <button
                              type="button"
                              onClick={() => handleCopy(k.key_prefix, k.id)}
                              className="pc-key-copy-action"
                              title="Copiar chave"
                            >
                              {copiedKeyId === k.id ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                            </button>
                          </div>

                          <div className="pc-key-bottom">
                            <span className="pc-key-created-date">
                              Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRevokeKey(k.id)}
                              className="pc-key-delete-btn"
                              title="Revogar chave"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GERENCIAMENTO DE CHAVES DE API */}
            {activeTab === 'keys' && (
              <div className="pc-content-flow">
                <div className="pc-keys-box-header">
                  <div>
                    <h2 className="pc-tab-main-title">Chaves de API Oficiais</h2>
                    <p className="pc-box-desc">
                      Gerencie suas chaves para autenticar extensões no Cursor, Claude Code CLI e VS Code.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="pc-add-key-btn"
                  >
                    <Plus size={16} />
                    <span>Criar Nova Chave</span>
                  </button>
                </div>

                {!user?.hasActivePlan && (
                  <div className="pc-upgrade-warning-card">
                    <Lock size={22} color="#f59e0b" />
                    <div className="pc-upgrade-text">
                      <strong>Limite de 1 Chave no Plano Gratuito</strong>
                      <p>
                        Para ter chaves individuais em múltiplos computadores e IDEs diferentes sem deslogar, ative seu plano Pro via Pix!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('pix')}
                      className="pc-upgrade-card-btn"
                    >
                      Assinar Plano Pro (R$ 49/mês)
                    </button>
                  </div>
                )}

                <div className="pc-keys-grid">
                  {keys.map((k) => (
                    <div key={k.id} className="pc-single-key-card">
                      <div className="pc-key-top">
                        <span className="pc-key-title">{k.name}</span>
                        <span className="pc-key-active-dot">Ativa</span>
                      </div>
                      <div className="pc-key-code-wrap">
                        <code>{k.key_prefix}••••••••••••</code>
                        <button
                          type="button"
                          onClick={() => handleCopy(k.key_prefix, k.id)}
                          className="pc-key-copy-action"
                        >
                          {copiedKeyId === k.id ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <div className="pc-key-bottom">
                        <span className="pc-key-created-date">
                          Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k.id)}
                          className="pc-key-delete-btn"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CONECTAR NA IDE */}
            {activeTab === 'ide' && (
              <div className="pc-content-flow">
                <h2 className="pc-tab-main-title">Conectar na sua IDE Favorita</h2>
                <p className="pc-box-desc">
                  Utilize sua chave SixtySix em qualquer ferramenta com suporte OpenAI ou Anthropic API.
                </p>

                <div className="pc-ide-options-grid">
                  {/* Cursor */}
                  <div className="pc-ide-card">
                    <div className="pc-ide-card-head">
                      <h3>Cursor IDE</h3>
                      <span className="pc-ide-pill">Mais Usado</span>
                    </div>
                    <p className="pc-ide-instructions">
                      Vá em <strong>Settings &gt; Models &gt; OpenAI API Key</strong>:
                    </p>
                    <div className="pc-ide-codeblock">
                      <div className="pc-code-line">
                        <span>Base URL:</span>
                        <code>https://api.sixtysix.online/v1</code>
                      </div>
                      <div className="pc-code-line">
                        <span>API Key:</span>
                        <code>{keys[0]?.key_prefix ? `${keys[0].key_prefix}••••••` : 'sk-live-66-xxxx'}</code>
                      </div>
                    </div>
                  </div>

                  {/* Claude Code CLI */}
                  <div className="pc-ide-card">
                    <div className="pc-ide-card-head">
                      <h3>Claude Code CLI</h3>
                      <span className="pc-ide-pill">Terminal Oficial</span>
                    </div>
                    <p className="pc-ide-instructions">
                      No terminal, configure as variáveis de ambiente antes de iniciar:
                    </p>
                    <div className="pc-ide-codeblock">
                      <code>
                        export ANTHROPIC_BASE_URL=https://api.sixtysix.online/v1<br />
                        export ANTHROPIC_API_KEY={keys[0]?.key_prefix ? `${keys[0].key_prefix}••••••` : 'sk-live-66-xxxx'}<br />
                        claude
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PLAYGROUND */}
            {activeTab === 'playground' && (
              <div className="pc-content-flow">
                <div className="pc-playground-box">
                  <div className="pc-playground-header">
                    <div>
                      <h2 className="pc-tab-main-title">Playground Oficial</h2>
                      <p className="pc-box-desc">
                        Faça perguntas e teste a velocidade de resposta em tempo real.
                      </p>
                    </div>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="pc-model-dropdown"
                    >
                      <option value="claude-fable-5.1">Claude 3.7 Fable (Codificação)</option>
                      <option value="gpt-astra-6">GPT Astra 6 (Raciocínio &amp; Visão)</option>
                      <option value="glm-4-plus">GLM-4 Plus (Velocidade Extrema)</option>
                    </select>
                  </div>

                  <div className="pc-chat-stream">
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className={`pc-chat-row is-${m.role}`}>
                        <div className="pc-chat-avatar">
                          {m.role === 'assistant' ? <Bot size={16} /> : <UserIcon size={16} />}
                        </div>
                        <div className="pc-chat-bubble">
                          <span className="pc-chat-author">
                            {m.role === 'assistant' ? 'SixtySix Gateway' : (user?.name || 'Você')}
                          </span>
                          <p className="pc-chat-text">{m.text}</p>
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="pc-chat-typing-row">
                        <span className="pc-status-dot-pulse" />
                        <span>Processando no gateway em 24ms...</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendMessage} className="pc-chat-input-bar">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Envie seu prompt ou dúvida para os modelos..."
                      className="pc-chat-field"
                    />
                    <button type="submit" disabled={isTyping || !chatInput.trim()} className="pc-chat-send-btn">
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 5: ASSINATURA & PIX */}
            {activeTab === 'pix' && (
              <div className="pc-content-flow">
                <div className="pc-pix-panel">
                  <div className="pc-pix-top">
                    <span className="pc-pix-plan-pill">Plano Desenvolvedor Pro</span>
                    <h2 className="pc-pix-price">R$ 49,00 <span className="pc-pix-mo">/ mês</span></h2>
                    <p className="pc-box-desc">
                      Acesso completo e ilimitado aos três modelos sem cartão de crédito internacional e sem surpresas.
                    </p>
                  </div>

                  <div className="pc-pix-grid">
                    <div className="pc-pix-qr-container">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          pixCopyCode
                        )}`}
                        alt="QR Code Pix"
                        className="pc-pix-qr-img"
                      />
                      <span className="pc-pix-qr-sub">Abra o app do seu banco e aponte a câmera</span>
                    </div>

                    <div className="pc-pix-info-container">
                      <label className="pc-pix-copy-label">Chave Pix Copia e Cola:</label>
                      <div className="pc-pix-input-row">
                        <input type="text" readOnly value={pixCopyCode} className="pc-pix-copy-input" />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pixCopyCode)
                            setPixCopied(true)
                            setTimeout(() => setPixCopied(false), 2500)
                          }}
                          className="pc-pix-copy-btn"
                        >
                          {pixCopied ? <Check size={16} color="#22c55e" /> : <Copy size={16} />}
                          <span>{pixCopied ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                      </div>

                      <div className="pc-pix-action-box">
                        <button
                          type="button"
                          onClick={() => {
                            toggleSubscriptionPlan()
                            alert(
                              user?.hasActivePlan
                                ? 'Plano alterado para Gratuito (você pode testar o bloqueio de 1 chave).'
                                : 'Assinatura Pro confirmada com sucesso! Chaves de API ilimitadas liberadas.'
                            )
                          }}
                          className="pc-confirm-payment-btn"
                        >
                          <Zap size={16} />
                          <span>
                            {user?.hasActivePlan
                              ? 'Simular Desativação de Plano (Modo Sandbox)'
                              : 'Confirmar Pagamento Pix (Ativar Pro)'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* =========================================================================
          MODAL: LIMITE DE CHAVES ATINGIDO (Para quem não tem plano ativo)
         ========================================================================= */}
      <AnimatePresence>
        {showLimitModal && (
          <div className="pc-modal-backdrop" onClick={() => setShowLimitModal(false)}>
            <motion.div
              className="pc-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
            >
              <div className="pc-modal-head">
                <div className="pc-modal-badge is-amber">
                  <Lock size={15} color="#f59e0b" />
                  <span>Limite do Plano Gratuito</span>
                </div>
                <button
                  type="button"
                  className="pc-modal-close"
                  onClick={() => setShowLimitModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="pc-modal-title">Você já possui 1 chave de API ativa</h3>
              <p className="pc-modal-desc">
                No plano gratuito ou sem assinatura ativa, cada desenvolvedor pode ter até <strong>1 chave de API</strong>. Para conectar diferentes IDEs simultaneamente (Cursor, Claude Code CLI, Cline, VS Code), assine o Plano Pro!
              </p>

              <div className="pc-modal-features">
                <div className="pc-feat-row">
                  <Check size={16} color="#22c55e" />
                  <span>Chaves de API ilimitadas para todas as suas IDEs</span>
                </div>
                <div className="pc-feat-row">
                  <Check size={16} color="#22c55e" />
                  <span>Acesso irrestrito ao Claude 3.7 Fable, GPT Astra e GLM-4</span>
                </div>
                <div className="pc-feat-row">
                  <Check size={16} color="#22c55e" />
                  <span>Latência ultrabaixa de 24ms via SixtySix Gateway</span>
                </div>
              </div>

              <div className="pc-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowLimitModal(false)
                    setActiveTab('pix')
                  }}
                  className="pc-primary-action-btn"
                >
                  <span>Ativar Assinatura Pro via Pix (R$ 49/mês)</span>
                  <ArrowUpRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleSubscriptionPlan()
                    setShowLimitModal(false)
                    setShowCreateModal(true)
                  }}
                  className="pc-subtle-action-btn"
                >
                  Simular Ativação Imediata (Modo Sandbox)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: CRIAR NOVA CHAVE DE API
         ========================================================================= */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="pc-modal-backdrop" onClick={() => setShowCreateModal(false)}>
            <motion.div
              className="pc-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
            >
              <div className="pc-modal-head">
                <h3 className="pc-modal-title">Criar Nova Chave de API</h3>
                <button
                  type="button"
                  className="pc-modal-close"
                  onClick={() => {
                    setShowCreateModal(false)
                    setJustCreatedKey(null)
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {justCreatedKey ? (
                <div className="pc-key-created-box">
                  <div className="pc-success-pill">
                    <Check size={18} color="#22c55e" />
                    <span>Chave criada com sucesso!</span>
                  </div>
                  <p className="pc-created-warning">
                    Copie sua chave agora. Por segurança, você não poderá vê-la novamente por completo.
                  </p>
                  <div className="pc-revealed-key-row">
                    <code>{justCreatedKey}</code>
                    <button
                      type="button"
                      onClick={() => handleCopy(justCreatedKey, 'created')}
                      className="pc-key-copy-action"
                    >
                      {copiedKeyId === 'created' ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setJustCreatedKey(null)
                    }}
                    className="pc-primary-action-btn is-full"
                  >
                    Concluído
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateKey} className="pc-modal-form">
                  <label className="pc-modal-label">Nome da Chave / Identificação:</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Ex: Cursor MacBook Pro, Claude CLI Terminal..."
                    className="pc-modal-input"
                  />
                  <div className="pc-modal-actions">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="pc-subtle-action-btn"
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="pc-primary-action-btn">
                      Gerar Chave
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL: ALTERAR COMO GOSTARIA DE SER CHAMADO
         ========================================================================= */}
      <AnimatePresence>
        {showEditNameModal && (
          <div className="pc-modal-backdrop" onClick={() => setShowEditNameModal(false)}>
            <motion.div
              className="pc-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
            >
              <div className="pc-modal-head">
                <h3 className="pc-modal-title">Como gostaria de ser chamado?</h3>
                <button
                  type="button"
                  className="pc-modal-close"
                  onClick={() => setShowEditNameModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <p className="pc-modal-desc">
                Em vez de exibir o nome completo ou tag original da sua conta do Google ou Discord, digite o nome que você prefere ver no cabeçalho e em toda a plataforma.
              </p>

              <form onSubmit={handleSaveChosenName} className="pc-modal-form">
                <label className="pc-modal-label">Seu nome preferido:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={30}
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="Ex: Alysson, Neo, DevMax..."
                  className="pc-modal-input"
                />

                <div className="pc-modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowEditNameModal(false)}
                    className="pc-subtle-action-btn"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="pc-primary-action-btn">
                    Salvar Nome
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
