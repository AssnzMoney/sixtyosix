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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AccountRoute({ onboarding = false }: { onboarding?: boolean }) {
  const { session, loading } = useAuth()
  const demo = ['localhost','127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('demo') === '1'
  if (loading) return <div className="six-auth-loading" role="status">Carregando sua conta…</div>
  if (!session && !demo) return <Navigate to="/login" replace />
  return onboarding ? <OnboardingPage /> : <DashboardPage />
}
export default function App() {

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/claude-code" element={<ClaudeCodePage />} />
          <Route path="/astra-6" element={<GptAstraPage />} />
          <Route path="/gpt-astra" element={<GptAstraPage />} />
          <Route path="/glm-4" element={<Glm4Page />} />
          <Route path="/glm" element={<Glm4Page />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          
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
