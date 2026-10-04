// Horizontal bars for magnitude: one hue, ≤24px thick, rounded data-end, value at the tip.
const SERIES = "#2a78d6";

export function BarList({
  rows,
  format,
  empty = "No data for this period.",
}: {
  rows: { key: string; label: string; value: number; sub?: string; muted?: boolean }[];
  format: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length || max === 0) return <p className="py-8 text-center text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700">{r.label}</span>
            {r.sub && <span className="shrink-0 text-xs text-zinc-400 tabular-nums">{r.sub}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 min-w-0 flex-1">
              <div
                className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-80"
                style={{
                  width: `${Math.max(1.5, (r.value / max) * 100)}%`,
                  background: r.muted ? "#d4d4d8" : SERIES,
                }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-zinc-900 tabular-nums">{format(r.value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
