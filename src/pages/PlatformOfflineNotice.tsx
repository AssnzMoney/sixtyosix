import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, ArrowLeft, ShieldAlert, Sparkles, Terminal } from 'lucide-react'

export default function PlatformOfflineNotice() {
  return (
    <div className="onboarding-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
      <img
        src="/assets/login-bottom-glow.webp"
        alt=""
        className="onboarding-bottom-glow"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="pc-modal-card"
        style={{ maxWidth: '520px', textAlign: 'center' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img src="/assets/sidebar-logo.png" alt="SixtySix" style={{ height: '38px', width: 'auto', display: 'inline-block' }} />
        </div>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Lock size={26} color="#f59e0b" />
        </div>

        <span style={{
          display: 'inline-block',
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '4px 12px',
          borderRadius: '9999px',
          marginBottom: '12px'
        }}>
          Acesso Restrito • Ambiente Local
        </span>

        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          Plataforma fora do ar em produção
        </h1>

        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
          O acesso à dashboard e gerenciamento de chaves da SixtySix foi retirado do ar temporariamente e está ativo <strong>apenas em localhost</strong> para testes internos e homologação do gateway.
        </p>

        <div style={{
          background: '#090c12',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '16px',
          padding: '14px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9eea6c', fontWeight: 700, marginBottom: '6px' }}>
            <Terminal size={14} />
            <span>Como acessar em desenvolvimento:</span>
          </div>
          <code style={{ fontSize: '12px', color: '#cbd5e1', fontFamily: 'monospace', display: 'block' }}>
            http://localhost:5173/dashboard
          </code>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Link
            to="/"
            className="pc-primary-action-btn"
            style={{ textDecoration: 'none', justifyContent: 'center' }}
          >
            <ArrowLeft size={16} />
            <span>Voltar para a Página Inicial</span>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
