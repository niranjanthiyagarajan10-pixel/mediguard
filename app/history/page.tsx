"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  FileClock,
  ChevronDown,
  ChevronRight,
  Activity,
} from "lucide-react";
import { getAllVisits, deleteVisit } from "@/lib/db";
import { askAboutHistory } from "@/lib/agents";
import type { Visit } from "@/lib/types";
import AskChat from "@/components/AskChat";

const score = {
  clear: { cls: "bg-success text-white", label: "All clear", Icon: ShieldCheck },
  caution: { cls: "bg-warning text-white", label: "Review", Icon: AlertTriangle },
  alert: { cls: "bg-danger text-white", label: "Alert", Icon: ShieldAlert },
};

// Group visits by condition, preserving the newest-first order. Visits without a condition each
// stand alone (keyed by id) so they aren't lumped under a misleading shared header.
function groupByCondition(visits: Visit[]) {
  const groups: { key: string; label: string | null; visits: Visit[] }[] = [];
  for (const v of visits) {
    const cond = v.primaryCondition?.trim();
    if (cond) {
      const existing = groups.find((g) => g.label === cond);
      if (existing) existing.visits.push(v);
      else groups.push({ key: cond, label: cond, visits: [v] });
    } else {
      groups.push({ key: v.id, label: null, visits: [v] });
    }
  }
  return groups;
}

export default function HistoryPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAllVisits().then((v) => {
      setVisits(v);
      setLoading(false);
    });
  }, []);

  const remove = async (id: string) => {
    await deleteVisit(id);
    setVisits((prev) => prev.filter((v) => v.id !== id));
  };

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Loading…
      </main>
    );
  }

  if (visits.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <FileClock className="mx-auto h-10 w-10 text-muted" />
        <p className="mt-4 text-muted">No visits recorded yet.</p>
        <Link href="/record" className="mt-4 inline-block font-medium text-accent">
          Record your first visit
        </Link>
      </main>
    );
  }

  const groups = groupByCondition(visits);

  const row = (v: Visit) => {
    const s = score[v.safetyScore];
    return (
      <div
        key={v.id}
        className="flex items-center gap-2 rounded-2xl border border-border bg-surface pr-3 transition hover:border-accent"
      >
        <Link href={`/audit/${v.id}`} className="flex flex-1 items-center gap-4 p-5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.cls}`}
          >
            <s.Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text">
              {new Date(v.date).toLocaleDateString(undefined, {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="text-sm text-muted">
              {v.medicines.length} medicine
              {v.medicines.length === 1 ? "" : "s"} · {s.label}
            </p>
          </div>
        </Link>
        <button
          onClick={() => remove(v.id)}
          aria-label="Delete visit"
          className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-danger hover:text-white"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-heading text-3xl font-semibold text-text">History</h1>
      <p className="mt-2 text-muted">
        Your past visits and safety audits, grouped by condition.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((g) =>
          g.label ? (
            <div key={g.key}>
              <button
                onClick={() => toggle(g.key)}
                className="flex w-full items-center gap-2 px-1 py-1 text-left transition hover:text-accent"
              >
                {collapsed.has(g.key) ? (
                  <ChevronRight className="h-4 w-4 text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted" />
                )}
                <Activity className="h-4 w-4 text-accent" />
                <span className="font-heading text-lg font-semibold text-text">
                  {g.label}
                </span>
                <span className="text-sm text-muted">
                  {g.visits.length} visit{g.visits.length === 1 ? "" : "s"}
                </span>
              </button>
              {!collapsed.has(g.key) && (
                <div className="mt-3 space-y-3">{g.visits.map(row)}</div>
              )}
            </div>
          ) : (
            <div key={g.key}>{g.visits.map(row)}</div>
          )
        )}
      </div>

      <AskChat
        title="Ask about your history"
        subtitle="Plain-language answers across all your visits. Not a substitute for your pharmacist or doctor."
        suggestions={[
          "What conditions am I managing?",
          "How have my medicines changed over time?",
          "Have I had any repeated safety alerts?",
          "Summarize my most recent visit.",
        ]}
        onAsk={(q, h) => askAboutHistory(visits, h, q)}
        agentId="mIdANk5YWRTjxIaRcFO4CwPaedU"
      />
    </main>
  );
}
