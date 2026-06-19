"use client";

import type { Reminder } from "@/lib/types";
import { Clock, Pause, Play, CheckCircle2, Infinity, Trash2 } from "lucide-react";
import SegmentMeter from "@/components/SegmentMeter";

export function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export default function ReminderCard({
  reminder: r,
  onToggle,
  onDelete,
}: {
  reminder: Reminder;
  onToggle: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const ongoing = r.totalDays === 0;
  const start = new Date(r.startDate).getTime();
  const elapsed = Math.floor((Date.now() - start) / 86_400_000);
  const daysElapsed = Math.min(Math.max(elapsed, 0), r.totalDays);
  const daysRemaining = Math.max(r.totalDays - daysElapsed, 0);
  const progress = r.totalDays > 0 ? (daysElapsed / r.totalDays) * 100 : 0;
  const done = !ongoing && daysRemaining === 0;

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 ${
        r.active ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold text-text">
            {r.medicineName}
          </h3>
          <p className="font-mono text-sm text-muted">{r.dosage}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onToggle(r.id, !r.active)}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text transition hover:bg-bg"
          >
            {r.active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {r.active ? "Pause" : "Resume"}
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(r.id)}
              aria-label="Delete reminder"
              className="rounded-lg p-2 text-muted transition hover:bg-danger hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {r.times.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 font-mono text-sm text-accent"
          >
            <Clock className="h-3.5 w-3.5" />
            {to12h(t)}
          </span>
        ))}
      </div>

      <div className="mt-4">
        {ongoing ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-accent">
            <Infinity className="h-3.5 w-3.5" /> Ongoing
          </span>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs">
              {done ? (
                <span className="flex items-center gap-1 font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Course complete
                </span>
              ) : (
                <span className="font-mono text-muted">
                  {daysRemaining} of {r.totalDays} days left
                </span>
              )}
              <span className="font-mono text-muted">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="mt-2">
              <SegmentMeter ratio={progress / 100} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
