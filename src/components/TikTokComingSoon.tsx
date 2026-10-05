import { BarChart3, Boxes, CheckCircle2, Circle, FileText, RefreshCw } from "lucide-react";

const FEATURES = [
  { icon: RefreshCw, title: "Automatic order sync", body: "Paid TikTok orders become sales here, with your own Sales Invoice." },
  { icon: Boxes, title: "One stock count", body: "Walk-in and TikTok sales share the same shelf, so you never oversell." },
  { icon: BarChart3, title: "TikTok dashboard", body: "Sales trend, order pipeline, best sellers and stock alerts." },
  { icon: FileText, title: "BIR-ready records", body: "VAT handled the same way as your in-store sales." },
];

/** TikTok Shop isn't available yet: what it will do, and where it stands. */
export function TikTokComingSoon() {
  const steps = [
    { done: true, label: "Developer app created" },
    { done: false, label: "TikTok partner registration approved" },
    { done: false, label: "Shop connected" },
  ];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-12 text-white shadow-xl sm:px-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 ring-1 ring-amber-300/30">
            <span className="size-1.5 animate-pulse rounded-full bg-amber-300" /> COMING SOON
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight">TikTok Shop, in one place with your store</h1>
          <p className="mt-3 text-lg leading-relaxed text-zinc-400">
            Orders, stock and invoices from TikTok will sync here automatically. It switches on once TikTok approves
            the connection.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="card">
            <div className="grid size-10 place-items-center rounded-xl bg-zinc-100 text-zinc-700">
              <Icon className="size-5" strokeWidth={1.75} />
            </div>
            <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">{body}</p>
          </div>
        ))}
      </div>

      <section className="card max-w-xl">
        <h2 className="font-semibold tracking-tight">Status</h2>
        <ul className="mt-3 space-y-2.5">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 text-sm">
              {s.done ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <Circle className="size-5 text-zinc-300" />
              )}
              <span className={s.done ? "text-zinc-900" : "text-zinc-500"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
