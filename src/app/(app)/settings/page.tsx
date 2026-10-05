"use client";

import { getSettings } from "@/lib/data";
import { SettingsForm } from "@/components/SettingsForm";
import { useLive } from "@/db/live";

export default function SettingsPage() {
  useLive();
  const s = getSettings();
  return (
    <>
      <p className="text-sm text-zinc-500">Business information printed on every invoice.</p>
      <SettingsForm settings={s} />
    </>
  );
}
