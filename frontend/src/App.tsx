import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

type Medication = {
  name: string
  dose: string
  frequency: string
  duration: string
}

type SummarySections = {
  section1: string
  section2: string
  section3: string
  section4: string
}

type GenerateResponse = {
  consultation_id: number
  summary_id: number
  summary: string
  sections: SummarySections
  doctors_note?: string
}

type HistoryItem = {
  id: number
  patient_name: string
  age: number
  complaint: string
  diagnosis: string
  speciality?: string
  language?: string
  understanding_level?: string
  created_at: string
}

type Template = {
  id: number
  title: string
  complaint: string
  diagnosis: string
  treatment: string
  followup: string | null
}

type FormState = {
  patient_name: string
  age: string
  complaint: string
  diagnosis: string
  treatment: string
  followup: string
  medications: Medication[]
  speciality: string
  language: string
  understanding_level: string
}

type BackendStatus = 'checking' | 'connected' | 'disconnected'

const API_URL = (import.meta.env.API_URL || 'http://localhost:5000').replace(
  /\/$/,
  '',
)

const emptyMedication: Medication = {
  name: '',
  dose: '',
  frequency: '',
  duration: '',
}

const initialForm: FormState = {
  patient_name: '',
  age: '',
  complaint: '',
  diagnosis: '',
  treatment: '',
  followup: '',
  medications: [{ ...emptyMedication }],
  speciality: 'General Medicine',
  language: 'English',
  understanding_level: 'Simple',
}

const sectionLabels: Record<keyof SummarySections, string> = {
  section1: '1. What you came in for (సందర్శన కారణం)',
  section2: '2. What was found (పరీక్షా ఫలితాలు)',
  section3: '3. What to take / do (చేయవలసినవి / మందులు)',
  section4: '4. When to return (తదుపరి సూచనలు)',
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.errors?.join?.(', ') ||
      data?.message ||
      `Request failed with status ${response.status}`
    throw new Error(message)
  }

  return data as T
}

