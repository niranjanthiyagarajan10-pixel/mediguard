// On-device spoken safety report for Easy Mode — composed from a finished Visit, NO Gemini call.
// This keeps the headline voice feature at zero requests-per-day cost (on-brand with the RPD theme)
// and makes the demo deterministic. `speech` is fed to speak(); `lines` renders the same content in
// large type on screen; `headline` matches the audit banner title.

import type { Visit, Interaction } from './types'

const rank = { low: 0, medium: 1, high: 2 } as const

const openings: Record<Visit['safetyScore'], { headline: string; line: string }> = {
  clear: { headline: 'All clear', line: 'Good news. I checked your medicines and everything looks safe.' },
  caution: { headline: 'Review recommended', line: 'I checked your medicines. A few things are worth keeping an eye on.' },
  alert: { headline: 'Talk to your pharmacist today', line: 'Please talk to your pharmacist today. I found a serious problem.' },
}

// "Aspirin, once a day." — plain how-to-take from the structured fields, skipping empties.
function howToTake(frequency?: string, timing?: string): string {
  const parts = [frequency, timing].map((p) => (p ?? '').trim()).filter(Boolean)
  return parts.length ? parts.join(', ') : 'as directed'
}

function interactionLine(it: Interaction): string {
  const rec = it.recommendation?.trim()
  return `${it.medicine1} and ${it.medicine2} together: ${it.description.trim()}${
    rec ? ' ' + rec : ''
  }`
}

export function buildSpokenReport(visit: Visit): {
  headline: string
  lines: string[]
  speech: string
} {
  const open = openings[visit.safetyScore] ?? openings.clear
  const lines: string[] = [open.line]

  // Lead with the most serious interactions (top 2) so the warning is heard first.
  const serious = [...visit.interactions]
    .filter((it) => rank[it.severity] >= rank.medium)
    .sort((a, b) => rank[b.severity] - rank[a.severity])
    .slice(0, 2)
  serious.forEach((it) => lines.push(interactionLine(it)))

  const meds = visit.medicines ?? []
  if (meds.length) {
    const count = `You have ${meds.length} medicine${meds.length === 1 ? '' : 's'}.`
    const each = meds
      .map((m) => `${m.name}, ${howToTake(m.frequency, m.timing)}.`)
      .join(' ')
    lines.push(`${count} ${each}`)
    lines.push("I've set daily reminders for all of them.")
  }

  if (visit.followUpDate) {
    const d = new Date(visit.followUpDate + 'T00:00').toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    lines.push(`Your doctor wants to see you again on ${d}.`)
  }

  lines.push('Tap See details for more, or ask me a question.')

  return { headline: open.headline, lines, speech: lines.join(' ') }
}
