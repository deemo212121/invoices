"use client";

import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from ".";

/**
 * Re-renders the calling component whenever the database changes.
 * Screens call this, then read with the normal (synchronous) queries in src/lib/data.ts.
 */
export function useLive() {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}
