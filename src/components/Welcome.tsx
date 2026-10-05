"use client";

import { useRef, useState } from "react";
import { ArrowRight, FolderOpen, HardDrive, Sparkles, Store, WifiOff } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, save } from "@/db";
import { settings } from "@/db/schema";
import { loadDemo } from "@/lib/demo";
import { restoreBackup, validateBackup } from "@/lib/backup";

/** First visit on this device: start a new store, try the demo, or restore a backup. */
export function Welcome({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [vat, setVat] = useState(false);
  const [busy, setBusy] = useState<"" | "start" | "demo" | "restore">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(kind: "start" | "demo" | "restore", fn: () => void | Promise<void>) {
    setError("");
    setBusy(kind);
    try {
      await fn();
      await save();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy("");
    }
  }

  const start = () =>
    run("start", () => {
      if (!name.trim()) throw new Error("Enter your business name.");
      db.update(settings).set({ businessName: name.trim(), vatRegistered: vat, currencySymbol: "₱" }).where(eq(settings.id, 1)).run();
    });

  const demo = () =>
    run("demo", async () => {
      await new Promise((r) => setTimeout(r, 30)); // let the button show its busy state first
      loadDemo();
    });

  const restore = (file: File | undefined) =>
    file &&
    run("restore", async () => {
      const info = await validateBackup(new Uint8Array(await file.arrayBuffer()));
      await restoreBackup(info.token);
    });

  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950 px-4 py-10 text-white sm:py-16">
      <div className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-32 size-[28rem] rounded-full bg-amber-600/10 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/20">
            <Store className="size-5" />
          </div>
          <span className="text-sm font-semibold tracking-wide text-zinc-300">Inventory &amp; Invoicing</span>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-14">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Your store, <span className="bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">in your browser.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-400">
              Point of sale, stock and BIR-style invoices for Philippine shops. No sign-up and no monthly fee.
            </p>
            <ul className="mt-8 space-y-4 text-sm">
              {[
                { icon: HardDrive, title: "Your data stays on this device", body: "Everything is saved in this browser. Nothing is uploaded anywhere." },
                { icon: WifiOff, title: "Works without internet", body: "After the first visit the app keeps working offline." },
                { icon: FolderOpen, title: "Move it with a backup file", body: "Download one ZIP and restore it on any other device or browser." },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                    <Icon className="size-4 text-amber-300" />
                  </div>
                  <div>
                    <div className="font-medium text-zinc-100">{title}</div>
                    <div className="text-zinc-500">{body}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
              className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl"
            >
              <h2 className="text-lg font-semibold tracking-tight">Start a new store</h2>
              <p className="mt-1 text-sm text-zinc-500">You can change all of this later in Settings.</p>
              <label className="mt-5 block">
                <span className="label">Business name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="e.g. Santos Sari-Sari Store"
                  autoFocus
                />
              </label>
              <div className="mt-4">
                <span className="label">Tax registration</span>
                <div className="grid grid-cols-2 rounded-lg bg-zinc-100 p-1" role="radiogroup" aria-label="Tax registration">
                  {[
                    { on: false, label: "Non-VAT" },
                    { on: true, label: "VAT-registered" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={vat === o.on}
                      onClick={() => setVat(o.on)}
                      className={`h-9 rounded-md text-sm font-medium transition ${vat === o.on ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button className="btn mt-5 h-11 w-full" disabled={!!busy}>
                {busy === "start" ? "Setting up…" : "Open my store"} <ArrowRight className="size-4" />
              </button>
            </form>

            <button
              onClick={demo}
              disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
            >
              <Sparkles className="size-5 shrink-0 text-amber-300" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{busy === "demo" ? "Creating the demo store…" : "Explore with demo data"}</span>
                <span className="block text-xs text-zinc-400">A sample mini mart with a month of sales. Clear it any time.</span>
              </span>
              <ArrowRight className="size-4 text-zinc-500" />
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="flex w-full items-center gap-3 rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
            >
              <FolderOpen className="size-5 shrink-0 text-amber-300" />
              <span className="flex-1">
                <span className="block text-sm font-semibold">{busy === "restore" ? "Restoring…" : "I have a backup file"}</span>
                <span className="block text-xs text-zinc-400">Continue a store from another device (business-backup ZIP).</span>
              </span>
              <ArrowRight className="size-4 text-zinc-500" />
            </button>
            <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
          </div>
        </div>
      </div>
    </div>
  );
}
