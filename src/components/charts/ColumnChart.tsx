"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";

// Single-series column chart: one hue, ≤24px columns with 4px rounded caps, hairline grid,
// per-column hover/focus tooltip, and the peak labelled directly.
export type ColumnDatum = { key: string; label: string; value: number; detail?: string };

const SERIES = "#2a78d6"; // validated against the light surface (dataviz palette, slot 1)
const HEIGHT = 240;
const PAD = { top: 24, right: 8, bottom: 28, left: 56 };

function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function capPath(x: number, y: number, w: number, base: number) {
  const r = Math.min(4, w / 2, base - y);
  if (base - y <= 0) return "";
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function ColumnChart({
  data,
  currency,
  ariaLabel,
}: {
  data: ColumnDatum[];
  currency: string; // values are money; formatted here (functions can't cross the server/client boundary)
  ariaLabel: string;
}) {
  const format = (n: number) => money(n, currency);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;
  const band = plotW / Math.max(1, data.length);
  const colW = Math.max(2, Math.min(24, band - 2)); // ≤24px, always ≥2px surface gap
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const labelEvery = Math.ceil(data.length / Math.max(2, Math.floor(plotW / 64)));
  const compact = (n: number) =>
    n >= 1000 ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K` : n.toLocaleString("en-US");

  const a = active !== null ? data[active] : null;
  const ax = active !== null ? PAD.left + band * active + band / 2 : 0;

  return (
    <div ref={wrap} className="relative w-full overflow-hidden select-none" onPointerLeave={() => setActive(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} className="block">
        {/* grid + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#f0f0f1" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums">
              {compact(t)}
            </text>
          </g>
        ))}
        <line x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} stroke="#e4e4e7" strokeWidth={1} />

        {/* columns */}
        {data.map((d, i) => {
          const x = PAD.left + band * i + (band - colW) / 2;
          return (
            <path
              key={d.key}
              d={capPath(x, y(d.value), colW, base)}
              fill={SERIES}
              opacity={active === null || active === i ? 1 : 0.45}
              className="transition-opacity"
            />
          );
        })}

        {/* direct label: the peak only */}
        {max > 0 && (
          <text
            x={PAD.left + band * peak + band / 2}
            y={y(data[peak].value) - 6}
            textAnchor="middle"
            className="fill-zinc-700 text-[11px] font-medium tabular-nums"
          >
            {format(data[peak].value)}
          </text>
        )}

        {/* x labels, thinned to fit */}
        {data.map((d, i) =>
          i % labelEvery === 0 || (i === data.length - 1 && i % labelEvery > labelEvery / 2) ? (
            <text
              key={d.key}
              x={PAD.left + band * i + band / 2}
              y={base + 18}
              textAnchor="middle"
              className="fill-zinc-400 text-[11px]"
            >
              {d.label}
            </text>
          ) : null,
        )}

        {/* hit targets: the whole band, bigger than the mark */}
        {data.map((d, i) => (
          <rect
            key={d.key}
            x={PAD.left + band * i}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            tabIndex={0}
            aria-label={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
            onPointerMove={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="cursor-default outline-none"
          />
        ))}
      </svg>

      {a && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-zinc-900/10"
          style={{ left: Math.min(Math.max(ax, 70), width - 70) }}
        >
          <div className="text-sm font-semibold text-zinc-900 tabular-nums">{format(a.value)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-zinc-500">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: SERIES }} />
            {a.label}
            {a.detail ? ` · ${a.detail}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
