import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { Loader2, AlertCircle } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function handleAuth() {
      if (!supabase || !isSupabaseConfigured) {
        navigate('/')
        return
      }

      try {
        // Supabase processa automaticamente hash/tokens no browser
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          setErrorMsg(error.message)
          return
        }

        if (data?.session) {
          navigate('/')
        } else {
          // Aguarda brevemente se o hash ainda estiver sendo parseado
          const timeout = setTimeout(() => {
            navigate('/')
          }, 1500)
          return () => clearTimeout(timeout)
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Falha ao autenticar com o provedor.')
      }
    }

    handleAuth()
  }, [navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fbfcfb',
      padding: '24px',
      fontFamily: 'Manrope, sans-serif'
    }}>
      {errorMsg ? (
        <div style={{
          background: '#fff',
          border: '1.5px solid #fee2e2',
          padding: '32px',
          borderRadius: '20px',
          maxWidth: '420px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
        }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1f4647', marginBottom: '8px' }}>
            Erro de Autenticação
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
            {errorMsg}
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 24px',
              borderRadius: '9999px',
              background: '#1f4647',
              color: '#ffffff',
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
            background: '#ffffff',
            border: '1.5px solid #eef2f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
          }}>
            <Loader2 size={30} color="#1f4647" className="animate-spin" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1f4647', marginBottom: '8px' }}>
            Conectando à SixtySix...
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            Validando sua sessão com o provedor OAuth.
          </p>
        </div>
      )}
    </div>
  )
}

