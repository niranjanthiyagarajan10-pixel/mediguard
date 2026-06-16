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
}
