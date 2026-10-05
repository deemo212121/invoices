"use client";

import { Suspense, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { openDatabase, persistent } from "@/db";
import { useLive } from "@/db/live";
import { getSettings } from "@/lib/data";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { GuidedTour } from "./GuidedTour";
import { Welcome } from "./Welcome";

type Phase = { kind: "loading" } | { kind: "welcome" } | { kind: "ready" } | { kind: "error"; message: string };

/**
 * Opens this device's database, shows the welcome screen the first time, then the app.
 * Nothing inside renders until the database is ready, so every screen can read it directly.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    openDatabase()
      .then(({ isNew }) => setPhase({ kind: isNew ? "welcome" : "ready" }))
      .catch((e) => setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
    // Keep the app working offline after the first visit.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (phase.kind === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="size-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" aria-label="Loading" />
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <div className="card max-w-md text-center">
          <AlertTriangle className="mx-auto size-8 text-amber-500" />
          <h1 className="mt-3 font-semibold">This browser couldn&apos;t open the store</h1>
          <p className="mt-1 text-sm text-zinc-500">{phase.message}</p>
          <p className="mt-3 text-sm text-zinc-500">Try an up-to-date Chrome, Edge, Safari or Firefox.</p>
        </div>
      </div>
    );
  }
  if (phase.kind === "welcome") return <Welcome onDone={() => setPhase({ kind: "ready" })} />;
  return <Ready>{children}</Ready>;
}

function Ready({ children }: { children: React.ReactNode }) {
  useLive();
  const s = getSettings();
  return (
    <div className="min-h-full lg:flex">
      <Sidebar businessName={s.businessName} vatRegistered={s.vatRegistered} />
      <MobileNav businessName={s.businessName} />
      <GuidedTour />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:py-6 print:p-0">
        {!persistent && (
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/15 print:hidden">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            This browser isn&apos;t letting the app save (private or incognito window?). Changes will be lost when you
            close it. Download a backup from Settings to keep them.
          </p>
        )}
        <Suspense>{children}</Suspense>
      </main>
    </div>
  );
}
