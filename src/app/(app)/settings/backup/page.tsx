"use client";

import { useEffect, useState } from "react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { useLive } from "@/db/live";
import { createBackup, listSafetyBackups, type SafetyBackup } from "@/lib/backup";
import { download } from "@/lib/download";
import { dateTime, fileSize } from "@/lib/format";
import { BackupRestore } from "@/components/BackupRestore";
import { DeviceData } from "@/components/DeviceData";

const count = (table: string) => (db.get(sql.raw(`select count(*) as n from ${table}`)) as { n: number }).n;

export default function BackupPage() {
  useLive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState<SafetyBackup[]>([]);
  useEffect(() => {
    listSafetyBackups().then(setSafety);
  }, []);

  async function downloadBackup() {
    setBusy(true);
    setError("");
    try {
      const { data, filename } = await createBackup();
      download(data as BlobPart, filename, "application/zip");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Export full backup</h2>
        <p className="text-sm text-zinc-600">
          Your store is saved only in this browser. Download a backup regularly and keep it somewhere safe (Google
          Drive, a USB drive, email to yourself). It holds everything: products, inventory history, customers, sales,
          invoices, settings and product images. Use <strong>Import backup</strong> on another device to continue there.
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
          <li>{count("products")} products</li>
          <li>{count("customers")} customers</li>
          <li>{count("sales")} invoices</li>
          <li>{count("inventory_movements")} stock movements</li>
          <li>{count("files")} images</li>
        </ul>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button onClick={downloadBackup} disabled={busy} className="btn" data-tour="backup-download">
          {busy ? "Preparing…" : "Download backup"}
        </button>
      </section>

      <BackupRestore onRestored={() => listSafetyBackups().then(setSafety)} />

      <section className="card">
        <h2 className="mb-1 font-semibold">Automatic safety backups</h2>
        <p className="mb-2 text-sm text-zinc-600">
          Made automatically before every restore and kept in this browser (the last 3). Import one to undo a restore.
        </p>
        {safety.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Created</th>
                <th className="text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {safety.map((b) => (
                <tr key={b.name}>
                  <td>
                    <button
                      onClick={() => download(b.data as BlobPart, b.name, "application/zip")}
                      className="font-mono text-xs text-indigo-600 hover:underline"
                    >
                      {b.name}
                    </button>
                  </td>
                  <td>{dateTime(b.createdAt)}</td>
                  <td className="text-right">{fileSize(b.data.length)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-500">None yet.</p>
        )}
      </section>

      <DeviceData />
    </div>
  );
}
