import type { StockStatus } from "@/lib/format";
import { STOCK_LABEL } from "@/lib/format";
import type { FormState } from "@/lib/form-state";

const STOCK_CLASS: Record<StockStatus, string> = {
  in: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  low: "bg-amber-50 text-amber-700 ring-amber-600/20",
  out: "bg-red-50 text-red-700 ring-red-600/15",
};

export function StockBadge({ status }: { status: StockStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${STOCK_CLASS[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {STOCK_LABEL[status]}
    </span>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-600/10">{state.error}</p>;
  }
  if (state.ok) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-600/10">{state.ok}</p>
    );
  }
  return null;
}

export function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function ProductThumb({ src, size = 40 }: { src: string | null; size?: number }) {
  return src ? (
    <img
      src={`/uploads/${src}`}
      alt=""
      width={size}
      height={size}
      className="rounded-lg object-cover ring-1 ring-zinc-900/5"
      style={{ width: size, height: size }}
    />
  ) : (
    <div className="rounded-lg bg-zinc-100" style={{ width: size, height: size }} />
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-zinc-500">{children}</p>;
}

/** Initials in a soft circle, for people. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 font-semibold text-zinc-700 ring-1 ring-zinc-900/5"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

/** Search box with an icon, submitting as a GET form field. */
export function SearchInput({ name = "q", defaultValue, placeholder }: { name?: string; defaultValue?: string; placeholder: string }) {
  return (
    <div className="relative w-full max-w-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="input pl-9" />
    </div>
  );
}
