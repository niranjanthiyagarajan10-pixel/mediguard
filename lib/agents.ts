import type { Medicine, Interaction, SideEffect, Reminder, Profile, Visit, GlossaryTerm, ChatMessage, ActionItem } from './types'

// Gemini's free tier is capped per model per DAY (RPD). A single model would tap out on a busy
// demo day and break the whole app, so each task gets a task-appropriate list of models tried in
// order. The actual SDK calls + model fallback live server-side in app/api/ai/route.ts (so the API
// key never ships to the browser); this file just builds prompts and POSTs them to that route.

// Balanced tiering: cheap models lead the simple tasks, stronger models lead the hard/structured
// ones, and gemini-2.5-flash (our proven free-quota workhorse) is always in the chain as a
// fallback. The safety-critical audit keeps 2.5-flash as its PRIMARY — that's the Aspirin+Warfarin
// demo moment, so it runs on the model we trust first. If a 3.x preview isn't enabled on the
// account, its 404 is retriable (handled in the route) and we silently drop to the next model.
const MODELS = {
  extractText: ['gemini-3.5-flash', 'gemini-2.5-flash'],
  extractImage: ['gemini-2.5-flash', 'gemini-3.5-flash'], // primary must be multimodal
  audit: ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'],
  educate: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  reminders: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'],
  chatVisit: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  chatHistory: ['gemini-3.5-flash', 'gemini-2.5-flash'],
} as const

type GenOpts = { image?: { data: string; mimeType: string }; models?: readonly string[] }

type ExtractResult = {
  medicines: Medicine[]
  followUpDate?: string
  primaryCondition?: string
  visitSummary?: string
  // AI returns text + category only; id/done are added when the visit is saved.
  actionItems?: { text: string; category?: ActionItem['category'] }[]
}

const REPAIR =
  '\n\nYour previous reply was not valid JSON. Return ONLY valid JSON, nothing else.'

// One generation, via the server-side proxy. The route (app/api/ai/route.ts) holds the API key and
// runs the model-fallback loop, so the key never reaches the browser. On failure the route returns a
// clean { error } message (incl. the friendly free-tier-quota line) which we surface as-is. The
// markdown-fence stripping also happens server-side.
async function generate(prompt: string, opts: GenOpts = {}): Promise<string> {
  let res: Response
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, models: opts.models, image: opts.image }),
    })
  } catch {
    throw new Error('Could not reach the AI service. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || 'The AI service failed. Please try again.')
  }
  return data.text as string
}

// Gemini occasionally wraps JSON in a sentence — slice to the outermost {} or [].
function extractJson(raw: string): string {
  const starts = [raw.indexOf('{'), raw.indexOf('[')].filter((i) => i >= 0)
  if (starts.length === 0) return raw
  const start = Math.min(...starts)
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
  return end > start ? raw.slice(start, end + 1) : raw.slice(start)
}

// Every agent goes through this: parse, and on a bad reply retry once before failing. Forwards
// opts (image + model fallback list) to both the first call and the REPAIR retry.
async function askJson<T>(step: string, prompt: string, opts: GenOpts = {}): Promise<T> {
  let raw = await generate(prompt, opts)
  try {
    return JSON.parse(extractJson(raw)) as T
  } catch {
    raw = await generate(prompt + REPAIR, opts)
    try {
      return JSON.parse(extractJson(raw)) as T
    } catch {
      throw new Error(
        `${step} failed — the AI returned an unreadable response. Please try again.`
      )
    }
  }
}

// Renders the patient profile into a prompt line. Empty when no profile is set, so the
// audit/education/chat prompts read identically to before for users who skip the profile.
function profileBlock(profile?: Profile): string {
  if (!profile) return ''
  const parts: string[] = []
  if (profile.age) parts.push(`age ${profile.age}`)
  if (profile.sex) parts.push(profile.sex)
  if (profile.pregnancy && profile.pregnancy !== 'none') parts.push(profile.pregnancy)
  if (profile.allergies) parts.push(`allergies: ${profile.allergies}`)
  if (profile.conditions) parts.push(`conditions: ${profile.conditions}`)
  if (parts.length === 0) return ''
  return `\nPatient profile: ${parts.join('; ')}.
Personalize warnings to this patient — flag anything that conflicts with their allergies,
pregnancy status, age, or conditions, and say which detail triggered the flag.`
}

