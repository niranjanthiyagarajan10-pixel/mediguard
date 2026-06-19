"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mic,
  ShieldCheck,
  Bell,
  Sun,
  CheckCircle2,
  Circle,
  CalendarClock,
  RefreshCw,
  ArrowRight,
  Flame,
  ListChecks,
} from "lucide-react";
import { getAllReminders, getAllVisits, updateReminder, updateVisit } from "@/lib/db";
import { getTodayDoses, getAdherenceStats } from "@/lib/doses";
import { to12h } from "@/components/ReminderCard";
import SegmentMeter from "@/components/SegmentMeter";
import SpeakButton from "@/components/SpeakButton";
import CheckinCard from "@/components/CheckinCard";
import type { Reminder, Visit } from "@/lib/types";

const features = [
  {
    icon: Mic,
    title: "Record",
    desc: "Capture your visit with live voice transcription — no typing needed.",
  },
  {
    icon: ShieldCheck,
    title: "Audit",
    desc: "AI checks every medicine for interactions, side effects, and conflicts.",
  },
  {
    icon: Bell,
    title: "Remind",
    desc: "Timed reminders so you never miss or double up on a dose.",
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function daysLeft(r: Reminder) {
  const start = new Date(r.startDate).getTime();
  const elapsed = Math.floor((Date.now() - start) / 86_400_000);
  const daysElapsed = Math.min(Math.max(elapsed, 0), r.totalDays);
  return Math.max(r.totalDays - daysElapsed, 0);
}

export default function Home() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAllReminders(), getAllVisits()]).then(([r, v]) => {
      setReminders(r);
      setVisits(v);
      setLoading(false);
    });
  }, []);

  const toggleTaken = async (reminderId: string, key: string) => {
    const r = reminders.find((x) => x.id === reminderId);
    if (!r) return;
    const taken = r.taken ?? [];
    const next = taken.includes(key)
      ? taken.filter((k) => k !== key)
      : [...taken, key];
    await updateReminder(reminderId, { taken: next });
    setReminders((prev) =>
      prev.map((x) => (x.id === reminderId ? { ...x, taken: next } : x))
    );
  };

  const completeAction = async (visitId: string, itemId: string) => {
    const v = visits.find((x) => x.id === visitId);
    if (!v?.actionItems) return;
    const next = v.actionItems.map((a) =>
      a.id === itemId ? { ...a, done: true } : a
    );
    await updateVisit(visitId, { actionItems: next });
    setVisits((prev) =>
      prev.map((x) => (x.id === visitId ? { ...x, actionItems: next } : x))
    );
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  // First run — nothing recorded yet. Show the original welcome hero.
  if (visits.length === 0 && reminders.length === 0) {
    return (
      <main className="mx-auto max-w-5xl px-6">
        <section className="flex flex-col items-center py-20 text-center">
          <h1 className="font-heading text-4xl font-semibold leading-tight text-text sm:text-5xl">
            Know exactly what you&rsquo;re taking.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Record your doctor visit. Get a full safety audit. Never miss a dose.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/quick"
              className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 font-medium text-onp transition hover:opacity-90"
            >
              <Mic className="h-5 w-5" /> Tap &amp; speak your visit
            </Link>
            <Link
              href="/record"
              className="rounded-full border border-border bg-surface px-7 py-3 font-medium text-text transition hover:border-accent"
            >
              Record step by step
            </Link>
          </div>
        </section>

        <section className="grid gap-5 pb-20 sm:grid-cols-3">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              {/* Alternate yellow · sky · yellow so light sky-blue is present, not only on links. */}
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-accent ${
                  i === 1 ? "bg-accent-light" : "bg-primary-light"
                }`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold text-text">
                {f.title}
              </h3>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <footer className="pb-10 text-center text-sm text-muted">
          Your data stays on your device — only the safety check itself is sent to
          AI for analysis.
        </footer>
      </main>
    );
  }

  // ---- Dashboard ----
  const todayDoses = getTodayDoses(reminders);
  const takenCount = todayDoses.filter((d) => d.taken).length;
  const todaySpeakText = todayDoses.length
    ? `Today's doses. ${todayDoses
        .map((d) => `${d.name} ${d.dosage} at ${to12h(d.time)}`)
        .join(". ")}`
    : "";

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  const nextFollowUp = visits
    .filter((v) => v.followUpDate)
    .map((v) => ({ date: v.followUpDate as string, t: new Date(v.followUpDate + "T00:00").getTime() }))
    .filter((x) => x.t >= today0.getTime())
    .sort((a, b) => a.t - b.t)[0];
  const followUpDays = nextFollowUp
    ? Math.round((nextFollowUp.t - today0.getTime()) / 86_400_000)
    : null;

  const refills = reminders
    .filter((r) => r.active && r.totalDays > 0)
    .map((r) => ({ r, left: daysLeft(r) }))
    .filter((x) => x.left <= 3)
    .sort((a, b) => a.left - b.left);

  const latestVisit = visits[0];

  const { streak, weekPct } = getAdherenceStats(reminders);
  const hasWeekData = reminders.length > 0;

  // Open (unchecked) action items across every visit, newest visit first.
  const openTodos = visits.flatMap((v) =>
    (v.actionItems ?? [])
      .filter((a) => !a.done)
      .map((a) => ({
        item: a,
        visitId: v.id,
        condition: v.primaryCondition,
        date: v.date,
      }))
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-heading text-3xl font-semibold text-text">
        {greeting()}.
      </h1>
      <p className="mt-1 text-muted">
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>

      {/* One-tap Easy Mode entry */}
      <Link
        href="/quick"
        className="mt-6 flex items-center gap-4 rounded-2xl bg-primary p-5 text-onp transition hover:opacity-90"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/10">
          <Mic className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">New visit?</h2>
          <p className="text-sm opacity-90">
            Tap and tell me what the doctor said — I&rsquo;ll handle the rest.
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </Link>

      {/* Today's doses */}
      <section className="mt-4 rounded-2xl bg-primary-light p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-accent">
            <Sun className="h-5 w-5" />
            <h2 className="font-heading text-lg font-semibold">
              Today&rsquo;s doses
            </h2>
            {todayDoses.length > 0 && (
              <SpeakButton text={todaySpeakText} className="ml-1" />
            )}
          </div>
          {todayDoses.length > 0 && (
            <div className="flex items-center gap-2.5">
              <SegmentMeter
                ratio={takenCount / todayDoses.length}
                segments={Math.min(todayDoses.length, 10)}
              />
              <span className="font-mono text-sm text-accent">
                {takenCount}/{todayDoses.length}
              </span>
            </div>
          )}
        </div>

        {todayDoses.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No doses scheduled for today.{" "}
            <Link href="/record" className="font-medium text-accent">
              Record a visit
            </Link>{" "}
            to set some up.
          </p>
        ) : (
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
        )}
      </section>

      {/* This week — adherence streak + weekly % */}
      {hasWeekData && (
        <section className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-medium text-text">
                {streak > 0
                  ? `${streak}-day streak`
                  : "Build your streak"}
              </h2>
              <p className="text-sm text-muted">
                {Math.round(weekPct * 100)}% of doses taken this week
              </p>
            </div>
          </div>
          <SegmentMeter ratio={weekPct} />
        </section>
      )}

      {/* Daily symptom check-in (self-loads today's entry) */}
      <CheckinCard visits={visits} />

      {/* To-do from your visits — open action items across all visits */}
      {openTodos.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2 text-accent">
            <ListChecks className="h-5 w-5" />
            <h2 className="font-heading text-lg font-semibold">
              To-do from your visits
            </h2>
          </div>
          <ul className="mt-3 space-y-2">
            {openTodos.map(({ item, visitId, condition, date }) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl bg-bg px-4 py-2.5"
              >
                <button
                  onClick={() => completeAction(visitId, item.id)}
                  aria-label="Mark done"
                  className="mt-0.5 shrink-0 text-muted transition hover:text-success"
                >
                  <Circle className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-text">{item.text}</p>
                  <span className="text-xs text-muted">
                    {condition ? `${condition} · ` : ""}
                    {new Date(date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Follow-up + refills */}
      {(nextFollowUp || refills.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {nextFollowUp && (
            <section className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
              <CalendarClock className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <h2 className="font-medium text-text">Next follow-up</h2>
                <p className="text-sm text-muted">
                  {followUpDays === 0
                    ? "Today"
                    : followUpDays === 1
                      ? "Tomorrow"
                      : `In ${followUpDays} days`}{" "}
                  ·{" "}
                  {new Date(nextFollowUp.date + "T00:00").toLocaleDateString(
                    undefined,
                    { month: "long", day: "numeric" }
                  )}
                </p>
              </div>
            </section>
          )}

          {refills.length > 0 && (
            <section className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
              <RefreshCw className="h-5 w-5 shrink-0 text-warning" />
              <div>
                <h2 className="font-medium text-text">Running low</h2>
                <ul className="text-sm text-muted">
                  {refills.map(({ r, left }) => (
                    <li key={r.id}>
                      {r.medicineName} —{" "}
                      {left === 0 ? "course ended" : `${left} day${left === 1 ? "" : "s"} left`}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Quick actions */}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link
          href="/record"
          className="flex items-center justify-between rounded-2xl bg-primary p-5 text-onp transition hover:opacity-90"
        >
          <span className="font-medium">Record a visit</span>
          <ArrowRight className="h-5 w-5" />
        </Link>
        {latestVisit && (
          <Link
            href={`/audit/${latestVisit.id}`}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 text-text transition hover:border-accent"
          >
            <span className="font-medium">Latest audit</span>
            <ArrowRight className="h-5 w-5 text-accent" />
          </Link>
        )}
        <Link
          href="/reminders"
          className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 text-text transition hover:border-accent"
        >
          <span className="font-medium">All reminders</span>
          <ArrowRight className="h-5 w-5 text-accent" />
        </Link>
      </section>
    </main>
  );
}
