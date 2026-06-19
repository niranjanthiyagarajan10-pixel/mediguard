"use client";

import { useState } from "react";
import type { Medicine, Interaction, SideEffect, GlossaryTerm } from "@/lib/types";
import {
  Pill,
  ShoppingCart,
  RotateCw,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import SpeakButton from "@/components/SpeakButton";

const severityCls = {
  low: "bg-primary-light text-accent",
  medium: "bg-warning text-white",
  high: "bg-danger text-white",
};

// Worst severity wins, so the front badge reflects the most serious warning.
const rank = { low: 0, medium: 1, high: 2 } as const;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Wraps any glossary term found in `text` as a tappable dotted-underline word, and reveals the
// active term's definition inline right under the block it appears in. activeTerm is shared per
// card, so only the block holding the tapped word shows its definition.
function GlossaryText({
  text,
  terms,
  activeTerm,
  onToggle,
}: {
  text: string;
  terms: GlossaryTerm[];
  activeTerm: string | null;
  onToggle: (term: string) => void;
}) {
  if (!terms.length || !text) return <>{text}</>;
  // Longest term first so "antiplatelet" wins over "platelet" in the alternation.
  const ordered = [...terms].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(
    `(${ordered.map((t) => escapeRegExp(t.term)).join("|")})`,
    "gi"
  );
  const active = activeTerm ? terms.find((t) => t.term === activeTerm) : undefined;
  const showHere = active && new RegExp(escapeRegExp(active.term), "i").test(text);
  return (
    <>
      {text.split(pattern).map((part, i) => {
        const hit = terms.find((t) => t.term.toLowerCase() === part.toLowerCase());
        return hit ? (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(hit.term)}
            className="font-medium underline decoration-dotted decoration-accent underline-offset-2 transition hover:text-accent"
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
      {showHere && (
        <span className="mt-1.5 block rounded-lg bg-primary-light px-2.5 py-1.5 text-xs text-text">
          <span className="font-semibold capitalize">{active!.term}:</span>{" "}
          {active!.definition}
        </span>
      )}
    </>
  );
}

export default function MedCard({
  medicine: m,
  interactions = [],
  sideEffect,
  glossaryTerms = [],
}: {
  medicine: Medicine;
  interactions?: Interaction[];
  sideEffect?: SideEffect;
  glossaryTerms?: GlossaryTerm[];
}) {
  const [flipped, setFlipped] = useState(false);
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const toggleTerm = (term: string) =>
    setActiveTerm((cur) => (cur === term ? null : term));
  const G = (text: string) => (
    <GlossaryText
      text={text}
      terms={glossaryTerms}
      activeTerm={activeTerm}
      onToggle={toggleTerm}
    />
  );

  const worst = interactions.reduce<Interaction["severity"] | null>(
    (acc, it) => (acc === null || rank[it.severity] > rank[acc] ? it.severity : acc),
    null
  );

  const buyUrl = `https://www.1mg.com/search/all?name=${encodeURIComponent(m.name)}`;

  // Plain-spoken version of the card front for read-aloud (elder-friendly). Strips the "General:"
  // marker so it isn't read literally.
  const spokenPurpose = m.purpose
    ? m.purpose.startsWith("General:")
      ? m.purpose.slice("General:".length).trim()
      : m.purpose
    : "";
  const howToTake =
    [m.frequency, m.timing, m.duration].filter(Boolean).join(", ") || "as directed";
  const speakText = [
    m.name,
    m.dosage ? `Dosage: ${m.dosage}` : "",
    spokenPurpose ? `Used for ${spokenPurpose}` : "",
    `Take it ${howToTake}`,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="relative h-[320px] [perspective:1200px]">
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Front */}
        <div className="absolute inset-0 flex flex-col rounded-2xl border border-border bg-surface p-5 [backface-visibility:hidden]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-accent">
              <Pill className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-lg font-semibold text-text">
                {m.name}
              </h3>
              {m.genericName && (
                <p className="text-sm text-muted">{m.genericName}</p>
              )}
            </div>
            {worst && (
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${severityCls[worst]}`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {worst}
              </span>
            )}
          </div>

          <p className="mt-4 font-mono text-sm text-text">{m.dosage || "—"}</p>
          {m.purpose && (
            <p className="mt-2 text-sm text-muted">
              {m.purpose.startsWith("General:") ? (
                <>
                  <span className="font-medium italic text-accent">General · </span>
                  {m.purpose.slice("General:".length).trim()}
                </>
              ) : (
                m.purpose
              )}
            </p>
          )}

          <div className="mt-3">
            <SpeakButton text={speakText} />
          </div>

          <div className="mt-auto flex items-center justify-between pt-4">
            <a
              href={buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-onp transition hover:opacity-90"
            >
              <ShoppingCart className="h-4 w-4" />
              Buy
            </a>
            <button
              onClick={() => setFlipped(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              Details
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Back */}
        <div className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-border bg-surface p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-base font-semibold text-text">
              {m.name}
            </h3>
            <button
              onClick={() => setFlipped(false)}
              className="flex items-center gap-1 text-sm font-medium text-accent"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          </div>

          <p className="mt-3 text-xs font-semibold uppercase text-muted">
            How to take
          </p>
          <p className="mt-1 text-sm text-text">
            {[m.frequency, m.timing, m.duration].filter(Boolean).join(" · ") ||
              "As directed"}
          </p>

          {interactions.map((it, i) => (
            <div
              key={i}
              className={`mt-3 rounded-xl p-3 text-sm text-text ${
                it.severity === "low" ? "bg-primary-light" : "bg-danger-light"
              }`}
            >
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${severityCls[it.severity]}`}
              >
                {it.severity} · with {it.medicine1 === m.name ? it.medicine2 : it.medicine1}
              </span>
              <p className="mt-1.5">{G(it.description)}</p>
              <p className="mt-1 text-muted">
                <span className="font-medium text-text">What to do: </span>
                {G(it.recommendation)}
              </p>
            </div>
          ))}

          {sideEffect && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted">Common</p>
                <ul className="mt-1 list-disc pl-4 text-sm text-text">
                  {sideEffect.common.map((c, j) => (
                    <li key={j}>{G(c)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-danger">
                  Serious
                </p>
                <ul className="mt-1 list-disc pl-4 text-sm text-text">
                  {sideEffect.serious.map((s, j) => (
                    <li key={j}>{G(s)}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
