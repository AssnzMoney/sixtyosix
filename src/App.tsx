import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import HomePage from './pages/HomePage'
import ClaudeCodePage from './pages/ClaudeCode'
import GptAstraPage from './pages/GptAstra'
import Glm4Page from './pages/Glm4'
import LoginPage from './pages/LoginPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
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
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  )
}
