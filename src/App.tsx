import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './lib/AuthContext'
import { isLocalhost } from './lib/isLocalhost'
import HomePage from './pages/HomePage'
import ClaudeCodePage from './pages/ClaudeCode'
import GptAstraPage from './pages/GptAstra'
import Glm4Page from './pages/Glm4'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import DashboardPage from './pages/DashboardPage'
import OnboardingPage from './pages/OnboardingPage'
import PlatformOfflineNotice from './pages/PlatformOfflineNotice'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const localEnv = isLocalhost()

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
          
          {/* Rotas da Plataforma: liberadas estritamente em localhost */}
          <Route
            path="/onboarding"
            element={localEnv ? <OnboardingPage /> : <PlatformOfflineNotice />}
          />
          <Route
            path="/dashboard"
            element={localEnv ? <DashboardPage /> : <PlatformOfflineNotice />}
          />
          <Route
            path="/app"
            element={localEnv ? <DashboardPage /> : <PlatformOfflineNotice />}
          />
          <Route
            path="/plataforma"
            element={localEnv ? <DashboardPage /> : <PlatformOfflineNotice />}
          />

          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
