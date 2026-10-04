import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Consistent page header: optional back link, title, subtitle and actions. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  badge,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-0.5 text-sm text-zinc-500 transition hover:text-zinc-900"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A small labelled figure for stat strips. */
export function Figure({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tracking-tight ${tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-zinc-900"}`}
      >
        {value}
      </div>
    </div>
  );
}

/** Simple page links for long lists (?page=N, keeping other params). */
export function Pager({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm">
      <span className="text-zinc-500 tabular-nums">
        Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary h-9">
            Previous
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none h-9 opacity-40">Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className="btn-secondary h-9">
            Next
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none h-9 opacity-40">Next</span>
        )}
      </div>
    </nav>
  );
}
