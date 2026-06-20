import type { Reminder } from "./types";

// A follow-up visit to put on the calendar as its own all-day alarmed event.
export type IcsFollowUp = { date: string; label: string };

// Builds a standard .ics from active reminders (+ optional follow-up visits). Each dose time
// becomes a daily-recurring event WITH a VALARM so the user's calendar actually rings at dose
// time; fixed courses use COUNT, ongoing meds recur forever. Follow-ups become all-day events
// with an alarm the day before. This is the local-first "remind me even when the app is closed"
// path — the OS calendar owns every alarm once imported.
export function buildIcs(
  reminders: Reminder[],
  followUps: IcsFollowUp[] = []
): string {
  const stamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MediGuard//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const r of reminders) {
    if (!r.active) continue;
    const [y, mo, d] = r.startDate.split("-");
    r.times.forEach((t, i) => {
      const [hh, mm] = t.split(":");
      const rrule =
        r.totalDays > 0
          ? `RRULE:FREQ=DAILY;COUNT=${r.totalDays}`
          : "RRULE:FREQ=DAILY";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${r.id}-${i}@mediguard`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${y}${mo}${d}T${hh}${mm}00`,
        "DURATION:PT15M",
        rrule,
        `SUMMARY:Take ${r.medicineName} (${r.dosage})`,
        // Alarm fires at dose time (PT0S = no offset) so the phone notifies on every occurrence.
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:Take ${r.medicineName} (${r.dosage})`,
        "TRIGGER:PT0S",
        "END:VALARM",
        "END:VEVENT"
      );
    });
  }

  // Follow-up visits — one all-day event each, alarmed at noon the day before (TRIGGER:-PT12H
  // from the midnight start of an all-day event). Stable UID keyed by date so re-importing dedupes.
  for (const f of followUps) {
    const ymd = f.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:followup-${f.date}@mediguard`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `SUMMARY:Follow-up visit — ${f.label}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:Follow-up visit — ${f.label}`,
      "TRIGGER:-PT12H",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(
  reminders: Reminder[],
  followUps: IcsFollowUp[] = [],
  filename = "mediguard-reminders.ics"
) {
  const blob = new Blob([buildIcs(reminders, followUps)], {
    type: "text/calendar",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
