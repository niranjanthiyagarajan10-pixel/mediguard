"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sun, BellOff, CalendarPlus, CheckCircle2, Circle, Flame } from "lucide-react";
import { getAllReminders, updateReminder, deleteReminder } from "@/lib/db";
import { downloadIcs } from "@/lib/ics";
import { getTodayDoses, getAdherenceStats } from "@/lib/doses";
import type { Reminder } from "@/lib/types";
import ReminderCard, { to12h } from "@/components/ReminderCard";
import SegmentMeter from "@/components/SegmentMeter";

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllReminders().then((r) => {
      setReminders(r);
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, active: boolean) => {
    await updateReminder(id, { active });
    const r = reminders.find((x) => x.id === id);
    pendo?.track("reminder_toggled", {
      medicineName: r?.medicineName ?? "",
      newActiveState: active,
    });
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active } : r))
    );
  };

  const remove = async (id: string) => {
    const r = reminders.find((x) => x.id === id);
    await deleteReminder(id);
    pendo?.track("reminder_deleted", {
      medicineName: r?.medicineName ?? "",
    });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleTaken = async (reminderId: string, key: string) => {
    const r = reminders.find((x) => x.id === reminderId);
    if (!r) return;
    const taken = r.taken ?? [];
    const next = taken.includes(key)
      ? taken.filter((k) => k !== key)
      : [...taken, key];
    await updateReminder(reminderId, { taken: next });
    pendo?.track("dose_logged", {
      medicineName: r.medicineName,
      dosage: r.dosage,
      scheduledTime: key,
      action: taken.includes(key) ? "untaken" : "taken",
      source: "reminders",
    });
    setReminders((prev) =>
      prev.map((x) => (x.id === reminderId ? { ...x, taken: next } : x))
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  if (reminders.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <BellOff className="mx-auto h-10 w-10 text-muted" />
        <p className="mt-4 text-muted">No reminders yet.</p>
        <Link
          href="/record"
          className="mt-4 inline-block font-medium text-accent"
        >
          Record a visit to set them up
        </Link>
      </main>
    );
  }

  const todayDoses = getTodayDoses(reminders);
  const takenCount = todayDoses.filter((d) => d.taken).length;
  const { streak, weekPct } = getAdherenceStats(reminders);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold text-text">
          Reminders
        </h1>
        <button
          onClick={() => {
            downloadIcs(reminders);
            pendo?.track("calendar_exported", {
              reminderCount: reminders.length,
              activeReminderCount: reminders.filter((r) => r.active).length,
            });
          }}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-onp transition hover:opacity-90"
        >
          <CalendarPlus className="h-4 w-4" />
          Add to calendar
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        Export once and your own calendar app handles the reminders — no need to
        keep this open.
      </p>

      <div className="mt-4 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-accent">
          <Flame className="h-4 w-4" />
          {streak > 0 ? `${streak}-day streak` : "No streak yet"}
        </span>
        <span className="text-muted">·</span>
        <span className="flex items-center gap-2 text-muted">
          <SegmentMeter ratio={weekPct} />
          {Math.round(weekPct * 100)}% this week
        </span>
      </div>

      {todayDoses.length > 0 && (
        <section className="mt-6 rounded-2xl bg-primary-light p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent">
              <Sun className="h-5 w-5" />
              <h2 className="font-heading text-lg font-semibold">
                Today&rsquo;s doses
              </h2>
            </div>
            <div className="flex items-center gap-2.5">
              <SegmentMeter
                ratio={takenCount / todayDoses.length}
                segments={Math.min(todayDoses.length, 10)}
              />
              <span className="font-mono text-sm text-accent">
                {takenCount}/{todayDoses.length}
              </span>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {todayDoses.map((dose) => (
              <li
                key={dose.reminderId + dose.time}
                className="flex items-center justify-between rounded-xl bg-surface px-4 py-2.5"
              >
                <span
                  className={`font-medium ${
                    dose.taken ? "text-muted line-through" : "text-text"
                  }`}
                >
                  {dose.name}{" "}
                  <span className="font-mono text-sm text-muted">
                    {dose.dosage}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-accent">
                    {to12h(dose.time)}
                  </span>
                  <button
                    onClick={() => toggleTaken(dose.reminderId, dose.key)}
                    aria-label={dose.taken ? "Mark dose not taken" : "Mark dose taken"}
                    className={`transition ${
                      dose.taken
                        ? "text-success"
                        : "text-muted hover:text-accent"
                    }`}
                  >
                    {dose.taken ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Circle className="h-6 w-6" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-heading text-xl font-semibold text-text">
          All medications
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {reminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
