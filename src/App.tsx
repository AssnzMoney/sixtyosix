import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import HomePage from './pages/HomePage'
import ClaudeCodePage from './pages/ClaudeCode'
import GptAstraPage from './pages/GptAstra'
import Glm4Page from './pages/Glm4'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import DashboardPage from './pages/DashboardPage'
import OnboardingPage from './pages/OnboardingPage'
import TrialPage from './pages/TrialPage'
import CheckoutPage from './pages/CheckoutPage'
import SubscriptionPage from './pages/SubscriptionPage'
import AdminPage from './pages/AdminPage'
import { captureReferral, claimReferral } from './lib/referral'

function ScrollToTop() {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (hash) {
      let anchor: string
      try { anchor = decodeURIComponent(hash.slice(1)) } catch { return }
      const frame = requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
      return () => cancelAnimationFrame(frame)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash, key])
  return null
}

/** Link de afiliado (?ref=): guarda o código e, com a conta aberta, liga a conta ao afiliado. */
function ReferralTracker() {
  const { search } = useLocation()
  const { session } = useAuth()
  useEffect(() => { captureReferral(search) }, [search])
  useEffect(() => { if (session?.access_token) void claimReferral(session.access_token) }, [session?.access_token])
  return null
}

function AccountRoute({ onboarding = false }: { onboarding?: boolean }) {
  const { session, user, loading } = useAuth()
  const demo = ['localhost','127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('demo') === '1'
  if (loading) return <div className="six-auth-loading" role="status">Carregando sua conta…</div>
  if (!session && !demo) return <Navigate to="/login" replace />
  if (session && !onboarding && !user?.hasCompletedOnboarding) return <Navigate to="/onboarding" replace />
  return onboarding ? <OnboardingPage /> : <DashboardPage />
}
export default function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <ReferralTracker />
        <Routes>
          {/* Endereço do admin difícil de adivinhar; /admin e /administracao não existem mais. */}
          <Route path="/adminxv1" element={<AdminPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/planos" element={<Navigate to="/#planos" replace />} />
          <Route path="/teste-gratis" element={<TrialPage />} />
          <Route path="/comprar/:plan" element={<CheckoutPage />} />
          <Route path="/assinatura" element={<SubscriptionPage />} />
          <Route path="/claude-code" element={<ClaudeCodePage />} />
          <Route path="/astra-6" element={<GptAstraPage />} />
          <Route path="/gpt-astra" element={<GptAstraPage />} />
          <Route path="/glm-4" element={<Glm4Page />} />
          <Route path="/glm" element={<Glm4Page />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/criar-conta" element={<Navigate to="/login?mode=cadastro" replace />} />
          <Route path="/cadastro" element={<Navigate to="/login?mode=cadastro" replace />} />
          
          {/* Conta privada: a API valida novamente a sessão e o proprietário. */}
          <Route
            path="/onboarding"
            element={<AccountRoute onboarding />}
          />
          <Route
            path="/dashboard"
            element={<AccountRoute />}
          />
          <Route
            path="/app"
            element={<AccountRoute />}
          />
          <Route
            path="/plataforma"
            element={<AccountRoute />}
          />

          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