// Renders the recent chat turns so a follow-up question keeps its context. The caller caps the
// list (last ~6 turns) before passing it in, to respect the Gemini free-tier token budget.
function historyBlock(history: ChatMessage[]): string {
  if (!history.length) return ''
  const lines = history
    .map((m) => `${m.role === 'user' ? 'Patient' : 'You'}: ${m.content}`)
    .join('\n')
  return `\nConversation so far:\n${lines}\n`
}

const extractPrompt = (
  source: string,
  today: string,
  existingConditions: string[]
) => `
You are extracting medicine data from ${source}.
Return ONLY JSON. No explanation, no markdown.

Shape:
{
  "medicines": [{ id, name, genericName, dosage, frequency, duration, timing, purpose }],
  "followUpDate": "YYYY-MM-DD or null",
  "primaryCondition": "short condition name",
  "visitSummary": "2-3 plain sentences or null",
  "actionItems": [{ text, category }]
}

If a field is unclear, use null. id should be a short slug like "aspirin-1".
For purpose: use the reason the visit states. If no reason is stated, you MAY instead give a
short, widely-known general use prefixed with "General: " (e.g. "General: prevents blood clots").
Never invent a patient-specific reason that wasn't stated.
For followUpDate: if a follow-up is mentioned (e.g. "follow up in two weeks"), resolve it to an
ISO date relative to today (${today}); otherwise null.
For primaryCondition: a short, normalized name for what this visit is mainly about (e.g.
"Type 2 Diabetes", "Hypertension"), inferred from the medicines and visit.
Existing condition names already used for this patient: ${
  existingConditions.length ? existingConditions.join(', ') : 'none yet'
}.
If this visit clearly relates to one of those, return that EXACT string; otherwise return a new
concise name.
For visitSummary: 2-3 plain-English sentences summarizing what this visit was about and what the
doctor decided. No jargon. Use null if the visit text is too thin to summarize honestly.
For actionItems: the non-medicine next steps the visit calls for — lab tests, lifestyle changes,
things to monitor, referrals, and the follow-up appointment. Each has a short "text" and a
"category" (one of: test, lifestyle, monitoring, referral, other). Do NOT repeat medicines or
dosing here. Empty array if none are mentioned.
`

export async function extractMedicines(
  transcript: string,
  existingConditions: string[] = []
): Promise<ExtractResult> {
  const today = new Date().toISOString().split('T')[0]
  const prompt = `${extractPrompt("a doctor's visit transcript", today, existingConditions)}
Transcript:
${transcript}
  `
  return askJson<ExtractResult>('Reading your visit', prompt, { models: MODELS.extractText })
}

export async function extractMedicinesFromImage(
  base64: string,
  mimeType: string,
  existingConditions: string[] = []
): Promise<ExtractResult> {
  const today = new Date().toISOString().split('T')[0]
  const prompt = `${extractPrompt('the attached prescription image', today, existingConditions)}
Read the medicines from the image. If handwriting is unclear, make your best guess.
  `
  return askJson<ExtractResult>('Reading your prescription', prompt, {
    image: { data: base64, mimeType },
    models: MODELS.extractImage,
  })
}

