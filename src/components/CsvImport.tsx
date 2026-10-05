"use client";

import { useRef, useState, useTransition } from "react";
import { previewImport, runImport, type Preview, type PreviewRow } from "@/lib/csv-import";
import { downloadTemplate } from "@/lib/csv-export";

type Result = { ok: true; preview: Preview } | { ok: false; error: string };

/** Runs an import step, turning thrown errors into a message. */
function attempt(fn: () => Preview): Result {
  try {
    return { ok: true, preview: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type Kind = "products" | "customers";

const ACTION_STYLE: Record<PreviewRow["action"], string> = {
  create: "bg-green-100 text-green-800",
  update: "bg-indigo-50 text-indigo-700",
  unchanged: "bg-zinc-100 text-zinc-600",
  error: "bg-red-100 text-red-800",
};

const HELP: Record<Kind, string> = {
  products:
    "Rows are matched to existing products by SKU. Matching products are updated and new SKUs are added. Blank cells keep the current value. A different quantity is recorded as a stock adjustment.",
  customers:
    "Rows are matched to existing customers by email, then by phone number. Matches are updated and the rest are added as new customers. Blank cells keep the current value.",
};

export function CsvImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("products");
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PreviewRow["action"] | "all">("all");
  const [pending, startTransition] = useTransition();

  function reset(nextKind = kind) {
    setKind(nextKind);
    setText(null);
    setPreview(null);
    setDone(null);
    setError("");
    setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    setPreview(null);
    setDone(null);
    setError("");
    if (!file) return;
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    startTransition(async () => {
      const res = attempt(() => previewImport(kind, content));
      if (res.ok) setPreview(res.preview);
      else setError(res.error);
    });
  }

  function confirmImport() {
    if (!text) return;
    startTransition(async () => {
      const res = attempt(() => runImport(kind, text));
      if (res.ok) {
        setDone(res.preview);
        setPreview(null);
        setText(null);
        if (fileRef.current) fileRef.current.value = "";
      } else setError(res.error);
    });
  }

  const toApply = preview ? preview.counts.create + preview.counts.update : 0;
  const rows = preview?.rows.filter((r) => filter === "all" || r.action === filter) ?? [];

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Import CSV</h2>

      <div className="flex flex-wrap items-center gap-2">
        {(["products", "customers"] as const).map((k) => (
          <button
            key={k}
            onClick={() => reset(k)}
            className={kind === k ? "btn" : "btn-secondary"}
            disabled={pending}
          >
            {k === "products" ? "Products" : "Customers"}
          </button>
        ))}
        <button onClick={() => downloadTemplate(kind)} className="ml-auto text-sm text-indigo-600 hover:underline">
          Download {kind} template
        </button>
      </div>
      <p className="text-sm text-zinc-600">{HELP[kind]}</p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => onFile(e.target.files?.[0])}
        disabled={pending}
        className="text-sm"
      />

      {pending && !preview && <p className="text-sm text-zinc-500">Reading file…</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {done && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Import complete: {done.counts.create} added, {done.counts.update} updated
          {done.counts.unchanged ? `, ${done.counts.unchanged} unchanged` : ""}
          {done.counts.error ? `, ${done.counts.error} skipped because of errors` : ""}.
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">{fileName}</span> · {preview.rows.length} rows
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {(["all", "create", "update", "unchanged", "error"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 ${f === "all" ? "bg-zinc-100" : ACTION_STYLE[f]} ${
                  filter === f ? "ring-2 ring-zinc-400" : ""
                }`}
              >
                {f === "all" ? `All ${preview.rows.length}` : `${LABEL[f]} ${preview.counts[f]}`}
              </button>
            ))}
          </div>
          {preview.ignored.length > 0 && (
            <p className="text-xs text-zinc-500">Columns not imported: {preview.ignored.join(", ")}</p>
          )}

          <div className="max-h-96 overflow-auto rounded-md border border-zinc-200">
            <table className="table">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th>Row</th>
                  <th>Action</th>
                  <th>Item</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="align-top">
                    <td className="text-zinc-500">{r.line}</td>
                    <td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[r.action]}`}>
                        {LABEL[r.action]}
                      </span>
                    </td>
                    <td>{r.label}</td>
                    <td className="text-xs">
                      {[...r.errors, ...r.changes].map((m, i) => (
                        <div key={i} className={r.errors.length ? "text-red-700" : "text-zinc-600"}>
                          {m}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.counts.error > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {preview.counts.error} row(s) have errors and will be skipped. Fix them in the file and choose it again to
              include them.
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={confirmImport} disabled={pending || toApply === 0} className="btn">
              {pending ? "Importing…" : toApply ? `Import ${toApply} row(s)` : "Nothing to import"}
            </button>
            <button onClick={() => reset()} disabled={pending} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const LABEL: Record<PreviewRow["action"], string> = {
  create: "New",
  update: "Update",
  unchanged: "Unchanged",
  error: "Error",
};
