"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  Square,
  Loader2,
  Volume2,
  ArrowRight,
  Keyboard,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";
import {
  extractMedicines,
  auditInteractions,
  educatePatient,
  buildReminders,
} from "@/lib/agents";
import { saveVisit, saveReminders, getProfile, getAllVisits } from "@/lib/db";
import {
  createRecognition,
  isRecognitionSupported,
  speak,
  stopSpeaking,
  type SpeechRecognition,
} from "@/lib/speech";
import { buildSpokenReport } from "@/lib/report";
import type { Visit } from "@/lib/types";

type Phase = "idle" | "listening" | "working" | "done" | "error";

const banner = {
  clear: { cls: "bg-success text-white", Icon: ShieldCheck },
  caution: { cls: "bg-warning text-white", Icon: AlertTriangle },
  alert: { cls: "bg-danger text-white", Icon: ShieldAlert },
};

// One-tap Easy Mode: speak the visit → the full pipeline runs in the background → a plain-language
// safety report is read aloud. Built for elders who don't want to navigate the multi-step flow.
export default function QuickPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [report, setReport] = useState<ReturnType<typeof buildSpokenReport> | null>(
    null
  );

  // Refs the long-lived recognition handlers read from synchronously.
  const phaseRef = useRef<Phase>("idle");
  const transcriptRef = useRef("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhaseSafe = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (!isRecognitionSupported()) setTyping(true);
    return () => {
      stopSpeaking();
      recognitionRef.current?.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  // Auto-speak the report when we land on the done screen (the tap that got here is the gesture
  // browsers require before speechSynthesis will play).
  useEffect(() => {
    if (phase === "done" && report) speak(report.speech);
  }, [phase, report]);

  const clearSilence = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  };

  // Stop listening after ~3s of quiet so elders don't have to find the Stop button.
  const resetSilence = () => {
    clearSilence();
    silenceTimer.current = setTimeout(() => recognitionRef.current?.stop(), 3000);
  };

  const startListening = () => {
    const r = createRecognition({ continuous: true, interimResults: true });
    if (!r) {
      setTyping(true);
      return;
    }
    recognitionRef.current = r;
    transcriptRef.current = "";
    setTranscript("");
    setInterim("");
    setError("");

    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal)
          transcriptRef.current = (
            transcriptRef.current +
            " " +
            res[0].transcript
          ).trim();
        else interimText += res[0].transcript;
      }
      setTranscript(transcriptRef.current);
      setInterim(interimText);
      resetSilence();
    };
    // Remember the failure so onend can tell "user blocked the mic" apart from "just quiet".
    let micError = "";
    r.onerror = ((e: { error?: string }) => {
      const err = e?.error ?? "";
      // no-speech / aborted are benign (silence auto-stop); anything else is a real problem.
      if (err === "not-allowed" || err === "service-not-allowed")
        micError =
          'I can\'t hear your microphone. Please allow microphone access in your browser, or tap "Type instead" below.';
      else if (err && err !== "no-speech" && err !== "aborted")
        micError =
          'Your microphone isn\'t available right now. Please tap "Type instead" below.';
      recognitionRef.current?.stop();
    }) as unknown as SpeechRecognition["onerror"];
    r.onend = () => {
      clearSilence();
      setInterim("");
      if (phaseRef.current !== "listening") return;
      const text = transcriptRef.current.trim();
      if (text) run(text);
      else if (micError) {
        setError(micError);
        setTyping(true);
        setPhaseSafe("idle");
      } else setPhaseSafe("idle");
    };

    setPhaseSafe("listening");
    try {
      r.start();
      resetSilence();
    } catch {
      setPhaseSafe("idle");
    }
  };

  const stopListening = () => recognitionRef.current?.stop();

  // The whole post-visit workflow, no manual review step (Easy Mode). Mirrors record/page runAudit.
  async function run(text: string) {
    setPhaseSafe("working");
    setError("");
    try {
      setStatus("Reading your visit…");
      const visits = await getAllVisits();
      const existingConditions = Array.from(
        new Set(
          visits.map((v) => v.primaryCondition).filter((c): c is string => !!c)
        )
      );
      const res = await extractMedicines(text, existingConditions);
      const medicines = res.medicines ?? [];
      if (medicines.length === 0) {
        setError(
          "I couldn't find any medicines in that. Please try again and say the medicine names clearly."
        );
        setPhaseSafe("error");
        return;
      }

      const profile = await getProfile();

      setStatus("Checking your medicines…");
      const { interactions, safetyScore } = await auditInteractions(
        medicines,
        "",
        profile
      );

      setStatus("Building your guide…");
      const { sideEffects, pharmacistQuestions, glossaryTerms } =
        await educatePatient(medicines, interactions, profile);

      setStatus("Setting up reminders…");
      const reminders = await buildReminders(medicines);

      const newVisit: Visit = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        transcript: text,
        medicines,
        interactions,
        sideEffects,
        pharmacistQuestions,
        safetyScore,
        followUpDate: res.followUpDate,
        glossaryTerms,
        primaryCondition: res.primaryCondition,
        visitSummary: res.visitSummary,
        actionItems: (res.actionItems ?? []).map((a) => ({
          id: crypto.randomUUID(),
          text: a.text,
          category: a.category,
          done: false,
        })),
      };
      await saveVisit(newVisit);
      await saveReminders(reminders);
      pendo?.track("quick_visit_recorded", {
        inputMethod: typing ? "typed" : "voice",
        medicineCount: newVisit.medicines.length,
        safetyScore: newVisit.safetyScore,
        interactionCount: newVisit.interactions.length,
        hasFollowUp: !!newVisit.followUpDate,
        primaryCondition: newVisit.primaryCondition ?? "",
        actionItemCount: newVisit.actionItems?.length ?? 0,
        transcriptWordCount: text.trim().split(/\s+/).length,
        visitId: newVisit.id,
      });

      setVisit(newVisit);
      setReport(buildSpokenReport(newVisit));
      setPhaseSafe("done");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again."
      );
      setPhaseSafe("error");
    }
  }

  const reset = () => {
    stopSpeaking();
    setTranscript("");
    setInterim("");
    setTyped("");
    setError("");
    setVisit(null);
    setReport(null);
    setPhaseSafe("idle");
  };

  // ---- done ----
  if (phase === "done" && visit && report) {
    const b = banner[visit.safetyScore];
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className={`flex items-center gap-4 rounded-3xl p-6 ${b.cls}`}>
          <b.Icon className="h-10 w-10 shrink-0" />
          <h1 className="font-heading text-3xl font-semibold">{report.headline}</h1>
        </div>

        <div className="mt-6 space-y-4 rounded-3xl border border-border bg-surface p-6">
          {report.lines.map((line, i) => (
            <p key={i} className="text-xl leading-relaxed text-text">
              {line}
            </p>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => speak(report.speech)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-lg font-medium text-onp transition hover:opacity-90"
          >
            <Volume2 className="h-5 w-5" /> Hear it again
          </button>
          <Link
            href={`/audit/${visit.id}`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-4 text-lg font-medium text-text transition hover:border-accent"
          >
            See details <ArrowRight className="h-5 w-5 text-accent" />
          </Link>
          <Link
            href="/"
            onClick={() => stopSpeaking()}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-4 text-lg font-medium text-text transition hover:border-accent"
          >
            Done
          </Link>
        </div>
      </main>
    );
  }

  // ---- working ----
  if (phase === "working") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <Loader2 className="h-14 w-14 animate-spin text-accent" />
        <p className="mt-8 text-2xl font-medium text-text">{status}</p>
        <p className="mt-3 text-lg text-muted">One moment, please.</p>
      </main>
    );
  }

  // ---- error ----
  if (phase === "error") {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-light text-danger">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <p className="mt-6 max-w-md text-xl text-text">{error}</p>
        <button
          onClick={reset}
          className="mt-8 flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-lg font-medium text-onp transition hover:opacity-90"
        >
          <RotateCcw className="h-5 w-5" /> Try again
        </button>
      </main>
    );
  }

  // ---- idle / listening ----
  const listening = phase === "listening";
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
      <h1 className="font-heading text-3xl font-semibold text-text sm:text-4xl">
        {listening ? "I'm listening…" : "Tell me about your visit"}
      </h1>
      <p className="mt-3 max-w-md text-lg text-muted">
        {listening
          ? "Say what the doctor told you. Tap stop when you're done."
          : "Tap the button and say what the doctor told you. I'll check your medicines and tell you what to do."}
      </p>

      {error && (
        <div className="mt-6 flex items-start gap-2 rounded-2xl bg-danger-light p-4 text-left text-base text-text">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <span>{error}</span>
        </div>
      )}

      {!typing && (
        <>
          <div className="relative mt-12 flex h-44 w-44 items-center justify-center">
            {listening && (
              <motion.span
                className="absolute h-40 w-40 rounded-full bg-primary"
                animate={{ scale: [1, 1.5], opacity: [0.35, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
            )}
            <motion.button
              onClick={listening ? stopListening : startListening}
              animate={listening ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={
                listening
                  ? { duration: 1.2, repeat: Infinity }
                  : { duration: 0.2 }
              }
              className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full bg-primary text-onp shadow-lg"
              aria-label={listening ? "Stop and get my report" : "Start speaking"}
            >
              {listening ? (
                <Square className="h-14 w-14" />
              ) : (
                <Mic className="h-16 w-16" />
              )}
            </motion.button>
          </div>

          {(transcript || interim) && (
            <div className="mt-8 w-full rounded-2xl border border-border bg-surface p-5 text-left text-lg leading-relaxed">
              <span className="text-text">{transcript}</span>{" "}
              <span className="text-muted">{interim}</span>
            </div>
          )}

          {!listening && (
            <button
              onClick={() => setTyping(true)}
              className="mt-10 flex items-center gap-2 text-base font-medium text-accent"
            >
              <Keyboard className="h-4 w-4" /> Type instead
            </button>
          )}
        </>
      )}

      {typing && (
        <div className="mt-10 w-full">
          <textarea
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type what the doctor told you. e.g. Take Aspirin 75mg once daily and Warfarin 5mg daily."
            rows={5}
            className="w-full rounded-2xl border border-border bg-surface p-4 text-lg leading-relaxed outline-none focus:border-accent"
          />
          <button
            onClick={() => run(typed)}
            disabled={typed.trim().split(/\s+/).filter(Boolean).length < 4}
            className="mt-4 w-full rounded-2xl bg-primary px-8 py-4 text-lg font-medium text-onp transition hover:opacity-90 disabled:opacity-60"
          >
            Check my medicines
          </button>
          {isRecognitionSupported() && (
            <button
              onClick={() => setTyping(false)}
              className="mt-4 flex items-center gap-2 text-base font-medium text-accent"
            >
              <Mic className="h-4 w-4" /> Use voice instead
            </button>
          )}
        </div>
      )}
    </main>
  );
}
