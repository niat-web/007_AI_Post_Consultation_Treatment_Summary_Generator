import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

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
}

type HistoryItem = {
  id: number
  patient_name: string
  age: number
  complaint: string
  diagnosis: string
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
}

const sectionLabels: Record<keyof SummarySections, string> = {
  section1: 'What happened',
  section2: 'Medicines',
  section3: 'Home care',
  section4: 'When to return',
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
  const [form, setForm] = useState<FormState>(initialForm)
  const [summary, setSummary] = useState<GenerateResponse | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>('checking')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsGenerating(true)

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
      setNotice('Patient summary generated')
      const historyData = await apiRequest<HistoryItem[]>('/api/history')
      setHistory(historyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate summary')
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
      setNotice('Feedback saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save feedback')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI Medical Summary</p>
          <h1>Patient-friendly visit summaries</h1>
        </div>
        <div
          className={`api-status ${backendStatus}`}
          aria-label={`Backend status: ${backendStatus}`}
        >
          <span aria-hidden="true"></span>
          <div>
            <strong>
              {backendStatus === 'connected'
                ? 'Backend connected'
                : backendStatus === 'disconnected'
                  ? 'Backend disconnected'
                  : 'Checking backend'}
            </strong>
            <code>{API_URL}</code>
          </div>
        </div>
      </header>

      <section className="workspace">
        <form className="summary-form" onSubmit={handleSubmit}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Consultation</p>
              <h2>Clinical notes</h2>
            </div>
            <div className="progress-pill">{completedFields}/5 ready</div>
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
            Follow-up
            <input
              value={form.followup}
              onChange={(event) => updateField('followup', event.target.value)}
              placeholder="Review after 3 days if fever continues"
            />
          </label>

          <div className="medication-header">
            <h3>Medications</h3>
            <button type="button" className="ghost-button" onClick={addMedication}>
              Add medicine
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
                  placeholder="Medicine"
                />
                <input
                  value={item.dose}
                  onChange={(event) =>
                    updateMedication(index, 'dose', event.target.value)
                  }
                  placeholder="Dose"
                />
                <input
                  value={item.frequency}
                  onChange={(event) =>
                    updateMedication(index, 'frequency', event.target.value)
                  }
                  placeholder="Frequency"
                />
                <input
                  value={item.duration}
                  onChange={(event) =>
                    updateMedication(index, 'duration', event.target.value)
                  }
                  placeholder="Duration"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Remove medication"
                  onClick={() => removeMedication(index)}
                >
                  -
                </button>
              </div>
            ))}
          </div>

          {templates.length > 0 && (
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
          )}

          <button className="primary-button" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate summary'}
          </button>
        </form>

        <aside className="side-column">
          <section className="summary-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Output</p>
                <h2>Patient summary</h2>
              </div>
              {summary && <span className="progress-pill">#{summary.summary_id}</span>}
            </div>

            {error && <div className="message error">{error}</div>}
            {notice && <div className="message success">{notice}</div>}

            {summary ? (
              <>
                <div className="summary-sections">
                  {Object.entries(summary.sections).map(([key, value]) => (
                    <article key={key}>
                      <h3>{sectionLabels[key as keyof SummarySections]}</h3>
                      <p>{value}</p>
                    </article>
                  ))}
                </div>
                <div className="feedback-row">
                  <span>Was this useful?</span>
                  <button type="button" onClick={() => submitFeedback(1)}>
                    Yes
                  </button>
                  <button type="button" onClick={() => submitFeedback(0)}>
                    No
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                Enter the visit details and generate a simple summary for the
                patient.
              </div>
            )}
          </section>

          <section className="history-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Records</p>
                <h2>Recent visits</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void loadInitialData()}
              >
                Refresh
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="empty-state">Loading history...</div>
            ) : history.length > 0 ? (
              <div className="history-list">
                {history.slice(0, 5).map((item) => (
                  <article key={item.id}>
                    <strong>{item.patient_name}</strong>
                    <span>
                      {item.diagnosis} · {new Date(item.created_at).toLocaleDateString()}
                    </span>
                    <p>{item.complaint}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No consultations yet.</div>
            )}
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App