export async function auditInteractions(
  medicines: Medicine[],
  priorPrescription: string,
  profile?: Profile
): Promise<{ interactions: Interaction[]; safetyScore: 'clear' | 'caution' | 'alert' }> {
  const prompt = `
You are a clinical pharmacology safety checker.
Given new medicines and prior prescription history, identify drug interactions.

New medicines: ${JSON.stringify(medicines)}
Prior prescription: ${priorPrescription || 'None provided'}${profileBlock(profile)}

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
  return askJson('Checking for drug interactions', prompt, { models: MODELS.audit })
}

export async function educatePatient(
  medicines: Medicine[],
  interactions: Interaction[],
  profile?: Profile
): Promise<{
  sideEffects: SideEffect[]
  pharmacistQuestions: string[]
  glossaryTerms: GlossaryTerm[]
}> {
  const prompt = `
You are a patient educator explaining medicines in simple, plain language.
For each medicine, list common side effects and serious warnings.
Also generate 3-5 smart questions to ask the pharmacist.
Finally, build a short glossary (3-6 entries) of any medical jargon that appears in the side
effects you write OR in the interaction warnings below (e.g. "antiplatelet", "anticoagulant",
"hypoglycemic"), each with a one-sentence plain-English definition.

Medicines: ${JSON.stringify(medicines)}
Interaction warnings: ${JSON.stringify(interactions)}${profileBlock(profile)}

Return ONLY JSON:
{
  "sideEffects": [{ "medicineName", "common": string[], "serious": string[] }],
  "pharmacistQuestions": string[],
  "glossaryTerms": [{ "term", "definition" }]
}

Write side effects and definitions in plain English. No markdown.
  `
  return askJson('Building your medicine guide', prompt, { models: MODELS.educate })
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
- If duration is missing or open-ended (e.g. "ongoing", "as needed", not stated), set
  totalDays: 0 and endDate equal to startDate to mark it ongoing.

Medicines: ${JSON.stringify(medicines)}

Return ONLY a JSON array:
[{ "id", "medicineName", "dosage", "times", "startDate": "${today}", "endDate", "totalDays", "active": true }]

No markdown.
  `
  return askJson('Setting up reminders', prompt, { models: MODELS.reminders })
}

// Conversational follow-up, grounded in one visit. Returns plain prose (not JSON), so it
// skips askJson and calls generate() directly. The 429 handler in generate() still applies.
// history is the recent (capped) chat so far, so follow-ups keep context.
export async function askAboutMeds(
  question: string,
  visit: Visit,
  history: ChatMessage[] = [],
  profile?: Profile
): Promise<string> {
  const prompt = `
You are a friendly, careful pharmacist assistant answering a patient's question about the
medicines from their recent doctor visit. Use ONLY the data below plus general, well-established
medicine knowledge. Answer in plain language, 2-4 short sentences, no markdown headers.
If the question needs a real clinician (dose changes, worrying symptoms, anything you're unsure
of), say so and tell them to ask their pharmacist or doctor.
If a medicine's purpose isn't in the data below, don't dead-end — share its general, well-known
use, but clearly frame it as general knowledge rather than this patient's specific reason
(e.g. "Aspirin is commonly used to prevent blood clots; your doctor's specific reason wasn't
mentioned in this visit — worth confirming"). Never invent a patient-specific reason.

Medicines: ${JSON.stringify(visit.medicines)}
Known interactions: ${JSON.stringify(visit.interactions)}
Side effects: ${JSON.stringify(visit.sideEffects)}${profileBlock(profile)}
${historyBlock(history)}
Patient question: ${question}
`
  return generate(prompt, { models: MODELS.chatVisit })
}

// Cross-visit chat for the History page. Grounds answers in a condensed summary of every visit
// (date, condition, medicines, safety) — not full transcripts — so the patient can ask how
// things changed over time without blowing the token budget. Prose out, like askAboutMeds.
export async function askAboutHistory(
  visits: Visit[],
  history: ChatMessage[],
  question: string,
  profile?: Profile
): Promise<string> {
  const summary = visits.map((v) => ({
    date: v.date.split('T')[0],
    condition: v.primaryCondition ?? 'unspecified',
    safety: v.safetyScore,
    medicines: v.medicines.map((m) =>
      [m.name, m.dosage, m.frequency].filter(Boolean).join(' ')
    ),
  }))
  const prompt = `
You are a friendly, careful pharmacist assistant helping a patient understand their medical
history across multiple doctor visits. Use ONLY the visit summaries below plus general,
well-established medicine knowledge. Answer in plain language, 2-4 short sentences, no markdown
headers. Visits are newest first — refer to dates when it helps the patient follow a change over
time (e.g. a dose going up between two visits).
If the question needs a real clinician (dose changes, worrying symptoms, anything you're unsure
of), say so and tell them to ask their pharmacist or doctor.

Visit summaries (newest first): ${JSON.stringify(summary)}${profileBlock(profile)}
${historyBlock(history)}
Patient question: ${question}
`
  return generate(prompt, { models: MODELS.chatHistory })
}
