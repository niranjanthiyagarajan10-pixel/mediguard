import type { Reminder } from "./types";

// Builds a standard .ics from active reminders. Each dose time becomes a
// daily-recurring event; fixed courses use COUNT, ongoing meds recur forever.
export function buildIcs(reminders: Reminder[]): string {
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
        "END:VEVENT"
      );
    });
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(
  reminders: Reminder[],
  filename = "mediguard-reminders.ics"
) {
  const blob = new Blob([buildIcs(reminders)], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
