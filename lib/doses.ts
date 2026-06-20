import type { Reminder } from "./types";

export type Dose = {
  reminderId: string;
  time: string;
  name: string;
  dosage: string;
  key: string;
  taken: boolean;
};

export type AdherenceStats = {
  streak: number; // consecutive fully-taken days ending today/yesterday
  weekPct: number; // 0–1 over the last 7 days that had scheduled doses
  last7: { date: string; taken: number; total: number }[]; // oldest first
};

// Local YYYY-MM-DD — matches the date half of a Reminder.taken key.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Doses scheduled on a given calendar day across all active reminders, sorted by time. A reminder
// counts for the day if its [start, end] interval overlaps that day; ongoing meds (totalDays 0)
// run every day from their start. The `key` (date + time) is what `Reminder.taken` records, so it
// doubles as the taken flag + toggle id.
export function getDosesForDate(reminders: Reminder[], date: Date): Dose[] {
  const dayStr = dateKey(date);
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayStartMs + 86_400_000; // exclusive

  return reminders
    .filter((r) => {
      if (!r.active) return false;
      const start = new Date(r.startDate).getTime();
      if (start >= dayEndMs) return false; // hasn't started by this day
      if (r.totalDays === 0) return true; // ongoing — scheduled every day once started
      const end = new Date(r.endDate).getTime() + 86_400_000; // include the end day
      return end > dayStartMs; // course hasn't already ended before this day
    })
    .flatMap((r) =>
      r.times.map((t) => {
        const key = `${dayStr}T${t}`;
        return {
          reminderId: r.id,
          time: t,
          name: r.medicineName,
          dosage: r.dosage,
          key,
          taken: (r.taken ?? []).includes(key),
        };
      })
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function getTodayDoses(reminders: Reminder[]): Dose[] {
  return getDosesForDate(reminders, new Date());
}

// Today's doses whose scheduled time has already passed and which haven't been marked taken — the
// "you missed this" nudge. Compares scheduled "HH:MM" against the current "HH:MM" (string compare
// is safe because both are zero-padded 24h), so a 08:00 dose is "missed" once it's past 08:00.
export function getMissedDoses(reminders: Reminder[]): Dose[] {
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  return getTodayDoses(reminders).filter((d) => !d.taken && d.time < nowHM);
}

// Adherence over the last 7 days plus a current streak — all derived from Reminder.taken, so no
// extra storage. Days with no scheduled doses are ignored (they neither help nor break a streak).
export function getAdherenceStats(reminders: Reminder[]): AdherenceStats {
  const last7: AdherenceStats["last7"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const doses = getDosesForDate(reminders, d);
    last7.push({
      date: dateKey(d),
      total: doses.length,
      taken: doses.filter((x) => x.taken).length,
    });
  }
  const totalSched = last7.reduce((s, x) => s + x.total, 0);
  const totalTaken = last7.reduce((s, x) => s + x.taken, 0);
  const weekPct = totalSched === 0 ? 0 : totalTaken / totalSched;

  // Walk back from today, counting consecutive fully-taken days. An in-progress today (doses
  // scheduled but not all taken yet) shouldn't break the streak, so start at yesterday unless
  // today is already complete.
  const todayDoses = getDosesForDate(reminders, new Date());
  const todayComplete =
    todayDoses.length > 0 && todayDoses.every((x) => x.taken);
  let streak = 0;
  for (let i = todayComplete ? 0 : 1; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const doses = getDosesForDate(reminders, d);
    if (doses.length === 0) continue; // nothing scheduled — skip
    if (doses.every((x) => x.taken)) streak++;
    else break;
  }

  return { streak, weekPct, last7 };
}
