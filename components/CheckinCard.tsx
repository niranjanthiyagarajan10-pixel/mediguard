"use client";

import { useEffect, useState } from "react";
import { Smile, Meh, Frown, HeartPulse, Check, AlertTriangle } from "lucide-react";
import { getCheckin, saveCheckin } from "@/lib/db";
import { SYMPTOM_TAGS, matchSymptomsToSideEffects } from "@/lib/symptoms";
import type { Visit, SymptomCheckin } from "@/lib/types";

const feelings = [
  { id: "good", label: "Good", Icon: Smile },
  { id: "okay", label: "Okay", Icon: Meh },
  { id: "bad", label: "Not great", Icon: Frown },
] as const;

type Feeling = (typeof feelings)[number]["id"];

// Local date key (YYYY-MM-DD) — toISOString would shift to UTC and roll the day near midnight.
function todayKey() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Daily symptom check-in. Picking a feeling reveals quick symptom chips; saving correlates the
// chosen symptoms against the patient's recorded side effects and surfaces a pharmacist nudge.
export default function CheckinCard({ visits }: { visits: Visit[] }) {
  const today = todayKey();
  const [saved, setSaved] = useState<SymptomCheckin | null>(null);
  const [editing, setEditing] = useState(false);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    getCheckin(today).then((c) => {
      if (c) setSaved(c);
    });
  }, [today]);

  const startEdit = (f: Feeling) => {
    setFeeling(f);
    setSymptoms(saved?.symptoms ?? []);
    setNote(saved?.note ?? "");
    setEditing(true);
  };

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const save = async () => {
    if (!feeling) return;
    const checkin: SymptomCheckin = {
      id: today,
      date: today,
      feeling,
      symptoms,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    await saveCheckin(checkin);
    setSaved(checkin);
    setEditing(false);
  };

  // ---- Logged + not editing: summary + any correlation notes ----
  if (saved && !editing) {
    const matches = matchSymptomsToSideEffects(saved.symptoms, visits);
    const current = feelings.find((f) => f.id === saved.feeling)!;
    return (
      <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-light text-accent">
              <current.Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-medium text-text">
                You&rsquo;re feeling {current.label.toLowerCase()} today
              </h2>
              {saved.symptoms.length > 0 && (
                <p className="text-sm text-muted">{saved.symptoms.join(", ")}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => startEdit(saved.feeling)}
            className="text-sm font-medium text-accent"
          >
            Update
          </button>
        </div>

        {matches.map((m) => (
          <div
            key={m.symptom + m.medicineName}
            className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${
              m.severity === "serious"
                ? "bg-danger-light text-text"
                : "bg-primary-light text-text"
            }`}
          >
            <AlertTriangle
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                m.severity === "serious" ? "text-danger" : "text-accent"
              }`}
            />
            <span>
              {m.symptom} can be a{" "}
              {m.severity === "serious" ? "serious " : ""}side effect of{" "}
              <span className="font-medium">{m.medicineName}</span>. Mention it to
              your pharmacist.
            </span>
          </div>
        ))}
      </section>
    );
  }

  // ---- Picker (first log of the day, or editing) ----
  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-accent">
        <HeartPulse className="h-5 w-5" />
        <h2 className="font-heading text-lg font-semibold">
          How are you feeling today?
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {feelings.map((f) => (
          <button
            key={f.id}
            onClick={() => startEdit(f.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition ${
              feeling === f.id
                ? "border-accent bg-accent-light text-accent"
                : "border-border bg-bg text-muted hover:border-accent"
            }`}
          >
            <f.Icon className="h-8 w-8" />
            <span className="text-sm font-medium">{f.label}</span>
          </button>
        ))}
      </div>

      {editing && feeling && (
        <div className="mt-5">
          <p className="text-sm font-medium text-text">
            Any symptoms? (optional)
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SYMPTOM_TAGS.map((s) => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  symptoms.includes(s)
                    ? "border-accent bg-accent-light text-accent"
                    : "border-border bg-bg text-text hover:border-accent"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else you want to note? (optional)"
            rows={2}
            className="mt-3 w-full rounded-xl border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={save}
            className="mt-3 flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-medium text-onp transition hover:opacity-90"
          >
            <Check className="h-4 w-4" /> Save check-in
          </button>
        </div>
      )}
    </section>
  );
}
