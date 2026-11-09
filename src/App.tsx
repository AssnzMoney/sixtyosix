import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './lib/AuthContext'
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
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/plataforma" element={<DashboardPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
