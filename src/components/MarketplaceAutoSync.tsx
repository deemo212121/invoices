"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncTikTok } from "@/app/actions/marketplaces";

const INTERVAL = 10 * 60 * 1000;

/** While the app is open, syncs TikTok Shop every 10 minutes (only when auto-sync is on). */
export function MarketplaceAutoSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(async () => {
      if (!navigator.onLine) return; // offline: try again next time
      const r = await syncTikTok();
      if (r.ok) router.refresh();
    }, INTERVAL);
    return () => clearInterval(t);
  }, [enabled, router]);
  return null;
}
