export type Medicine = {
  id: string
  name: string
  genericName?: string
  dosage: string
  frequency: string
  duration: string
  timing?: string
  purpose?: string
}

export type Interaction = {
  severity: 'low' | 'medium' | 'high'
  medicine1: string
  medicine2: string
  description: string
  recommendation: string
}

export type SideEffect = {
  medicineName: string
  common: string[]
  serious: string[]
}

export type GlossaryTerm = {
  term: string
  definition: string
}

// A non-medicine next step from the visit (lab test, lifestyle change, monitoring, referral).
// done-state lives here on the Visit, so checking one off needs no new store.
export type ActionItem = {
  id: string
  text: string
  category?: 'test' | 'lifestyle' | 'monitoring' | 'referral' | 'other'
  done?: boolean
}

// One turn in an Ask chat. Kept generic so both the per-visit and cross-visit chats share it.
export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type Visit = {
  id: string
  date: string
  transcript: string
  medicines: Medicine[]
  interactions: Interaction[]
  sideEffects: SideEffect[]
  pharmacistQuestions: string[]
  safetyScore: 'clear' | 'caution' | 'alert'
  priorPrescription?: string
  followUpDate?: string
  // Plain-English definitions for jargon shown on the audit cards (tap-to-define)
  glossaryTerms?: GlossaryTerm[]
  // Short normalized ailment name — threads related visits together on History
  primaryCondition?: string
  // Plain-language recap of what the visit was about — shown atop the audit
  visitSummary?: string
  // Non-medicine next steps the patient can check off (care-plan accountability)
  actionItems?: ActionItem[]
}

export type Reminder = {
  id: string
  medicineName: string
  dosage: string
  times: string[]
  startDate: string
  endDate: string
  totalDays: number
  active: boolean
  // Keys of doses already taken, e.g. "2026-06-17T08:00" (date + scheduled time)
  taken?: string[]
}

// Local-only patient profile (single record). Feeds the audit so warnings are personalized.
// Freeform strings keep the form simple and read fine in the Gemini prompt.
export type Profile = {
  age?: number
  sex?: 'male' | 'female' | 'other'
  allergies?: string
  conditions?: string
  pregnancy?: 'none' | 'pregnant' | 'breastfeeding'
}

// One daily symptom check-in. id == date (YYYY-MM-DD), so re-logging the same day overwrites —
// one record per day, no duplicates. Symptoms are matched against current meds' side effects to
// surface "mention this to your pharmacist" notes.
export type SymptomCheckin = {
  id: string          // = date (YYYY-MM-DD)
  date: string        // YYYY-MM-DD
  feeling: 'good' | 'okay' | 'bad'
  symptoms: string[]
  note?: string
  createdAt: string   // ISO timestamp of when it was logged
}
