import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { BackendStatus } from './types'
import { apiRequest } from './api'
import Header from './components/Header'
import ConsultationWorkspace from './pages/ConsultationWorkspace'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import './index.css'

export default function App() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')

  useEffect(() => {
    void checkBackendHealth()
    const id = window.setInterval(() => void checkBackendHealth(), 15000)
    return () => window.clearInterval(id)
  }, [])

  async function checkBackendHealth() {
    try {
      const data = await apiRequest<{ status: string }>('/api/health')
      setBackendStatus(data.status === 'ok' ? 'connected' : 'disconnected')
    } catch { setBackendStatus('disconnected') }
  }

  return (
    <BrowserRouter>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 font-[Inter,system-ui,sans-serif]">
        <Header backendStatus={backendStatus} />
        <Routes>
          <Route path="/" element={<ConsultationWorkspace />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
