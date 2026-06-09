import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    void loadAnalytics()
  }, [])

  async function loadAnalytics() {
    setIsLoadingAnalytics(true)
    setError('')
    try {
      const data = await apiRequest<any>('/api/admin/analytics')
      setAnalyticsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics')
    } finally { setIsLoadingAnalytics(false) }
  }

  async function handleDeleteConsultation(id: number) {
    if (!window.confirm(`Delete consultation #${id}? This cannot be undone.`)) return
    setDeletingId(id)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/api/history/${id}`, { method: 'DELETE' })
      setNotice(`Consultation #${id} deleted successfully`)
      await loadAnalytics()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete consultation')
    } finally { setDeletingId(null) }
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
    setSortConfig({ key, direction })
  }

  const sortedRecords = useMemo(() => {
    if (!analyticsData?.records) return []
    const items = [...analyticsData.records]
    if (sortConfig) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key], bVal = b[sortConfig.key]
        if (sortConfig.key === 'created_at') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
        if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1
        if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1
        if (typeof aVal === 'string' && typeof bVal === 'string')
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
      })
    }
    return items
  }, [analyticsData?.records, sortConfig])

  function renderSortArrow(key: string) {
    if (!sortConfig || sortConfig.key !== key) return <span className="ml-1 text-slate-400 text-xs opacity-60">↕</span>
    return sortConfig.direction === 'asc'
      ? <span className="ml-1 text-teal-600 text-xs font-bold">▲</span>
      : <span className="ml-1 text-teal-600 text-xs font-bold">▼</span>
  }

  function renderStars(rating: number) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`text-2xl leading-none ${star <= rating ? 'text-amber-400' : 'text-slate-300'}`}>★</span>
        ))}
      </div>
    )
  }

  return (
    <section className="no-print animate-fade-in">
      {error && <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">{error}</div>}
      {notice && <div className="mb-5 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">{notice}</div>}
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-teal-600 text-[11px] font-bold tracking-[1.5px] uppercase mb-1">Overview</p>
          <h2 className="text-2xl font-extrabold text-slate-900 m-0">Clinic Analytics Dashboard</h2>
        </div>
        <button type="button" className="bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg font-semibold text-[13px] hover:bg-slate-50 hover:border-slate-400 transition-all" onClick={loadAnalytics} disabled={isLoadingAnalytics}>{isLoadingAnalytics ? 'Refreshing...' : '🔄 Refresh Data'}</button>
      </div>

      {isLoadingAnalytics && !analyticsData ? (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-slate-500 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">Loading dashboard analytics data...</div>
      ) : analyticsData ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <span className="block text-[13px] font-bold uppercase tracking-[0.5px] text-slate-500 mb-2">Total Summaries Generated</span>
              <span className="inline-block text-4xl font-[850] text-slate-900 leading-tight mb-1.5">{analyticsData.total_generations}</span>
              <span className="block text-xs text-slate-500">Consultation records converted to patient summaries</span>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <span className="block text-[13px] font-bold uppercase tracking-[0.5px] text-slate-500 mb-2">Average Patient Rating</span>
              <div className="flex items-baseline gap-1">
                <span className="inline-block text-4xl font-[850] text-slate-900 leading-tight mb-1.5">{analyticsData.average_rating}</span>
                <span className="text-slate-500 text-base font-semibold">/ 5</span>
              </div>
              <div className="mb-2">{renderStars(Math.round(analyticsData.average_rating))}</div>
              <span className="block text-xs text-slate-500">Based on direct post-consultation star ratings</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <h3 className="text-base font-[750] text-slate-900 mb-1">Summaries by Medical Speciality</h3>
              <p className="text-xs text-slate-500 mb-5">Distribution of summaries generated across clinical departments</p>
              
              <div className="flex flex-col gap-4">
                {analyticsData.speciality_distribution?.length > 0 ? (
                  analyticsData.speciality_distribution.map((item: any, idx: number) => {
                    const pct = Math.round((item.count / (analyticsData.total_generations || 1)) * 100);
                    return (
                      <div className="flex flex-col gap-1.5" key={idx}>
                        <div className="flex justify-between text-[13px] font-semibold">
                          <span className="text-slate-900">{item.speciality}</span>
                          <span className="text-teal-600">{item.count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-teal-600 to-teal-500 rounded-full transition-[width] duration-600 ease-out" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center text-slate-500 p-6">No speciality statistics recorded yet.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
              <h3 className="text-base font-[750] text-slate-900 mb-1">Daily Patient Feedback Log</h3>
              <p className="text-xs text-slate-500 mb-5">Log of average ratings received per day</p>

              <div className="w-full overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="p-2.5 px-3 text-[13px] font-bold text-slate-900 bg-slate-50 border-b border-slate-200">Date</th>
                      <th className="p-2.5 px-3 text-[13px] font-bold text-slate-900 bg-slate-50 border-b border-slate-200">Ratings Count</th>
                      <th className="p-2.5 px-3 text-[13px] font-bold text-slate-900 bg-slate-50 border-b border-slate-200">Average Rating</th>
                      <th className="p-2.5 px-3 text-[13px] font-bold text-slate-900 bg-slate-50 border-b border-slate-200">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.ratings_per_day?.length > 0 ? (
                      analyticsData.ratings_per_day.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2.5 px-3 text-[13px] border-b border-slate-200">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td className="p-2.5 px-3 text-[13px] border-b border-slate-200">{item.count} feedbacks</td>
                          <td className="p-2.5 px-3 text-[13px] border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{item.average_rating}</span>
                              {renderStars(Math.round(item.average_rating))}
                            </div>
                          </td>
                          <td className="p-2.5 px-3 text-[13px] border-b border-slate-200">
                            <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full ${item.average_rating >= 4 ? 'bg-emerald-50 text-emerald-700' : item.average_rating >= 3 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-700'}`}>
                              {item.average_rating >= 4.5 ? 'Excellent' : item.average_rating >= 4 ? 'Very Good' : item.average_rating >= 3 ? 'Satisfactory' : 'Needs Attention'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={4} className="text-center text-slate-500 p-6 border-b border-slate-200">No feedback logged yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-10 bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="mb-5">
              <h3 className="text-lg font-[750] text-slate-900 m-0 mb-1">All Consultations Registry</h3>
              <p className="text-xs text-slate-500">Double-click any record to open and edit it in the Consultation Workspace. Click column headers to sort.</p>
            </div>
            <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden w-full overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr>
                    {(['id', 'patient_name', 'speciality', 'age', 'created_at', 'rating'] as const).map(k => (
                      <th key={k} className="p-3 px-4 font-bold text-slate-900 bg-slate-50 border-b border-slate-200 cursor-pointer select-none transition-colors hover:bg-slate-100" onClick={() => handleSort(k)}>
                        {k === 'id' ? 'ID' : k === 'patient_name' ? 'Name' : k === 'speciality' ? 'Department' : k === 'age' ? 'Age' : k === 'created_at' ? 'Date' : 'Rating'} {renderSortArrow(k)}
                      </th>
                    ))}
                    <th className="p-3 px-4 font-bold text-slate-900 bg-slate-50 border-b border-slate-200 select-none">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.length > 0 ? (
                    sortedRecords.map((record: any) => (
                      <tr key={record.id} className="cursor-pointer transition-colors hover:bg-slate-50 active:bg-teal-50" onDoubleClick={() => { window.location.href = `/?id=${record.id}` }} title="Double-click to open in Consultation Workspace">
                        <td className="p-3 px-4 border-b border-slate-200"><strong>#{record.id}</strong></td>
                        <td className="p-3 px-4 border-b border-slate-200">{record.patient_name}</td>
                        <td className="p-3 px-4 border-b border-slate-200"><span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded-md bg-teal-50 text-teal-600">{record.speciality}</span></td>
                        <td className="p-3 px-4 border-b border-slate-200">{record.age} yrs</td>
                        <td className="p-3 px-4 border-b border-slate-200">{new Date(record.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td className="p-3 px-4 border-b border-slate-200">
                          {record.rating ? <div className="flex gap-0.5 text-amber-500">{renderStars(record.rating)}</div> : <span className="text-[12px] text-slate-400 italic">Not Rated</span>}
                        </td>
                        <td className="p-3 px-4 border-b border-slate-200">
                          <button type="button" className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete consultation" onClick={(e) => { e.stopPropagation(); handleDeleteConsultation(record.id); }} disabled={deletingId === record.id}>
                            {deletingId === record.id ? <svg className="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : '🗑️'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="text-center text-slate-500 p-6 border-b border-slate-200">No consultations found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
