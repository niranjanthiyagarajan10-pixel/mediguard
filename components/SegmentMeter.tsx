// A Claude-Code-style segmented meter: a dark pill of small rounded cells that
// ramp from slate to lavender, with a bright "leading edge" cell. `ratio` is 0–1.
// Used for course progress (ReminderCard) and today's-dose adherence (dashboard).

const RAMP_START = [74, 74, 96]; // slate
const RAMP_END = [183, 165, 255]; // lavender
const CAP = "rgb(240, 237, 255)"; // bright leading edge
const EMPTY = "#2E2E3A"; // unlit cell

function lerp(a: number[], b: number[], t: number) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export default function SegmentMeter({
  ratio,
  segments = 12,
  className = "",
}: {
  ratio: number;
  segments?: number;
  className?: string;
}) {
  const n = Math.max(segments, 1);
  const r = Math.min(Math.max(ratio || 0, 0), 1);
  // Any progress lights at least one cell, so "barely started" still reads as started.
  const filled = r === 0 ? 0 : Math.max(1, Math.round(r * n));

  return (
    <div
      className={`inline-flex items-center gap-[3px] rounded-[10px] bg-[#1C1C24] px-2 py-1.5 shadow-sm ring-1 ring-white/10 ${className}`}
    >
      {Array.from({ length: n }, (_, i) => {
        const isCap = i === filled - 1;
        const color =
          i >= filled
            ? EMPTY
            : isCap
              ? CAP
              : lerp(RAMP_START, RAMP_END, n > 1 ? i / (n - 1) : 1);
        return (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{
              backgroundColor: color,
              boxShadow: isCap ? "0 0 6px rgba(196,181,255,0.7)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