function App() {
  const [activeTab, setActiveTab] = useState<'consultation' | 'analytics'>('consultation')
  const [form, setForm] = useState<FormState>(initialForm)
  const [summary, setSummary] = useState<GenerateResponse | null>(null)
  const [editableSections, setEditableSections] = useState<SummarySections | null>(null)
  const [doctorsNote, setDoctorsNote] = useState<string>('')
  
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Feedback and Ratings states
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false)
  const [isSharingPdf, setIsSharingPdf] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedRecords = useMemo(() => {
    if (!analyticsData || !analyticsData.records) return []
    const sortableItems = [...analyticsData.records]
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key]
        let bVal = b[sortConfig.key]

        if (sortConfig.key === 'created_at') {
          aVal = new Date(aVal).getTime()
          bVal = new Date(bVal).getTime()
        }

        if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }

        return sortConfig.direction === 'asc'
          ? (aVal > bVal ? 1 : -1)
          : (aVal < bVal ? 1 : -1)
      })
    }
    return sortableItems
  }, [analyticsData?.records, sortConfig])

  function renderSortArrow(key: string) {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="sort-arrow-inactive">↕</span>
    }
    return sortConfig.direction === 'asc' ? <span className="sort-arrow-active">▲</span> : <span className="sort-arrow-active">▼</span>
  }

  const completedFields = useMemo(() => {
    const fields = [
      form.patient_name,
      form.age,
      form.complaint,
      form.diagnosis,
      form.treatment,
    ]
    return fields.filter(Boolean).length
  }, [form])

  useEffect(() => {
    void checkBackendHealth()
    void loadInitialData()

    const intervalId = window.setInterval(() => {
      void checkBackendHealth()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (activeTab === 'analytics') {
      void loadAnalytics()
    }
  }, [activeTab])

  async function checkBackendHealth() {
    try {
      const data = await apiRequest<{ status: string }>('/api/health')
      setBackendStatus(data.status === 'ok' ? 'connected' : 'disconnected')
    } catch {
      setBackendStatus('disconnected')
    }
  }

  async function loadInitialData() {
    setIsLoadingHistory(true)
    try {
      const [historyData, templateData] = await Promise.all([
        apiRequest<HistoryItem[]>('/api/history'),
        apiRequest<Template[]>('/api/templates'),
      ])
      setHistory(historyData)
      setTemplates(templateData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load API data')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  async function loadAnalytics() {
    setIsLoadingAnalytics(true)
    try {
      const data = await apiRequest<any>('/api/admin/analytics')
      setAnalyticsData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load analytics')
    } finally {
      setIsLoadingAnalytics(false)
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateMedication(
    index: number,
    field: keyof Medication,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      medications: current.medications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  function addMedication() {
    setForm((current) => ({
      ...current,
      medications: [...current.medications, { ...emptyMedication }],
    }))
  }

  function removeMedication(index: number) {
    setForm((current) => ({
      ...current,
      medications:
        current.medications.length === 1
          ? [{ ...emptyMedication }]
          : current.medications.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function applyTemplate(template: Template) {
    setForm((current) => ({
      ...current,
      complaint: template.complaint,
      diagnosis: template.diagnosis,
      treatment: template.treatment,
      followup: template.followup || '',
    }))
    setNotice(`${template.title} template applied`)
  }

  async function loadConsultationDetail(id: number) {
    setError('')
    setNotice('')
    setIsGenerating(true)
    try {
      const response = await apiRequest<any>(`/api/history/${id}`)
      setForm({
        patient_name: response.patient_name,
        age: String(response.age),
        complaint: response.complaint,
        diagnosis: response.diagnosis,
        treatment: response.treatment,
        followup: response.followup || '',
        medications: response.medications.length > 0 ? response.medications : [{ ...emptyMedication }],
        speciality: response.speciality || 'General Medicine',
        language: response.language || 'English',
        understanding_level: response.understanding_level || 'Simple',
      })
      setSummary({
        consultation_id: response.id,
        summary_id: response.summary_id,
        summary: response.summary || '',
        sections: response.sections || {
          section1: response.summary || '',
          section2: '',
          section3: '',
          section4: ''
        }
      })
      setEditableSections(response.sections || {
        section1: response.summary || '',
        section2: '',
        section3: '',
        section4: ''
      })
      setDoctorsNote(response.doctors_note || '')
      setFeedbackRating(response.rating || null)
      setNotice('Loaded consultation details from history')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history details')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsGenerating(true)
    setFeedbackRating(null)

    const medications = form.medications.filter((item) =>
      Object.values(item).some(Boolean),
    )

    try {
      const data = await apiRequest<GenerateResponse>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          medications,
        }),
      })
      setSummary(data)
      setEditableSections(data.sections)
      setDoctorsNote(data.doctors_note || '')
      setNotice('Patient summary generated successfully')
      const historyData = await apiRequest<HistoryItem[]>('/api/history')
      setHistory(historyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate summary')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSaveChanges() {
    if (!summary) return
    setError('')
    setNotice('')
    setIsGenerating(true)

    try {
      const response = await apiRequest<any>(`/api/history/${summary.consultation_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          patient_name: form.patient_name,
          age: Number(form.age),
          complaint: form.complaint,
          diagnosis: form.diagnosis,
          treatment: form.treatment,
          followup: form.followup,
          speciality: form.speciality,
          language: form.language,
          understanding_level: form.understanding_level,
          sections: editableSections,
          doctors_note: doctorsNote,
          summary: `${editableSections?.section1 || ''}\n\n${editableSections?.section2 || ''}\n\n${editableSections?.section3 || ''}\n\n${editableSections?.section4 || ''}`
        })
      })

      setSummary({
        consultation_id: response.id,
        summary_id: response.summary_id,
        summary: response.summary,
        sections: response.sections
      })
      setEditableSections(response.sections)
      setDoctorsNote(response.doctors_note || '')
      setFeedbackRating(response.rating || null)
      setNotice('Consultation changes saved successfully')
      const historyData = await apiRequest<HistoryItem[]>('/api/history')
      setHistory(historyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save modifications')
    } finally {
      setIsGenerating(false)
    }
  }

  async function submitFeedback(rating: number) {
    if (!summary) return

    setError('')
    setNotice('')

    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ summary_id: summary.summary_id, rating }),
      })
      setFeedbackRating(rating)
      setNotice('Feedback rating saved. Thank you!')
      if (activeTab === 'analytics') {
        void loadAnalytics()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save feedback')
    }
  }

  function handlePrint() {
    window.print()
  }

  async function handleWhatsAppShare() {
    if (!summary || !editableSections) return
    setIsSharingPdf(true)
    setError('')
    setNotice('')

    try {
      const element = document.getElementById('patient-print-summary')
      if (!element) {
        throw new Error('Print summary element not found')
      }

      // Temporarily display the print container offscreen to capture it
      const originalDisplay = element.style.display
      const originalPosition = element.style.position
      const originalLeft = element.style.left
      const originalTop = element.style.top
      const originalWidth = element.style.width
      const originalBackground = element.style.background

      element.style.display = 'block'
      element.style.position = 'absolute'
      element.style.left = '-9999px'
      element.style.top = '0'
      element.style.width = '800px'
      element.style.background = '#ffffff'

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      })

      // Restore original styling
      element.style.display = originalDisplay
      element.style.position = originalPosition
      element.style.left = originalLeft
      element.style.top = originalTop
      element.style.width = originalWidth
      element.style.background = originalBackground

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210
      const pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const pdfBlob = pdf.output('blob')
      const fileName = `${form.patient_name.replace(/\s+/g, '_')}_treatment_summary.pdf`
      const pdfFile = new File([pdfBlob], fileName, {
        type: 'application/pdf',
      })

      // Try Web Share API (mobile/supported browsers)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: 'Patient Treatment Summary',
          text: `Patient Treatment Summary for ${form.patient_name}`,
        })
        setNotice('PDF shared successfully via WhatsApp/Share!')
      } else {
        // Fallback for desktop: download and direct link
        const link = document.createElement('a')
        link.href = URL.createObjectURL(pdfBlob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        // Formulate WhatsApp Web link
        const message = `Here is the PDF Treatment Summary for ${form.patient_name}. The PDF has been downloaded to your device; please attach it here.`
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
        window.open(url, '_blank')
        setNotice('PDF generated and downloaded! Please attach it to your WhatsApp message.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate PDF')
    } finally {
      setIsSharingPdf(false)
    }
  }

  function renderStars(rating: number, interactive = false, onSelect?: (r: number) => void) {
    return (
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = interactive 
            ? (hoverRating !== null ? star <= hoverRating : star <= (feedbackRating || 0))
            : star <= rating;
          return (
            <button
              type="button"
              key={star}
              className={`star-btn ${active ? 'active' : ''} ${interactive ? 'interactive' : ''}`}
              onClick={() => interactive && onSelect && onSelect(star)}
              onMouseEnter={() => interactive && setHoverRating(star)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              disabled={!interactive}
            >
              ★
            </button>
          )
        })}
      </div>
    )
  }

  function handleResetForm() {
    setForm(initialForm)
    setSummary(null)
    setEditableSections(null)
    setDoctorsNote('')
    setFeedbackRating(null)
    setError('')
    setNotice('')
  }

  return (
    <main className="app-shell">
      {/* Dynamic Screen Layout */}
      <header className="topbar no-print">
        <div>
          <p className="eyebrow">AI Post-Consultation System</p>
          <h1>Ayurdha Clinics</h1>
        </div>

        {/* Tab Selection */}
        <nav className="tab-navigation">
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'consultation' ? 'active' : ''}`}
            onClick={() => setActiveTab('consultation')}
          >
            Consultation Workspace
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Admin Analytics
          </button>
        </nav>

        <div
          className={`api-status ${backendStatus}`}
          aria-label={`Backend status: ${backendStatus}`}
        >
          <span aria-hidden="true"></span>
          <div>
            <strong>
              {backendStatus === 'connected'
                ? 'System connected'
                : backendStatus === 'disconnected'
                  ? 'Connection lost'
                  : 'Locating system'}
            </strong>
            <code>{API_URL}</code>
          </div>
        </div>
      </header>

      {error && <div className="message error no-print">{error}</div>}
      {notice && <div className="message success no-print">{notice}</div>}

      {activeTab === 'consultation' ? (
        <section className="workspace no-print">
          <form className="summary-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Patient Intake</p>
                <h2>Clinical details</h2>
              </div>
              <div className="form-action-strip">
                <button type="button" className="ghost-button" onClick={handleResetForm}>
                  Clear Form
                </button>
                <div className="progress-pill">{completedFields}/5 ready</div>
              </div>
            </div>

            <div className="field-grid">
              <label>
                Patient name
                <input
                  required
                  value={form.patient_name}
                  onChange={(event) =>
                    updateField('patient_name', event.target.value)
                  }
                  placeholder="Ananya Rao"
                />
              </label>
              <label>
                Age
                <input
                  required
                  min="0"
                  type="number"
                  value={form.age}
                  onChange={(event) => updateField('age', event.target.value)}
                  placeholder="42"
                />
              </label>
            </div>

            <div className="field-grid">
              <label>
                Clinical Department / Speciality
                <select
                  value={form.speciality}
                  onChange={(event) => updateField('speciality', event.target.value)}
                  className="dropdown-select"
                >
                  <option value="General Medicine">General Medicine</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Gynecology">Gynecology</option>
                  <option value="Dermatology">Dermatology</option>
                </select>
              </label>

              <div className="toggle-label">
                <span className="label-text">Preferred Summary Language</span>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${form.language === 'English' ? 'active' : ''}`}
                    onClick={() => updateField('language', 'English')}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.language === 'Telugu' ? 'active' : ''}`}
                    onClick={() => updateField('language', 'Telugu')}
                  >
                    తెలుగు (Telugu)
                  </button>
                </div>
              </div>
            </div>

            <div className="field-grid">
              <div className="toggle-label-full">
                <span className="label-text">Patient Understanding Level</span>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${form.understanding_level === 'Simple' ? 'active' : ''}`}
                    onClick={() => updateField('understanding_level', 'Simple')}
                  >
                    Simple (Non-Medical)
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.understanding_level === 'Basic' ? 'active' : ''}`}
                    onClick={() => updateField('understanding_level', 'Basic')}
                  >
                    Basic (Layperson)
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.understanding_level === 'Detailed' ? 'active' : ''}`}
                    onClick={() => updateField('understanding_level', 'Detailed')}
                  >
                    Detailed
                  </button>
                </div>
              </div>
            </div>

            <label>
              Complaint
              <textarea
                required
                value={form.complaint}
                onChange={(event) => updateField('complaint', event.target.value)}
                placeholder="Fever and body pains for 3 days"
              />
            </label>

            <div className="field-grid">
              <label>
                Diagnosis
                <textarea
                  required
                  value={form.diagnosis}
                  onChange={(event) =>
                    updateField('diagnosis', event.target.value)
                  }
                  placeholder="Viral fever"
                />
              </label>
              <label>
                Treatment
                <textarea
                  required
                  value={form.treatment}
                  onChange={(event) =>
                    updateField('treatment', event.target.value)
                  }
                  placeholder="Hydration, paracetamol, rest"
                />
              </label>
            </div>

            <label>
              Follow-up Instructions
              <input
                value={form.followup}
                onChange={(event) => updateField('followup', event.target.value)}
                placeholder="Review after 3 days if fever continues"
              />
            </label>

            <div className="medication-header">
              <h3>Medications prescribed</h3>
              <button type="button" className="ghost-button" onClick={addMedication}>
                + Add medicine
              </button>
            </div>

            <div className="medication-list">
              {form.medications.map((item, index) => (
                <div className="medication-row" key={index}>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateMedication(index, 'name', event.target.value)
                    }
                    placeholder="Medicine Name"
                  />
                  <input
                    value={item.dose}
                    onChange={(event) =>
                      updateMedication(index, 'dose', event.target.value)
                    }
                    placeholder="Dose (e.g. 500mg)"
                  />
                  <input
                    value={item.frequency}
                    onChange={(event) =>
                      updateMedication(index, 'frequency', event.target.value)
                    }
                    placeholder="Frequency (e.g. 1-0-1)"
                  />
                  <input
                    value={item.duration}
                    onChange={(event) =>
                      updateMedication(index, 'duration', event.target.value)
                    }
                    placeholder="Duration (e.g. 5 days)"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove medication"
                    onClick={() => removeMedication(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {templates.length > 0 && (
              <div className="template-box">
                <span className="template-label">Quick Templates:</span>
                <div className="template-strip" aria-label="Templates">
                  {templates.map((template) => (
                    <button
                      type="button"
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                    >
                      {template.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="primary-button" disabled={isGenerating}>
              {isGenerating ? 'Generating summary with AI...' : 'Generate patient-friendly summary'}
            </button>
          </form>

          <aside className="side-column">
            <section className="summary-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Patient Output</p>
                  <h2>Patient Summary Summary</h2>
                </div>
                {summary && <span className="progress-pill">ID #{summary.summary_id}</span>}
              </div>

              {summary && editableSections ? (
                <div className="summary-result-container">
                  <div className="summary-edit-instructions">
                    💡 <em>You can review and edit each section's patient-friendly description directly below.</em>
                  </div>
                  
                  <div className="summary-sections">
                    {Object.keys(editableSections).map((key) => {
                      const sectionKey = key as keyof SummarySections;
                      return (
                        <article key={sectionKey} className="editable-section-card">
                          <label className="section-title-label">
                            {sectionLabels[sectionKey]}
                            <textarea
                              className="section-edit-textarea"
                              value={editableSections[sectionKey]}
                              onChange={(e) => {
                                const newVal = e.target.value;
                                setEditableSections(prev => prev ? ({ ...prev, [sectionKey]: newVal }) : null);
                              }}
                            />
                          </label>
                        </article>
                      );
                    })}
                  </div>

                  <div className="doctors-note-section">
                    <label className="section-title-label">
                      📋 Additional Doctor's Notes (వ్యక్తిగత సూచనలు)
                      <textarea
                        className="doctors-note-textarea"
                        placeholder="Add specific diet advice, warning signs, or doctor's note..."
                        value={doctorsNote}
                        onChange={(e) => setDoctorsNote(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="action-row flex-buttons">
                    <button type="button" className="secondary-button" onClick={handleSaveChanges} disabled={isGenerating}>
                      {isGenerating ? 'Saving...' : '💾 Save Changes'}
                    </button>
                    <button type="button" className="print-btn-action" onClick={handlePrint}>
                      🖨️ Print Summary
                    </button>
                    <button type="button" className="whatsapp-btn-action" onClick={handleWhatsAppShare} disabled={isSharingPdf}>
                      {isSharingPdf ? '⏳ Sharing PDF...' : '💬 WhatsApp Share'}
                    </button>
                  </div>

                  <div className="feedback-row-stars">
                    <span>Rate summary quality:</span>
                    {renderStars(feedbackRating || 0, true, (rating) => submitFeedback(rating))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  Fill in patient clinical notes and generate a simple, clear post-consultation summary in English or Telugu.
                </div>
              )}
            </section>

            <section className="history-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Consultation Registry</p>
                  <h2>Recent patients</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void loadInitialData()}
                >
                  🔄 Refresh
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="empty-state">Loading records...</div>
              ) : history.length > 0 ? (
                <div className="history-list">
                  {history.map((item) => (
                    <article key={item.id} className="history-card-item" onClick={() => loadConsultationDetail(item.id)}>
                      <div className="history-header">
                        <strong>{item.patient_name}</strong>
                        <span className="history-date">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="history-meta">
                        <span>{item.age} yrs · {item.speciality || 'General Medicine'}</span>
                        <span className="lang-tag">{item.language || 'English'}</span>
                      </div>
                      <div className="history-diagnoses">
                        <strong>Diag:</strong> {item.diagnosis}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No consultation history found.</div>
              )}
            </section>
          </aside>
        </section>
      ) : (
        /* Admin Analytics Dashboard */
        <section className="analytics-dashboard no-print">
          <div className="dashboard-header-row">
            <div>
              <p className="eyebrow">Overview</p>
              <h2>Clinic Analytics Dashboard</h2>
            </div>
            <button type="button" className="secondary-button" onClick={loadAnalytics} disabled={isLoadingAnalytics}>
              {isLoadingAnalytics ? 'Refreshing...' : '🔄 Refresh Data'}
            </button>
          </div>

          {isLoadingAnalytics || !analyticsData ? (
            <div className="empty-state">Loading dashboard analytics data...</div>
          ) : (
            <div className="dashboard-content">
              {/* Metrics Row */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-title">Total Summaries Generated</span>
                  <span className="metric-val">{analyticsData.total_generations}</span>
                  <span className="metric-desc">Consultation records converted to patient summaries</span>
                </div>
                
                <div className="metric-card">
                  <span className="metric-title">Average Patient Rating</span>
                  <div className="metric-rating-row">
                    <span className="metric-val">{analyticsData.average_rating}</span>
                    <span className="rating-max">/ 5</span>
                  </div>
                  <div className="metric-stars-wrap">
                    {renderStars(Math.round(analyticsData.average_rating))}
                  </div>
                  <span className="metric-desc">Based on direct post-consultation star ratings</span>
                </div>
              </div>

              {/* Speciality Breakdown & Trend Grid */}
              <div className="dashboard-charts-grid">
                {/* Speciality Distributions */}
                <div className="chart-card">
                  <h3>Summaries by Medical Speciality</h3>
                  <p className="chart-subtitle">Distribution of summaries generated across clinical departments</p>
                  
                  <div className="speciality-distribution-list">
                    {analyticsData.speciality_distribution && analyticsData.speciality_distribution.length > 0 ? (
                      analyticsData.speciality_distribution.map((item: any, idx: number) => {
                        const total = analyticsData.total_generations || 1;
                        const pct = Math.round((item.count / total) * 100);
                        return (
                          <div className="distribution-row" key={idx}>
                            <div className="dist-label-row">
                              <span className="dist-name">{item.speciality}</span>
                              <span className="dist-count">{item.count} ({pct}%)</span>
                            </div>
                            <div className="bar-track">
                              <div className="bar-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="empty-chart-state">No speciality statistics recorded yet.</div>
                    )}
                  </div>
                </div>

                {/* Ratings Daily Trend */}
                <div className="chart-card">
                  <h3>Daily Patient Feedback Log</h3>
                  <p className="chart-subtitle">Log of average ratings received per day</p>

                  <div className="table-responsive">
                    <table className="ratings-trend-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Ratings Count</th>
                          <th>Average Rating</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.ratings_per_day && analyticsData.ratings_per_day.length > 0 ? (
                          analyticsData.ratings_per_day.map((item: any, idx: number) => (
                            <tr key={idx}>
                              <td>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td>{item.count} feedbacks</td>
                              <td>
                                <div className="table-rating">
                                  <span>{item.average_rating}</span>
                                  {renderStars(Math.round(item.average_rating))}
                                </div>
                              </td>
                              <td>
                                <span className={`status-badge ${item.average_rating >= 4 ? 'high' : item.average_rating >= 3 ? 'mid' : 'low'}`}>
                                  {item.average_rating >= 4.5 ? 'Excellent' : item.average_rating >= 4 ? 'Very Good' : item.average_rating >= 3 ? 'Satisfactory' : 'Needs Attention'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="empty-table-cell">No feedback logged yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Consultation Registry Table */}
              <div className="dashboard-records-section">
                <div className="section-header">
                  <h3>All Consultations Registry</h3>
                  <p className="chart-subtitle">
                    Double-click any record to open and edit it in the Consultation Workspace. Click column headers to sort.
                  </p>
                </div>
                <div className="table-responsive records-table-wrapper">
                  <table className="records-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                          ID {renderSortArrow('id')}
                        </th>
                        <th onClick={() => handleSort('patient_name')} style={{ cursor: 'pointer' }}>
                          Name {renderSortArrow('patient_name')}
                        </th>
                        <th onClick={() => handleSort('speciality')} style={{ cursor: 'pointer' }}>
                          Department {renderSortArrow('speciality')}
                        </th>
                        <th onClick={() => handleSort('age')} style={{ cursor: 'pointer' }}>
                          Age {renderSortArrow('age')}
                        </th>
                        <th onClick={() => handleSort('created_at')} style={{ cursor: 'pointer' }}>
                          Date {renderSortArrow('created_at')}
                        </th>
                        <th onClick={() => handleSort('rating')} style={{ cursor: 'pointer' }}>
                          Rating {renderSortArrow('rating')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRecords.length > 0 ? (
                        sortedRecords.map((record: any) => (
                          <tr
                            key={record.id}
                            className="record-row-interactive"
                            onDoubleClick={() => {
                              setActiveTab('consultation')
                              void loadConsultationDetail(record.id)
                            }}
                            title="Double-click to open in Consultation Workspace"
                          >
                            <td><strong>#{record.id}</strong></td>
                            <td>{record.patient_name}</td>
                            <td>
                              <span className="dept-badge">{record.speciality}</span>
                            </td>
                            <td>{record.age} yrs</td>
                            <td>{new Date(record.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            <td>
                              {record.rating ? (
                                <div className="table-rating-stars">
                                  {renderStars(record.rating)}
                                </div>
                              ) : (
                                <span className="no-rating-label">Not Rated</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="empty-table-cell">No consultations found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Hidden Print-Only Layout */}
      {summary && editableSections && (
        <div id="patient-print-summary" className="print-only">
          <div className="print-letterhead">
            <div className="letterhead-logo">
              <span className="cross-icon">✚</span> AYURDHA CLINICS
            </div>
            <div className="letterhead-details">
              <p className="bold">Ayurvedha & Modern Integrative Healthcare Centre</p>
              <p>Plot 48, Jubilee Hills Road, Hyderabad, Telangana - 500033</p>
              <p>Email: consult@ayurdhaclinics.com | Phone: +91 40 4455 6677</p>
            </div>
          </div>

          <div className="print-title-box">
            <h2>POST-CONSULTATION VISIT SUMMARY</h2>
            <p className="print-date">Date: {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="print-patient-info">
            <div className="info-col">
              <p><strong>Patient Name:</strong> {form.patient_name}</p>
              <p><strong>Age / Gender:</strong> {form.age} Years</p>
            </div>
            <div className="info-col">
              <p><strong>Clinical Department:</strong> {form.speciality}</p>
              <p><strong>Summary Language:</strong> {form.language} ({form.understanding_level} Level)</p>
            </div>
          </div>

          <div className="print-clinical-inputs">
            <h3>Clinical Consultation Notes (Reference)</h3>
            <div className="clinical-grid">
              <div><strong>Presenting Complaint:</strong> {form.complaint}</div>
              <div><strong>Diagnosis:</strong> {form.diagnosis}</div>
              <div><strong>In-Clinic Treatment:</strong> {form.treatment}</div>
            </div>
          </div>

          <div className="print-body-content">
            <div className="print-section">
              <h4>1. What you came in for (మీరు వచ్చిన కారణం)</h4>
              <p>{editableSections.section1}</p>
            </div>

            <div className="print-section">
              <h4>2. What was found (వైద్యుల పరిశీలన)</h4>
              <p>{editableSections.section2}</p>
            </div>

            <div className="print-section">
              <h4>3. What to take / do (మందులు మరియు గృహ చికిత్స)</h4>
              <p>{editableSections.section3}</p>
              
              {/* Prescribed Medications Table */}
              {form.medications.some(m => m.name) && (
                <table className="print-meds-table">
                  <thead>
                    <tr>
                      <th>Medicine Name</th>
                      <th>Dose (మోతాదు)</th>
                      <th>Frequency (ఎప్పుడు వేసుకోవాలి)</th>
                      <th>Duration (ఎన్ని రోజులు)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.medications.filter(m => m.name).map((m, idx) => (
                      <tr key={idx}>
                        <td className="bold">{m.name}</td>
                        <td>{m.dose || '-'}</td>
                        <td>{m.frequency || '-'}</td>
                        <td>{m.duration || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="print-section">
              <h4>4. When to return (తదుపరి సంప్రదింపులు)</h4>
              <p>{editableSections.section4}</p>
            </div>

            {doctorsNote && (
              <div className="print-section doctors-note-box">
                <h4>📋 Additional Doctor's Advice (వైద్యుల ప్రత్యేక సూచనలు)</h4>
                <p>{doctorsNote}</p>
              </div>
            )}
          </div>

          <div className="print-footer-banner">
            <div className="footer-notes">
              <p>• Please take medications strictly as prescribed. Do not skip doses.</p>
              <p>• In case of emergency or severe discomfort, please visit the clinic or call us immediately.</p>
            </div>
            <div className="signature-area">
              <div className="sig-space"></div>
              <p className="sig-label">Consulting Practitioner Signature</p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
