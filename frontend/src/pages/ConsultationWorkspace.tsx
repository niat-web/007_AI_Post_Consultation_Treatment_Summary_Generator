import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FormState, GenerateResponse, SummarySections, Template, Medication } from '../types'
import { apiRequest } from '../api'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const emptyMedication: Medication = { name: '', dose: '', frequency: '', duration: '' }
const initialForm: FormState = {
  patient_name: '', age: '', complaint: '', diagnosis: '', treatment: '', followup: '',
  medications: [{ ...emptyMedication }], speciality: 'General Medicine', language: 'English', understanding_level: 'Simple',
}
const sectionLabels: Record<keyof SummarySections, string> = {
  section1: '1. What you came in for (సందర్శన కారణం)',
  section2: '2. What was found (పరీక్షా ఫలితాలు)',
  section3: '3. What to take / do (చేయవలసినవి / మందులు)',
  section4: '4. When to return (తదుపరి సూచనలు)',
}

function SkeletonLoader() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-3 bg-slate-200 rounded-full w-1/3 mb-6"></div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="h-3 bg-teal-100 rounded-full w-2/5"></div>
          <div className="h-3 bg-slate-200 rounded-full w-full mt-2"></div>
          <div className="h-3 bg-slate-200 rounded-full w-4/5"></div>
          <div className="h-3 bg-slate-200 rounded-full w-3/5"></div>
        </div>
      ))}
    </div>
  )
}

