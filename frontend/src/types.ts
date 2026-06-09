export type Medication = { name: string; dose: string; frequency: string; duration: string }
export type SummarySections = { section1: string; section2: string; section3: string; section4: string }
export type GenerateResponse = { consultation_id?: number | null; summary_id?: number | null; summary: string; sections: SummarySections; doctors_note?: string }
export type HistoryItem = { id: number; patient_name: string; age: number; complaint: string; diagnosis: string; speciality?: string; language?: string; understanding_level?: string; created_at: string }
export type Template = { id: number; title: string; complaint: string; diagnosis: string; treatment: string; followup: string | null }
export type FormState = { patient_name: string; age: string; complaint: string; diagnosis: string; treatment: string; followup: string; medications: Medication[]; speciality: string; language: string; understanding_level: string }
export type BackendStatus = 'checking' | 'connected' | 'disconnected'
