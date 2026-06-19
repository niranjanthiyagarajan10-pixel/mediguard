"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Mic,
  Keyboard,
  Image as ImageIcon,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import {
  extractMedicines,
  extractMedicinesFromImage,
  auditInteractions,
  educatePatient,
  buildReminders,
} from "@/lib/agents";
import { saveVisit, saveReminders, getProfile, getAllVisits } from "@/lib/db";
import type { Medicine, Visit, ActionItem } from "@/lib/types";

type Mode = "speak" | "type" | "photo";

const modes: { id: Mode; label: string; Icon: typeof Mic }[] = [
  { id: "speak", label: "Speak", Icon: Mic },
  { id: "type", label: "Type", Icon: Keyboard },
  { id: "photo", label: "Photo", Icon: ImageIcon },
];

export default function RecordPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("speak");
  const [transcript, setTranscript] = useState("");
  const [showPrior, setShowPrior] = useState(false);
  const [priorPrescription, setPriorPrescription] = useState("");
  const [image, setImage] = useState<{
    data: string;
    mimeType: string;
    name: string;
  } | null>(null);

  const [step, setStep] = useState<"input" | "review">("input");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [followUpDate, setFollowUpDate] = useState<string | undefined>();
  const [primaryCondition, setPrimaryCondition] = useState<string | undefined>();
  const [visitSummary, setVisitSummary] = useState<string | undefined>();
  // AI returns text+category only; id/done are added when the visit is saved.
  const [actionItems, setActionItems] = useState<
    { text: string; category?: ActionItem["category"] }[]
  >([]);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const canExtract =
    !busy && (mode === "photo" ? !!image : wordCount >= 15);

  const appendFinal = (chunk: string) =>
    setTranscript((prev) => (prev ? prev + " " : "") + chunk.trim());

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage({ data: dataUrl.split(",")[1], mimeType: f.type, name: f.name });
      pendo?.track("prescription_photo_selected", {
        mimeType: f.type,
        fileName: f.name,
      });
    };
    reader.readAsDataURL(f);
  };

  // Phase 1 — pull medicines out of the visit, then let the user fix them.
  async function extract() {
    setBusy(true);
    setError("");
    setStatus("Reading…");
    try {
      // Ground the condition tag against names already used so a related visit reuses the
      // exact existing label instead of coining a near-duplicate.
      const visits = await getAllVisits();
      const existingConditions = Array.from(
        new Set(
          visits.map((v) => v.primaryCondition).filter((c): c is string => !!c)
        )
      );
      const res =
        mode === "photo" && image
          ? await extractMedicinesFromImage(
              image.data,
              image.mimeType,
              existingConditions
            )
          : await extractMedicines(transcript, existingConditions);
      setMedicines(res.medicines ?? []);
      setFollowUpDate(res.followUpDate ?? undefined);
      setPrimaryCondition(res.primaryCondition ?? undefined);
      setVisitSummary(res.visitSummary ?? undefined);
      setActionItems(res.actionItems ?? []);
      setStep("review");
      pendo?.track("medicines_extracted", {
        inputMode: mode,
        medicineCount: res.medicines?.length ?? 0,
        hasFollowUp: !!res.followUpDate,
        hasPrimaryCondition: !!res.primaryCondition,
        hasVisitSummary: !!res.visitSummary,
        actionItemCount: res.actionItems?.length ?? 0,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong reading your visit. Please try again."
      );
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  // Phase 2 — run the safety audit on the (possibly edited) medicines and save.
  async function runAudit() {
    setBusy(true);
    setError("");
    try {
      const profile = await getProfile();

      setStatus("Checking for drug interactions…");
      const { interactions, safetyScore } = await auditInteractions(
        medicines,
        priorPrescription,
        profile
      );

      setStatus("Building your medicine guide…");
      const { sideEffects, pharmacistQuestions, glossaryTerms } =
        await educatePatient(medicines, interactions, profile);

      setStatus("Setting up reminders…");
      const reminders = await buildReminders(medicines);

      const visit: Visit = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        transcript: mode === "photo" ? "(from prescription photo)" : transcript,
        medicines,
        interactions,
        sideEffects,
        pharmacistQuestions,
        safetyScore,
        priorPrescription: priorPrescription || undefined,
        followUpDate,
        glossaryTerms,
        primaryCondition,
        visitSummary,
        actionItems: actionItems.map((a) => ({
          id: crypto.randomUUID(),
          text: a.text,
          category: a.category,
          done: false,
        })),
      };
      await saveVisit(visit);
      await saveReminders(reminders);
      pendo?.track("visit_recorded", {
        inputMode: mode,
        medicineCount: visit.medicines.length,
        safetyScore: visit.safetyScore,
        interactionCount: visit.interactions.length,
        hasPriorPrescription: !!priorPrescription,
        hasFollowUp: !!followUpDate,
        primaryCondition: primaryCondition ?? "",
        actionItemCount: visit.actionItems?.length ?? 0,
        visitId: visit.id,
      });
      router.push(`/audit/${visit.id}`);
    } catch (e) {
      setBusy(false);
      setStatus("");
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong analyzing your visit. Please try again."
      );
    }
  }

  const updateMed = (i: number, field: keyof Medicine, value: string) =>
    setMedicines((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m))
    );
  const removeMed = (i: number) =>
    setMedicines((prev) => prev.filter((_, idx) => idx !== i));

  // ---- Review step ----
  if (step === "review") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <button
          onClick={() => setStep("input")}
          className="flex items-center gap-1 text-sm font-medium text-muted transition hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-text">
          Check the medicines
        </h1>
        <p className="mt-2 text-muted">
          We pulled these from your visit. Fix anything that looks off before the
          safety audit runs.
        </p>

        {medicines.length === 0 ? (
          <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            No medicines were detected. Go back and add more detail, or type the
            visit out.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            {medicines.map((m, i) => (
              <div
                key={m.id ?? i}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={m.name ?? ""}
                    onChange={(e) => updateMed(i, "name", e.target.value)}
                    placeholder="Medicine name"
                    className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 font-medium text-text outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => removeMed(i)}
                    aria-label="Remove medicine"
                    className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-danger hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(["dosage", "frequency", "duration"] as const).map((field) => (
                    <label key={field} className="block">
                      <span className="text-xs uppercase text-muted">{field}</span>
                      <input
                        value={m[field] ?? ""}
                        onChange={(e) => updateMed(i, field, e.target.value)}
                        className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center">
          <button
            onClick={runAudit}
            disabled={busy || medicines.length === 0}
            className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-medium text-onp transition hover:opacity-90 disabled:opacity-70"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? status : "Run safety audit"}
          </button>
          {error && (
            <p className="mt-4 max-w-md text-center text-sm text-danger">{error}</p>
          )}
        </div>
      </main>
    );
  }

  // ---- Input step ----
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-center font-heading text-3xl font-semibold text-text">
        Record your visit
      </h1>
      <p className="mt-2 text-center text-muted">
        Speak, type, or upload a prescription — we&rsquo;ll do the rest.
      </p>

      <div className="mt-8 flex justify-center">
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                mode === m.id
                  ? "bg-primary text-onp"
                  : "text-muted hover:text-text"
              }`}
            >
              <m.Icon className="h-4 w-4" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8">
        {mode === "speak" && (
          <div className="flex flex-col items-center">
            <VoiceRecorder transcript={transcript} onFinal={appendFinal} />
          </div>
        )}

        {mode === "type" && (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Type or paste what the doctor told you. e.g. Take Aspirin 75mg once daily. Starting Metformin 500mg twice daily after meals for 30 days. Follow up in two weeks."
            rows={6}
            className="w-full rounded-xl border border-border bg-surface p-4 leading-relaxed outline-none focus:border-accent"
          />
        )}

        {mode === "photo" && (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-accent">
            <ImageIcon className="h-8 w-8 text-muted" />
            <span className="mt-3 font-medium text-text">
              {image ? image.name : "Upload a prescription photo"}
            </span>
            <span className="mt-1 text-sm text-muted">
              {image ? "Tap to choose a different photo" : "JPG or PNG"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={onFile}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={() => setShowPrior((s) => !s)}
          className="flex items-center gap-1 text-sm font-medium text-accent"
        >
          {showPrior ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Add prior prescription (optional)
        </button>
        {showPrior && (
          <textarea
            value={priorPrescription}
            onChange={(e) => setPriorPrescription(e.target.value)}
            placeholder="e.g. Currently on Warfarin 5mg daily for atrial fibrillation."
            rows={3}
            className="mt-2 w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-accent"
          />
        )}
      </div>

      <div className="mt-8 flex flex-col items-center">
        {canExtract || busy ? (
          <button
            onClick={extract}
            disabled={!canExtract}
            className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 font-medium text-onp transition hover:opacity-90 disabled:opacity-70"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? status : "Analyze visit"}
          </button>
        ) : (
          <p className="text-sm text-muted">
            {mode === "photo"
              ? "Upload a prescription photo to continue."
              : wordCount === 0
                ? "Start recording to capture your visit."
                : `Keep going — ${15 - wordCount} more word${
                    15 - wordCount === 1 ? "" : "s"
                  } to analyze.`}
          </p>
        )}
        {error && (
          <p className="mt-4 max-w-md text-center text-sm text-danger">{error}</p>
        )}
      </div>
    </main>
  );
}
