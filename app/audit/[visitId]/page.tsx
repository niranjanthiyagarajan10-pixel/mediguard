"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  ClipboardList,
  CalendarClock,
  Activity,
  CheckCircle2,
  Circle,
  ListChecks,
  Globe,
  ExternalLink,
} from "lucide-react";
import { getVisit, getProfile, updateVisit } from "@/lib/db";
import { askAboutMeds } from "@/lib/agents";
import type { Visit, Profile } from "@/lib/types";
import MedCard from "@/components/MedCard";
import AskChat from "@/components/AskChat";
import SpeakButton from "@/components/SpeakButton";

const banner = {
  clear: {
    cls: "bg-success text-white",
    title: "All Clear",
    sub: "No interactions found.",
    Icon: ShieldCheck,
  },
  caution: {
    cls: "bg-warning text-white",
    title: "Review Recommended",
    sub: "A few things to keep an eye on.",
    Icon: AlertTriangle,
  },
  alert: {
    cls: "bg-danger text-white",
    title: "Talk to your pharmacist today",
    sub: "We found a serious interaction.",
    Icon: ShieldAlert,
  },
};

export default function AuditPage({ params }: { params: { visitId: string } }) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [profile, setProfile] = useState<Profile | undefined>();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVisit(params.visitId).then((v) => {
      setVisit(v ?? null);
      setLoading(false);
    });
    getProfile().then(setProfile);
  }, [params.visitId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  if (!visit) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-muted">Visit not found.</p>
        <Link href="/history" className="mt-4 inline-block font-medium text-accent">
          Back to history
        </Link>
      </main>
    );
  }

  const b = banner[visit.safetyScore];

  const copyQuestions = async () => {
    await navigator.clipboard.writeText(visit.pharmacistQuestions.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAction = async (id: string) => {
    if (!visit.actionItems) return;
    const next = visit.actionItems.map((a) =>
      a.id === id ? { ...a, done: !a.done } : a
    );
    setVisit({ ...visit, actionItems: next });
    await updateVisit(visit.id, { actionItems: next });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className={`flex items-center gap-4 rounded-2xl p-6 ${b.cls}`}>
        <b.Icon className="h-8 w-8 shrink-0" />
        <div>
          <h1 className="font-heading text-2xl font-semibold">{b.title}</h1>
          <p className="opacity-90">{b.sub}</p>
        </div>
      </div>

      {visit.primaryCondition && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium text-accent">
            <Activity className="h-3.5 w-3.5" />
            {visit.primaryCondition}
          </span>
        </div>
      )}

      {visit.visitSummary && (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-text">
              What happened at your visit
            </h2>
            <SpeakButton text={visit.visitSummary} className="shrink-0" />
          </div>
          <p className="mt-2 leading-relaxed text-muted">{visit.visitSummary}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-heading text-xl font-semibold text-text">
          Your medicines
        </h2>
        <p className="mt-1 text-sm text-muted">
          Tap a card for how to take it, side effects, and any warnings.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {visit.medicines.map((m) => (
            <MedCard
              key={m.id}
              medicine={m}
              interactions={visit.interactions.filter(
                (it) => it.medicine1 === m.name || it.medicine2 === m.name
              )}
              sideEffect={visit.sideEffects.find(
                (se) => se.medicineName === m.name
              )}
              glossaryTerms={visit.glossaryTerms ?? []}
            />
          ))}
        </div>
      </section>

      {visit.actionItems && visit.actionItems.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-accent" />
              <h2 className="font-heading text-xl font-semibold text-text">
                Your action plan
              </h2>
            </div>
            {(() => {
              const open = visit.actionItems!.filter((a) => !a.done);
              const text = open.length
                ? `Your action plan. ${open.map((a) => a.text).join(". ")}`
                : "All action items are done.";
              return <SpeakButton text={text} label="Read steps" className="shrink-0" />;
            })()}
          </div>
          <p className="mt-1 text-sm text-muted">
            Next steps from your visit beyond medicines. Check them off as you go.
          </p>
          <ul className="mt-4 space-y-2">
            {visit.actionItems.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <button
                  onClick={() => toggleAction(a.id)}
                  aria-label={a.done ? "Mark not done" : "Mark done"}
                  className={`mt-0.5 shrink-0 transition ${
                    a.done ? "text-success" : "text-muted hover:text-accent"
                  }`}
                >
                  {a.done ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div>
                  <p
                    className={
                      a.done ? "text-muted line-through" : "text-text"
                    }
                  >
                    {a.text}
                  </p>
                  {a.category && (
                    <span className="mt-1 inline-block text-xs uppercase tracking-wide text-muted">
                      {a.category}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visit.safetyNotes && (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-accent" />
              <h2 className="font-heading text-xl font-semibold text-text">
                Checked against current sources
              </h2>
            </div>
            <SpeakButton text={visit.safetyNotes} className="shrink-0" />
          </div>
          <p className="mt-3 leading-relaxed text-muted">{visit.safetyNotes}</p>
          {visit.safetySources && visit.safetySources.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Sources
              </p>
              <ul className="mt-2 space-y-1.5">
                {visit.safetySources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1.5 text-sm font-medium text-accent hover:underline"
                    >
                      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {visit.pharmacistQuestions.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-text">
              Questions for your pharmacist
            </h2>
            <button
              onClick={copyQuestions}
              className="flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>
          <ol className="mt-4 list-decimal space-y-2 rounded-2xl border border-border bg-surface p-5 pl-9 text-sm text-text">
            {visit.pharmacistQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      <AskChat
        title="Ask about these medicines"
        subtitle="Plain-language answers based on your visit. Not a substitute for your pharmacist or doctor."
        suggestions={[
          "Can I take these together?",
          "What if I miss a dose?",
          "Should any be taken with food?",
          "Why was this prescribed?",
        ]}
        onAsk={(q, h) => askAboutMeds(q, visit, h, profile)}
      />

      {visit.followUpDate && (
        <section className="mt-8 flex items-start gap-3 rounded-2xl border border-border bg-surface p-5">
          <CalendarClock className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="font-medium text-text">Follow-up visit</h2>
            <p className="text-sm text-muted">
              Your doctor asked to see you on{" "}
              <span className="font-medium text-text">
                {new Date(visit.followUpDate + "T00:00").toLocaleDateString(
                  undefined,
                  { weekday: "long", year: "numeric", month: "long", day: "numeric" }
                )}
              </span>
              .
            </p>
          </div>
        </section>
      )}

      <section className="mt-8 flex items-start gap-3 rounded-2xl bg-primary-light p-5">
        <ClipboardList className="h-5 w-5 shrink-0 text-accent" />
        <div>
          <h2 className="font-medium text-text">Reminders set up</h2>
          <p className="text-sm text-muted">
            Daily reminders set for{" "}
            {visit.medicines.map((m) => m.name).join(", ")}.{" "}
            <Link href="/reminders" className="font-medium text-accent">
              View &amp; add to calendar
            </Link>
          </p>
        </div>
      </section>

      <div className="mt-10 text-center">
        <Link href="/record" className="text-sm font-medium text-accent">
          Record another visit
        </Link>
      </div>
    </main>
  );
}