export default function ConsultationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlId = searchParams.get('id')

  const [form, setForm] = useState<FormState>(initialForm)
  const [summary, setSummary] = useState<GenerateResponse | null>(null)
  const [savedSections, setSavedSections] = useState<SummarySections | null>(null)
  const [savedDoctorsNote, setSavedDoctorsNote] = useState<string>('')
  const [editableSections, setEditableSections] = useState<SummarySections | null>(null)
  const [doctorsNote, setDoctorsNote] = useState<string>('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [isSharingPdf, setIsSharingPdf] = useState(false)

  const hasUnsavedChanges = useMemo(() => {
    if (!summary || !editableSections || !savedSections) return false
    if (!summary.consultation_id) return true
    const sectionsChanged = JSON.stringify(editableSections) !== JSON.stringify(savedSections)
    const noteChanged = doctorsNote !== savedDoctorsNote
    return sectionsChanged || noteChanged
  }, [editableSections, savedSections, doctorsNote, savedDoctorsNote, summary])

  const completedFields = useMemo(() => {
    return [form.patient_name, form.age, form.complaint, form.diagnosis, form.treatment].filter(Boolean).length
  }, [form])

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    if (urlId) {
      void loadConsultationDetail(Number(urlId))
      setSearchParams({})
    }
  }, [urlId])

  async function loadInitialData() {
    try {
      const templateData = await apiRequest<Template[]>('/api/templates')
      setTemplates(templateData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load API data')
    }
  }

  function updateField(field: keyof FormState, value: string) {
    setForm(c => ({ ...c, [field]: value }))
  }

  function updateMedication(index: number, field: keyof Medication, value: string) {
    setForm(c => ({ ...c, medications: c.medications.map((m, i) => i === index ? { ...m, [field]: value } : m) }))
  }

  function addMedication() {
    setForm(c => ({ ...c, medications: [...c.medications, { ...emptyMedication }] }))
  }

  function removeMedication(index: number) {
    setForm(c => ({
      ...c,
      medications: c.medications.length === 1 ? [{ ...emptyMedication }] : c.medications.filter((_, i) => i !== index),
    }))
  }

  function applyTemplate(template: Template) {
    setForm(c => ({ ...c, complaint: template.complaint, diagnosis: template.diagnosis, treatment: template.treatment, followup: template.followup || '' }))
    setNotice(`${template.title} template applied`)
  }

  async function loadConsultationDetail(id: number) {
    setError(''); setNotice(''); setIsGenerating(true)
    try {
      const r = await apiRequest<any>(`/api/history/${id}`)
      setForm({ patient_name: r.patient_name, age: String(r.age), complaint: r.complaint, diagnosis: r.diagnosis, treatment: r.treatment, followup: r.followup || '', medications: r.medications.length > 0 ? r.medications : [{ ...emptyMedication }], speciality: r.speciality || 'General Medicine', language: r.language || 'English', understanding_level: r.understanding_level || 'Simple' })
      const sections = r.sections || { section1: r.summary || '', section2: '', section3: '', section4: '' }
      const note = r.doctors_note || ''
      setSummary({ consultation_id: r.id, summary_id: r.summary_id, summary: r.summary || '', sections })
      setEditableSections(sections)
      setSavedSections(sections)
      setDoctorsNote(note)
      setSavedDoctorsNote(note)
      setFeedbackRating(r.rating || null)
      setNotice('Loaded consultation details from history')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load history details')
    } finally { setIsGenerating(false) }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(''); setNotice(''); setIsGenerating(true); setFeedbackRating(null)
    const medications = form.medications.filter(m => Object.values(m).some(Boolean))
    try {
      const data = await apiRequest<GenerateResponse>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ ...form, age: Number(form.age), medications }),
      })
      setSummary({ ...data, consultation_id: data.consultation_id || null, summary_id: data.summary_id || null })
      setEditableSections(data.sections)
      setSavedSections(data.sections)
      const note = data.doctors_note || ''
      setDoctorsNote(note)
      setSavedDoctorsNote(note)
      setNotice('Patient summary generated successfully. Please review and click Save.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate summary')
    } finally { setIsGenerating(false) }
  }

  async function handleSaveChanges() {
    if (!summary) return
    setError(''); setNotice(''); setIsSaving(true)
    try {
      const payload = {
        patient_name: form.patient_name, age: Number(form.age), complaint: form.complaint,
        diagnosis: form.diagnosis, treatment: form.treatment, followup: form.followup,
        speciality: form.speciality, language: form.language, understanding_level: form.understanding_level,
        sections: editableSections, doctors_note: doctorsNote,
        medications: form.medications.filter(m => Object.values(m).some(Boolean)),
        summary: `${editableSections?.section1 || ''}\n\n${editableSections?.section2 || ''}\n\n${editableSections?.section3 || ''}\n\n${editableSections?.section4 || ''}`
      }

      let response;
      if (summary.consultation_id) {
        response = await apiRequest<any>(`/api/history/${summary.consultation_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        response = await apiRequest<any>(`/api/history`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setSummary({ consultation_id: response.id, summary_id: response.summary_id, summary: response.summary, sections: response.sections })
      setEditableSections(response.sections)
      setSavedSections(response.sections)
      setDoctorsNote(response.doctors_note || '')
      setSavedDoctorsNote(response.doctors_note || '')
      setFeedbackRating(response.rating || null)
      setNotice('Consultation changes saved successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save modifications')
    } finally { setIsSaving(false) }
  }

  async function submitFeedback(rating: number) {
    if (!summary || !summary.summary_id) {
      setError('Please save the consultation before submitting feedback.')
      return
    }
    setError(''); setNotice('')
    try {
      await apiRequest('/api/feedback', { method: 'POST', body: JSON.stringify({ summary_id: summary.summary_id, rating }) })
      setFeedbackRating(rating)
      setNotice('Feedback rating saved. Thank you!')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save feedback') }
  }

  function handlePrint() { window.print() }

  async function handleWhatsAppShare() {
    if (!summary || !editableSections) return
    setIsSharingPdf(true); setError(''); setNotice('')
    try {
      const element = document.getElementById('patient-print-summary')
      if (!element) throw new Error('Print summary element not found')
      const orig = { display: element.style.display, position: element.style.position, left: element.style.left, top: element.style.top, width: element.style.width, background: element.style.background }
      element.style.display = 'block'; element.style.position = 'absolute'; element.style.left = '-9999px'; element.style.top = '0'; element.style.width = '800px'; element.style.background = '#ffffff'
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false })
      Object.assign(element.style, orig)
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgWidth = 210, pageHeight = 295
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight, position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft >= 0) { position = heightLeft - imgHeight; pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); heightLeft -= pageHeight }
      const pdfBlob = pdf.output('blob')
      const fileName = `${form.patient_name.replace(/\s+/g, '_')}_treatment_summary.pdf`
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({ files: [pdfFile], title: 'Patient Treatment Summary', text: `Patient Treatment Summary for ${form.patient_name}` })
        setNotice('PDF shared successfully!')
      } else {
        const link = document.createElement('a'); link.href = URL.createObjectURL(pdfBlob); link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link)
        const msg = `Here is the PDF Treatment Summary for ${form.patient_name}. The PDF has been downloaded; please attach it here.`
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank')
        setNotice('PDF generated and downloaded! Please attach it to your WhatsApp message.')
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not generate PDF') }
    finally { setIsSharingPdf(false) }
  }

  function renderStars(rating: number, interactive = false, onSelect?: (r: number) => void) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => {
          const active = interactive ? (hoverRating !== null ? star <= hoverRating : star <= (feedbackRating || 0)) : star <= rating
          return (
            <button type="button" key={star}
              className={`border-0 bg-transparent text-2xl p-0 leading-none transition-transform duration-100 ${active ? 'text-amber-400' : 'text-slate-300'} ${interactive ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
              onClick={() => interactive && onSelect && onSelect(star)}
              onMouseEnter={() => interactive && setHoverRating(star)}
              onMouseLeave={() => interactive && setHoverRating(null)}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              disabled={!interactive}
            >★</button>
          )
        })}
      </div>
    )
  }

  function handleResetForm() {
    setForm(initialForm); setSummary(null); setEditableSections(null); setSavedSections(null)
    setDoctorsNote(''); setSavedDoctorsNote(''); setFeedbackRating(null); setError(''); setNotice('')
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 font-[inherit] text-sm outline-none transition-all focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
  const textareaCls = `${inputCls} min-h-20 resize-y`

  return (
    <>
      {error && <div className="no-print mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">{error}</div>}
      {notice && <div className="no-print mb-5 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">{notice}</div>}
      <section className="no-print grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6">
        <form className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow" onSubmit={handleSubmit}>
          <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100 gap-3">
            <div>
              <p className="text-teal-600 text-[11px] font-bold tracking-[1.5px] uppercase mb-1">Patient Intake</p>
              <h2 className="text-xl font-bold text-slate-900 m-0">Clinical details</h2>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-transparent border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors" onClick={handleResetForm}>Clear Form</button>
              <div className="px-3 py-1.5 bg-teal-50 text-teal-700 font-bold text-xs rounded-full border border-teal-500/15">{completedFields}/5 ready</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900">
              Patient name <input required value={form.patient_name} onChange={e => updateField('patient_name', e.target.value)} placeholder="Ananya Rao" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900">
              Age <input required min="0" type="number" value={form.age} onChange={e => updateField('age', e.target.value)} placeholder="42" className={inputCls} />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900">
              Clinical Department / Speciality
              <select value={form.speciality} onChange={e => updateField('speciality', e.target.value)} className={`${inputCls} cursor-pointer appearance-none bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_fill=%22none%22_viewBox=%220_0_24_24%22_stroke=%22%23475569%22_stroke-width=%222%22%3E%3Cpath_stroke-linecap=%22round%22_stroke-linejoin=%22round%22_d=%22M19.5_8.25l-7.5_7.5-7.5-7.5%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_14px_center] bg-[length:16px] pr-10`}>
                <option value="General Medicine">General Medicine</option> <option value="Pediatrics">Pediatrics</option> <option value="Cardiology">Cardiology</option> <option value="Orthopedics">Orthopedics</option> <option value="Gynecology">Gynecology</option> <option value="Dermatology">Dermatology</option>
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-slate-900">Preferred Summary Language</span>
              <div className="flex bg-slate-100 p-[3px] rounded-lg border border-slate-200 gap-0.5">
                {(['English', 'Telugu'] as const).map(l => (
                  <button key={l} type="button" className={`flex-1 px-3 py-2 text-[13px] font-semibold rounded-md transition-all ${form.language === l ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => updateField('language', l)}>{l === 'Telugu' ? 'తెలుగు (Telugu)' : l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate-900">Patient Understanding Level</span>
            <div className="flex bg-slate-100 p-[3px] rounded-lg border border-slate-200 gap-0.5">
              {[{ v: 'Simple', l: 'Simple (Non-Medical)' }, { v: 'Basic', l: 'Basic (Layperson)' }, { v: 'Detailed', l: 'Detailed' }].map(t => (
                <button key={t.v} type="button" className={`flex-1 px-3 py-2 text-[13px] font-semibold rounded-md transition-all ${form.understanding_level === t.v ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => updateField('understanding_level', t.v)}>{t.l}</button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900 mb-4">
            Complaint <textarea required value={form.complaint} onChange={e => updateField('complaint', e.target.value)} placeholder="Fever and body pains for 3 days" className={textareaCls} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900">Diagnosis <textarea required value={form.diagnosis} onChange={e => updateField('diagnosis', e.target.value)} placeholder="Viral fever" className={textareaCls} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900">Treatment <textarea required value={form.treatment} onChange={e => updateField('treatment', e.target.value)} placeholder="Hydration, paracetamol, rest" className={textareaCls} /></label>
          </div>

          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-slate-900 mb-4">
            Follow-up Instructions <input value={form.followup} onChange={e => updateField('followup', e.target.value)} placeholder="Review after 3 days if fever continues" className={inputCls} />
          </label>

          <div className="flex justify-between items-center mt-5 mb-3">
            <h3 className="text-[15px] font-bold text-slate-900 m-0">Medications prescribed</h3>
            <button type="button" className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-transparent border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 transition-colors" onClick={addMedication}>+ Add medicine</button>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            {form.medications.map((item, index) => (
              <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr_1fr_1fr_38px] gap-2 items-center" key={index}>
                <input value={item.name} onChange={e => updateMedication(index, 'name', e.target.value)} placeholder="Medicine Name" className={inputCls} />
                <input value={item.dose} onChange={e => updateMedication(index, 'dose', e.target.value)} placeholder="Dose (e.g. 500mg)" className={inputCls} />
                <input value={item.frequency} onChange={e => updateMedication(index, 'frequency', e.target.value)} placeholder="Frequency (e.g. 1-0-1)" className={inputCls} />
                <input value={item.duration} onChange={e => updateMedication(index, 'duration', e.target.value)} placeholder="Duration (e.g. 5 days)" className={inputCls} />
                <button type="button" className="flex items-center justify-center w-full sm:w-[38px] h-[38px] border-0 rounded-lg bg-red-50 text-red-500 text-lg font-bold hover:bg-red-500 hover:text-white transition-colors" aria-label="Remove medication" onClick={() => removeMedication(index)}>×</button>
              </div>
            ))}
          </div>

          {templates.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <span className="block text-[12px] font-bold text-slate-500 mb-2">Quick Templates:</span>
              <div className="flex flex-wrap gap-2" aria-label="Templates">
                {templates.map(t => (
                  <button key={t.id} type="button" className="bg-white border border-slate-200 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer transition-all hover:bg-teal-50 hover:border-teal-600 hover:text-teal-600" onClick={() => applyTemplate(t)}>{t.title}</button>
                ))}
              </div>
            </div>
          )}

          <button className="w-full bg-teal-600 text-white border-0 py-3 px-6 rounded-lg font-bold text-[15px] shadow-sm hover:bg-teal-700 hover:shadow disabled:opacity-60 disabled:cursor-not-allowed transition-all" disabled={isGenerating}>
            {isGenerating ? 'Generating summary with AI...' : 'Generate patient-friendly summary'}
          </button>
        </form>

        <aside className="flex flex-col gap-6">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow relative">
            <div className="flex justify-between items-start mb-5 pb-4 border-b border-slate-100 gap-3">
              <div>
                <p className="text-teal-600 text-[11px] font-bold tracking-[1.5px] uppercase mb-1">Patient Output</p>
                <h2 className="text-xl font-bold text-slate-900 m-0">Treatment Summary</h2>
              </div>
              {summary && <span className="px-3 py-1.5 bg-teal-50 text-teal-700 font-bold text-xs rounded-full border border-teal-500/15">ID #{summary.summary_id || 'Unsaved'}</span>}
            </div>

            {isGenerating ? (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 p-6 pt-[88px] rounded-xl flex flex-col justify-start">
                <div className="mb-4 text-teal-700 font-semibold text-sm flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  {summary ? 'Regenerating Summary...' : 'Generating Summary...'}
                </div>
                <SkeletonLoader />
              </div>
            ) : null}

            {summary && editableSections ? (
              <div className="animate-fade-in relative z-0 min-h-[500px]">
                <div className="bg-teal-50 border-l-[3px] border-teal-600 px-3 py-2.5 rounded-r-md text-xs text-teal-700 mb-4 flex justify-between items-center">
                  <span>💡 <em>Review and edit sections below. Changes must be saved explicitly.</em></span>
                  {hasUnsavedChanges && (
                    <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Unsaved Edits
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3.5">
                  {Object.keys(editableSections).map((key) => {
                    const sectionKey = key as keyof SummarySections;
                    return (
                      <article key={sectionKey} className="border border-slate-200 rounded-lg bg-slate-50 p-3 transition-colors focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
                        <label className="text-[13px] font-bold text-teal-700">
                          {sectionLabels[sectionKey]}
                          <textarea className={`${textareaCls} mt-1.5 !min-h-[70px] !bg-white !text-[13.5px] leading-relaxed`} value={editableSections[sectionKey]} onChange={(e) => setEditableSections(p => p ? ({ ...p, [sectionKey]: e.target.value }) : null)} />
                        </label>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                  <label className="text-[13px] font-bold text-teal-700">
                    📋 Additional Doctor's Notes (వ్యక్తిగత సూచనలు)
                    <textarea className={`${textareaCls} mt-1.5 !min-h-[80px] !bg-white`} placeholder="Add specific diet advice, warning signs, or doctor's note..." value={doctorsNote} onChange={e => setDoctorsNote(e.target.value)} />
                  </label>
                </div>

                <div className="flex gap-2.5 mt-5">
                  <button type="button" className={`flex-1 px-4 py-2.5 rounded-lg font-bold text-[13px] transition-all shadow-sm ${hasUnsavedChanges ? 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow ring-2 ring-teal-500/30 ring-offset-1' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-400'}`} onClick={handleSaveChanges} disabled={isSaving || isGenerating}>
                    {isSaving ? 'Saving...' : hasUnsavedChanges ? '💾 Save Edits' : '💾 Saved'}
                  </button>
                  <button type="button" className="flex-1 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-lg font-semibold text-[13px] hover:bg-slate-50 hover:border-slate-400 transition-all" onClick={handlePrint}>🖨️ Print</button>
                  <button type="button" className="flex-1 bg-[#25d366] text-white border-0 px-4 py-2.5 rounded-lg font-semibold text-[13px] hover:bg-[#20ba5a] hover:shadow-[0_4px_12px_rgba(37,211,102,0.25)] transition-all" onClick={handleWhatsAppShare} disabled={isSharingPdf}>{isSharingPdf ? '⏳ Sharing...' : '💬 Share'}</button>
                </div>

                <div className="flex items-center gap-3 border-t border-slate-100 pt-4 mt-4 text-[13px] font-semibold text-slate-500">
                  <span>Rate summary quality:</span>
                  {renderStars(feedbackRating || 0, true, r => void submitFeedback(r))}
                </div>
              </div>
            ) : isGenerating ? null : (
              <div className="flex flex-col items-center justify-center py-10 px-5 text-slate-500 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                <div className="text-4xl mb-3">📝</div>
                Fill in patient clinical notes and generate a simple, clear post-consultation summary.
              </div>
            )}
          </section>


        </aside>
      </section>

      {/* Hidden Print-Only Layout */}
      {summary && editableSections && (
        <div id="patient-print-summary" className="print-only p-5 border-1 my-10">
          <div className="print-letterhead">
            <div className="letterhead-logo"><span className="cross-icon">✚</span> AYURDHA CLINICS</div>
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
              {form.medications.some(m => m.name) && (
                <table className="print-meds-table">
                  <thead><tr><th>Medicine Name</th><th>Dose (మోతాదు)</th><th>Frequency (ఎప్పుడు వేసుకోవాలి)</th><th>Duration (ఎన్ని రోజులు)</th></tr></thead>
                  <tbody>
                    {form.medications.filter(m => m.name).map((m, idx) => (
                      <tr key={idx}><td className="bold">{m.name}</td><td>{m.dose || '-'}</td><td>{m.frequency || '-'}</td><td>{m.duration || '-'}</td></tr>
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

          <div className="print-footer">
            <p><strong>Note:</strong> This is an AI-assisted summary provided for patient convenience and does not replace the official medical prescription.</p>
            <p>Generated on: {new Date().toLocaleString()}</p>
          </div>
        </div>
      )}
    </>
  )
}
