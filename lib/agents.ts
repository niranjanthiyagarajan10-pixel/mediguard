import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Medicine, Interaction, SideEffect, Reminder } from './types'

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

// Helper — every agent uses this
async function ask(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  // Strip markdown fences Gemini sometimes adds
  return text.replace(/```json|```/g, '').trim()
}

export async function extractMedicines(transcript: string): Promise<Medicine[]> {
  const prompt = `
You are extracting medicine data from a doctor's visit transcript.
Return ONLY a JSON array of medicines. No explanation, no markdown.

Schema for each item:
{ id, name, genericName, dosage, frequency, duration, timing, purpose }

If a field is unclear, use null. id should be a short slug like "aspirin-1".

Transcript:
${transcript}
  `
  const raw = await ask(prompt)
  return JSON.parse(raw)
}

export async function auditInteractions(
  medicines: Medicine[],
  priorPrescription: string
): Promise<{ interactions: Interaction[]; safetyScore: 'clear' | 'caution' | 'alert' }> {
  const prompt = `
You are a clinical pharmacology safety checker.
Given new medicines and prior prescription history, identify drug interactions.

New medicines: ${JSON.stringify(medicines)}
Prior prescription: ${priorPrescription || 'None provided'}

Return ONLY JSON:
{
  "safetyScore": "clear" | "caution" | "alert",
  "interactions": [{ "severity", "medicine1", "medicine2", "description", "recommendation" }]
}

safetyScore rules:
- "clear" = no interactions found
- "caution" = low severity interactions only
- "alert" = any medium or high severity interaction

No explanation. No markdown.
  `
  const raw = await ask(prompt)
  return JSON.parse(raw)
}

export async function educatePatient(medicines: Medicine[]): Promise<{
  sideEffects: SideEffect[]
  pharmacistQuestions: string[]
}> {
  const prompt = `
You are a patient educator explaining medicines in simple, plain language.
For each medicine, list common side effects and serious warnings.
Also generate 3-5 smart questions to ask the pharmacist.

Medicines: ${JSON.stringify(medicines)}

Return ONLY JSON:
{
  "sideEffects": [{ "medicineName", "common": string[], "serious": string[] }],
  "pharmacistQuestions": string[]
}

Use plain English. No medical jargon. No markdown.
  `
  const raw = await ask(prompt)
  return JSON.parse(raw)
}

export async function buildReminders(medicines: Medicine[]): Promise<Reminder[]> {
  const today = new Date().toISOString().split('T')[0]
  const prompt = `
Convert medicine frequency and duration into reminder schedules.
Today's date: ${today}

Rules:
- "once daily" → times: ["08:00"]
- "twice daily" → times: ["08:00", "20:00"]
- "three times daily" → times: ["08:00", "14:00", "20:00"]
- "after meals" → add 30 min to standard meal times (07:30, 12:30, 18:30)
- Calculate endDate as startDate + duration in days

Medicines: ${JSON.stringify(medicines)}

Return ONLY a JSON array:
[{ "id", "medicineName", "dosage", "times", "startDate": "${today}", "endDate", "totalDays", "active": true }]

No markdown.
  `
  const raw = await ask(prompt)
  return JSON.parse(raw)
}
