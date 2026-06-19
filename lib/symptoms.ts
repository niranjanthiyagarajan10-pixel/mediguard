// Symptom check-in helpers. SYMPTOM_TAGS are the quick-pick chips; matchSymptomsToSideEffects
// closes the loop by checking a logged symptom against the side effects the audit already recorded
// for the patient's current medicines — surfacing a gentle "mention this to your pharmacist" note.

import type { Visit } from './types'

export const SYMPTOM_TAGS = [
  'Nausea',
  'Dizziness',
  'Headache',
  'Fatigue',
  'Stomach upset',
  'Rash',
  'Drowsiness',
  'Dry mouth',
  'Trouble sleeping',
  'Swelling',
] as const

export type SideEffectMatch = {
  symptom: string
  medicineName: string
  severity: 'common' | 'serious'
}

// Scan every visit's recorded side effects for the logged symptom keyword. A serious-list match
// outranks a common-list match for the same medicine (we keep the strongest). Case-insensitive
// substring match handles "Stomach upset" vs "upset stomach" loosely enough for a nudge.
export function matchSymptomsToSideEffects(
  symptoms: string[],
  visits: Visit[]
): SideEffectMatch[] {
  const matches = new Map<string, SideEffectMatch>()

  for (const symptom of symptoms) {
    const needle = symptom.toLowerCase()
    for (const visit of visits) {
      for (const se of visit.sideEffects ?? []) {
        const hitSerious = se.serious?.some((s) => s.toLowerCase().includes(needle))
        const hitCommon = se.common?.some((c) => c.toLowerCase().includes(needle))
        if (!hitSerious && !hitCommon) continue
        const key = `${symptom}::${se.medicineName}`
        const severity: SideEffectMatch['severity'] = hitSerious ? 'serious' : 'common'
        const existing = matches.get(key)
        if (!existing || (severity === 'serious' && existing.severity === 'common')) {
          matches.set(key, { symptom, medicineName: se.medicineName, severity })
        }
      }
    }
  }

  return Array.from(matches.values())
}
