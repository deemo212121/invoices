"use client";

import { useRef, useState } from "react";
import { BackupError, restoreBackup, validateBackup, type BackupInfo, type Check, type Counts } from "@/lib/backup";
import { dateTime, fileSize } from "@/lib/format";

type Step =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "review"; info: BackupInfo }
  | { kind: "restoring"; info: BackupInfo }
  | { kind: "done"; checks: Check[]; safetyBackup: string };

const ROWS: { key: keyof Counts; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "inventory_movements", label: "Stock movements" },
  { key: "customers", label: "Customers" },
  { key: "sales", label: "Sales / invoices" },
  { key: "sale_items", label: "Invoice lines" },
];

export function BackupRestore({ onRestored }: { onRestored?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function check() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a backup ZIP file first.");
    setError("");
    setConfirmed(false);
    setStep({ kind: "checking" });
    try {
      setStep({ kind: "review", info: await validateBackup(new Uint8Array(await file.arrayBuffer())) });
    } catch (e) {
      setError(e instanceof BackupError ? e.message : `Could not check backup: ${e instanceof Error ? e.message : e}`);
      setStep({ kind: "idle" });
    }
  }

  async function restore(info: BackupInfo) {
    setError("");
    setStep({ kind: "restoring", info });
    let body: { checks: Check[]; safetyBackup: string };
    try {
      body = await restoreBackup(info.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep({ kind: "review", info });
      return;
    }
    setStep({ kind: "done", checks: body.checks, safetyBackup: body.safetyBackup });
    onRestored?.();
    if (fileRef.current) fileRef.current.value = "";
  }

  function reset() {
    setStep({ kind: "idle" });
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Import backup</h2>
      <p className="text-sm text-zinc-600">
        Restores a backup ZIP made by this app. The file is checked first and nothing changes until you confirm.
        Your current data is saved automatically before it is replaced.
      </p>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {(step.kind === "idle" || step.kind === "checking") && (
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".zip,application/zip" className="text-sm" />
          <button onClick={check} disabled={step.kind === "checking"} className="btn-secondary">
            {step.kind === "checking" ? "Checking…" : "Check backup"}
          </button>
        </div>
      )}

      {(step.kind === "review" || step.kind === "restoring") && (
        <Review
          info={step.info}
          busy={step.kind === "restoring"}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          onRestore={() => restore(step.info)}
          onCancel={reset}
        />
      )}

      {step.kind === "done" && (
        <div className="space-y-3">
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
            Restore complete. All checks passed.
          </p>
          <ul className="space-y-1 text-sm">
            {step.checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                <span className={c.ok ? "text-green-700" : "text-red-700"}>{c.ok ? "✓" : "✗"}</span>
                <span className="capitalize">{c.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-600">
            Your previous data was saved as <span className="font-mono">{step.safetyBackup}</span>. Download it
            under <strong>Automatic safety backups</strong> below.
          </p>
          <button onClick={reset} className="btn-secondary">
            Done
          </button>
        </div>
      )}
    </section>
  );
}

function Review(props: {
  info: BackupInfo;
  busy: boolean;
  confirmed: boolean;
  setConfirmed: (v: boolean) => void;
  onRestore: () => void;
  onCancel: () => void;
}) {
  const { manifest: m, current } = props.info;
  return (
    <div className="space-y-3">
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        ✓ Backup is valid: every file matches its checksum and the database passed its integrity check.
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-zinc-500">Business</dt>
        <dd className="font-medium">{m.businessName || "—"}</dd>
        <dt className="text-zinc-500">Created</dt>
        <dd>{dateTime(m.createdAt)}</dd>
        <dt className="text-zinc-500">From</dt>
        <dd>{m.sourceComputer}</dd>
        <dt className="text-zinc-500">App version</dt>
        <dd>{m.appVersion}</dd>
        <dt className="text-zinc-500">Size</dt>
        <dd>
          {fileSize(props.info.totalBytes)} · {props.info.imageCount} images · {props.info.documentCount} documents
        </dd>
      </dl>

      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th className="text-right">In backup</th>
            <th className="text-right">Current (will be replaced)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className="text-right font-medium">{m.counts[r.key]}</td>
              <td className="text-right text-zinc-500">{current.counts[r.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {props.info.warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {w}
        </p>
      ))}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={props.confirmed}
          onChange={(e) => props.setConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Replace all current data ({current.businessName || "this business"}) with this backup. A safety backup of
          the current data is made first.
        </span>
      </label>
      <div className="flex gap-2">
        <button onClick={props.onRestore} disabled={!props.confirmed || props.busy} className="btn">
          {props.busy ? "Restoring…" : "Restore backup"}
        </button>
        <button onClick={props.onCancel} disabled={props.busy} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
