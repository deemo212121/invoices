"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { syncTikTok } from "@/app/actions/marketplaces";

export function TikTokSyncButton() {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      className="btn"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await syncTikTok();
          if (!r.ok) alert(r.summary);
          router.refresh();
        })
      }
    >
      <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "Syncing…" : "Sync now"}
    </button>
  );
}
