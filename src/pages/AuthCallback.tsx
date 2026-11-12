import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { accountDestination } from '../lib/authDestination'
import { Loader2, AlertCircle } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { session, user, loading } = useAuth()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (session && user) {
      navigate(accountDestination(user.hasCompletedOnboarding), { replace: true })
    } else {
      // O Google, o Discord ou o Supabase mandam o motivo na URL (?error_description=… ou #error_description=…).
      const params = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const reason = params.get('error_description') || hash.get('error_description') || params.get('error') || hash.get('error')
      setErrorMsg(
        reason
          ? `Não foi possível concluir o login: ${reason.replace(/\+/g, ' ').slice(0, 200)}. Volte e tente novamente.`
          : 'Não foi possível concluir o login. Volte e tente novamente.',
      )
    }
  }, [loading, session, user, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e1117',
      color: '#f8fafc',
      padding: '24px',
      fontFamily: 'Manrope, sans-serif'
    }}>
      {errorMsg ? (
        <div style={{
          background: '#161c24',
          border: '1.5px solid #ef4444',
          padding: '32px',
          borderRadius: '20px',
          maxWidth: '420px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
        }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            Erro de Autenticação
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              borderRadius: '9999px',
              background: '#9eea6c',
              color: '#0e1117',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Voltar para o login
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: '#161c24',
            border: '1.5px solid #232d3b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
          }}>
            <Loader2 size={30} color="#9eea6c" className="animate-spin" />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
            Conectando com segurança...
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            Validando suas credenciais oficiais SixtySix.
          </p>
        </div>
      )}
    </div>
  )
}
