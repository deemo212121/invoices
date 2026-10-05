"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import JsBarcode from "jsbarcode";
import { Barcode, Minus, Plus, Printer, Search, Sparkles, X } from "lucide-react";
import { generateBarcodes } from "@/app/actions/products";
import { savePrintPreference } from "@/app/actions/settings";
import { money } from "@/lib/format";
import { isEan13, LABEL_FORMATS, labelFormat, type LabelFormat } from "@/lib/labels";
import { PageHeader } from "./PageHeader";

type P = { id: number; name: string; sku: string; barcode: string | null; price: number; category: string; quantity: number };
type Opts = { name: boolean; price: boolean; sku: boolean };

export function LabelStudio({
  products,
  currency,
  initialFormat,
  preselected,
}: {
  products: P[];
  currency: string;
  initialFormat: string;
  preselected: number[];
}) {
  const [formatId, setFormatId] = useState(initialFormat);
  const [counts, setCounts] = useState<Record<number, number>>(() => Object.fromEntries(preselected.map((id) => [id, 1])));
  const [search, setSearch] = useState("");
  const [opts, setOpts] = useState<Opts>({ name: true, price: true, sku: false });
  const [busy, start] = useTransition();
  const fmt = labelFormat(formatId);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const chosen = Object.entries(counts)
    .map(([id, n]) => ({ p: byId.get(Number(id))!, n }))
    .filter((x) => x.p && x.n > 0);
  const missing = chosen.filter((x) => !x.p.barcode).map((x) => x.p);
  const labels = chosen.filter((x) => x.p.barcode).flatMap((x) => Array.from({ length: x.n }, () => x.p));
  const matches = products.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q);
  });

  const setCount = (id: number, n: number) =>
    setCounts((c) => {
      const next = { ...c };
      if (n > 0) next[id] = Math.min(500, n);
      else delete next[id];
      return next;
    });

  const chooseFormat = (id: string) => {
    setFormatId(id);
    start(() => savePrintPreference("labelFormat", id));
  };

  // Print page size follows the label stock.
  const pageCss =
    fmt.kind === "sheet" ? "@page { size: A4; margin: 0; }" : `@page { size: ${fmt.width}mm ${fmt.height}mm; margin: 0; }`;
  const perPage = fmt.kind === "sheet" ? fmt.cols! * fmt.rows! : 1;
  const pages: P[][] = [];
  for (let i = 0; i < labels.length; i += perPage) pages.push(labels.slice(i, i + perPage));

  return (
    <div className="space-y-6">
      <style>{pageCss}</style>
      <div className="print:hidden">
        <PageHeader
          back={{ href: "/products", label: "Products" }}
          title="Print barcode labels"
          subtitle="Pick products, choose your label stock, and print. Scans straight into the POS."
          actions={
            <button className="btn" disabled={!labels.length} onClick={() => window.print()}>
              <Printer className="size-4" /> Print {labels.length || ""} label{labels.length === 1 ? "" : "s"}
            </button>
          }
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[380px_1fr] print:block">
        {/* ── Controls ── */}
        <div className="space-y-4 print:hidden">
          <section className="card space-y-3">
            <h2 className="text-sm font-semibold">Label stock</h2>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
              {(["sheet", "thermal"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => chooseFormat(LABEL_FORMATS.find((f) => f.kind === k)!.id)}
                  className={`h-9 rounded-md text-sm font-medium transition ${
                    fmt.kind === k ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {k === "sheet" ? "A4 sheet" : "Thermal label"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {LABEL_FORMATS.filter((f) => f.kind === fmt.kind).map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ring-1 ring-zinc-200 transition ring-inset has-[:checked]:bg-zinc-50 has-[:checked]:ring-zinc-900"
                >
                  <input type="radio" name="fmt" checked={f.id === formatId} onChange={() => chooseFormat(f.id)} className="accent-zinc-900" />
                  {f.name}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
              {(["name", "price", "sku"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} className="accent-zinc-900" />
                  {k === "sku" ? "SKU" : k[0].toUpperCase() + k.slice(1)}
                </label>
              ))}
            </div>
          </section>

          <section className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Products</h2>
              {chosen.length > 0 && (
                <button onClick={() => setCounts({})} className="text-xs text-zinc-500 hover:text-red-600">
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="input pl-9" />
            </div>
            <ul className="scroll-thin max-h-[420px] divide-y divide-zinc-100 overflow-y-auto">
              {matches.map((p) => {
                const n = counts[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        {p.barcode ? (
                          <span className="font-mono">{p.barcode}</span>
                        ) : (
                          <span className="text-amber-700">No barcode</span>
                        )}
                      </div>
                    </div>
                    {n > 0 ? (
                      <div className="flex items-center rounded-lg ring-1 ring-zinc-200">
                        <button onClick={() => setCount(p.id, n - 1)} className="grid size-7 place-items-center text-zinc-500" aria-label="Fewer">
                          {n === 1 ? <X className="size-3.5" /> : <Minus className="size-3.5" />}
                        </button>
                        <input
                          type="number"
                          value={n}
                          min={1}
                          onChange={(e) => setCount(p.id, Number(e.target.value))}
                          className="w-10 [appearance:textfield] bg-transparent text-center text-sm font-medium tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onClick={() => setCount(p.id, n + 1)} className="grid size-7 place-items-center text-zinc-500" aria-label="More">
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setCount(p.id, 1)} className="btn-secondary h-8 px-3 text-xs">
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {missing.length > 0 && (
            <section className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-600/15">
              <div className="font-medium">{missing.length} selected product(s) have no barcode</div>
              <p className="mt-1 text-xs text-amber-800">
                Generate in-store barcodes (EAN-13 starting with 2, reserved for a store&apos;s own labels, so they
                never clash with manufacturer barcodes). They&apos;re saved to the products.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    await generateBarcodes(missing.map((p) => p.id));
                  })
                }
                className="btn mt-3 h-9"
              >
                <Sparkles className="size-4" /> {busy ? "Generating…" : "Generate barcodes"}
              </button>
            </section>
          )}
        </div>

        {/* ── Preview / print area ── */}
        <div className="min-w-0">
          {labels.length ? (
            <div className="space-y-6 overflow-x-auto print:space-y-0 print:overflow-visible">
              {pages.map((page, pi) =>
                fmt.kind === "sheet" ? (
                  <Sheet key={pi} fmt={fmt} labels={page} currency={currency} opts={opts} />
                ) : (
                  <div key={pi} className="flex flex-wrap gap-4 print:block">
                    {page.map((p, i) => (
                      <div key={i} className="shadow-md ring-1 ring-zinc-200 print:shadow-none print:ring-0 print:break-after-page">
                        <Label p={p} fmt={fmt} currency={currency} opts={opts} />
                      </div>
                    ))}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="card grid place-items-center py-20 text-center print:hidden">
              <Barcode className="size-9 text-zinc-300" strokeWidth={1.25} />
              <p className="mt-3 font-medium">No labels yet</p>
              <p className="text-sm text-zinc-500">Add products on the left to see the preview here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sheet({ fmt, labels, currency, opts }: { fmt: LabelFormat; labels: P[]; currency: string; opts: Opts }) {
  return (
    <div
      className="mx-auto bg-white shadow-[0_8px_30px_rgba(16,24,40,0.12)] ring-1 ring-zinc-200 print:mx-0 print:shadow-none print:ring-0 print:break-after-page"
      style={{
        width: "210mm",
        height: "297mm",
        paddingTop: `${fmt.marginTop}mm`,
        paddingLeft: `${fmt.marginLeft}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(${fmt.cols}, ${fmt.width}mm)`,
        gridTemplateRows: `repeat(${fmt.rows}, ${fmt.height}mm)`,
      }}
    >
      {labels.map((p, i) => (
        <div key={i} className="outline outline-1 outline-dashed outline-zinc-200 print:outline-none">
          <Label p={p} fmt={fmt} currency={currency} opts={opts} />
        </div>
      ))}
    </div>
  );
}

function Label({ p, fmt, currency, opts }: { p: P; fmt: LabelFormat; currency: string; opts: Opts }) {
  const svg = useRef<SVGSVGElement>(null);
  const small = fmt.height < 32;
  useEffect(() => {
    if (!svg.current || !p.barcode) return;
    try {
      JsBarcode(svg.current, p.barcode, {
        format: isEan13(p.barcode) ? "EAN13" : "CODE128",
        width: 2,
        height: 60,
        fontSize: 16,
        margin: 0,
        textMargin: 2,
        flat: true,
      });
      // Scale the barcode to fit the label without distorting it.
      const w = svg.current.getAttribute("width");
      const h = svg.current.getAttribute("height");
      if (w && h) {
        svg.current.setAttribute("viewBox", `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
        svg.current.removeAttribute("width");
        svg.current.removeAttribute("height");
      }
    } catch {
      /* an unprintable barcode value just shows its text below */
    }
  }, [p.barcode]);

  return (
    <div
      className="flex flex-col items-center justify-center overflow-hidden bg-white text-center text-black"
      style={{ width: `${fmt.width}mm`, height: `${fmt.height}mm`, padding: "1.5mm 2.5mm" }}
    >
      {opts.name && (
        <div className={`line-clamp-1 w-full font-semibold ${small ? "text-[7pt]" : "text-[8.5pt]"}`}>{p.name}</div>
      )}
      <svg ref={svg} className="min-h-0 w-full flex-1" preserveAspectRatio="xMidYMid meet" />
      <div className={`flex w-full items-baseline justify-between gap-1 ${small ? "text-[7pt]" : "text-[8pt]"}`}>
        {opts.sku ? <span className="font-mono">{p.sku}</span> : <span />}
        {opts.price && <span className={`font-bold ${small ? "text-[9pt]" : "text-[11pt]"}`}>{money(p.price, currency)}</span>}
      </div>
    </div>
  );
}
