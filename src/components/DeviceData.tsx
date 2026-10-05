"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { deleteDeviceData } from "@/db";
import { fileSize } from "@/lib/format";

/** Where the store lives on this device, how much space it uses, and "start over". */
export function DeviceData() {
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [kept, setKept] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }));
    navigator.storage?.persisted?.().then(setKept);
  }, []);

  async function startOver() {
    await deleteDeviceData();
    // A full reload (not router.push) so the store still held in memory is dropped too.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <section className="card space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="size-4 text-zinc-500" />
        <h2 className="font-semibold">This device</h2>
      </div>
      <p className="text-sm text-zinc-600">
        This store is saved in this browser only. Other devices, other browsers and private windows each have their
        own separate store. Clearing this browser&apos;s site data deletes it, so keep a recent backup.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-zinc-500">Space used</dt>
        <dd>{usage ? `${fileSize(usage.used)} of ${fileSize(usage.quota)} available to this site` : "—"}</dd>
        <dt className="text-zinc-500">Protected storage</dt>
        <dd>
          {kept === null
            ? "—"
            : kept
              ? "Yes. The browser won't clear it to free up space."
              : "No. The browser may clear it if the device runs out of space."}
        </dd>
      </dl>

      <div className="border-t border-zinc-100 pt-3">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="btn-danger">
            Start over…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-red-700">
              This deletes every product, customer, sale and invoice on this device. Download a backup first if you
              might need them. Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="flex flex-wrap gap-2">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="input max-w-40" aria-label="Type DELETE to confirm" />
              <button onClick={startOver} disabled={typed !== "DELETE"} className="btn-danger">
                Delete everything
              </button>
              <button
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
