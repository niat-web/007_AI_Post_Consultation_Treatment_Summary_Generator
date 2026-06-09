import { NavLink } from 'react-router-dom'
import type { BackendStatus } from '../types'
import { API_URL } from '../api'

type HeaderProps = {
  backendStatus: BackendStatus
}

export default function Header({ backendStatus }: HeaderProps) {
  return (
    <header className="no-print flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
      <div>
        <p className="text-teal-600 text-[11px] font-bold tracking-[1.5px] uppercase mb-1">AI Post-Consultation System</p>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Ayurdha Clinics</h1>
      </div>

      <nav className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1">
        <NavLink to="/" end
          className={({ isActive }) => `px-4 py-2 rounded-md text-sm font-semibold transition-all ${isActive ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          Consultation Workspace
        </NavLink>
        <NavLink to="/analytics"
          className={({ isActive }) => `px-4 py-2 rounded-md text-sm font-semibold transition-all ${isActive ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          Admin Analytics
        </NavLink>
      </nav>

      <div className={`flex items-center gap-3 px-4 py-2 border rounded-lg bg-white shadow-sm text-sm ${backendStatus === 'connected' ? 'border-emerald-200' : backendStatus === 'disconnected' ? 'border-red-200' : 'border-amber-200'}`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${backendStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.2)]' : backendStatus === 'disconnected' ? 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.2)]' : 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.2)]'}`} />
        <div>
          <strong className="block text-slate-800 leading-tight">{backendStatus === 'connected' ? 'System connected' : backendStatus === 'disconnected' ? 'Connection lost' : 'Locating system'}</strong>
          <code className="text-slate-400 text-[11px]">{API_URL}</code>
        </div>
      </div>
    </header>
  )
}
