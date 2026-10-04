import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/data";
import { dateTime, money } from "@/lib/format";
import { invoiceView, type InvoiceRow } from "@/lib/invoice-view";
import { ChevronLeft, Download, ExternalLink, Plus } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";
import { PaperToggle } from "@/components/PaperToggle";
import { ReceiptView } from "@/components/ReceiptView";
import { ReceiptPrintSizer } from "@/components/ReceiptPrintSizer";
import { invoicePaper } from "@/lib/labels";

export default async function InvoicePage({ params, searchParams }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const inv = getInvoice(Number(id));
  if (!inv) notFound();
  const { sale, items, business: b } = inv;
  const view = invoiceView(inv);
  // Paper: chosen on this page (?paper=) or the saved default from Settings.
  const paper = invoicePaper(typeof sp.paper === "string" ? sp.paper : b.invoicePaper);

  const fmt = (n: number) => money(n, b.currencySymbol);
  const row = (r: InvoiceRow) => (
    <div key={r.label} className={`flex justify-between ${r.bold ? "border-t border-zinc-300 pt-2 text-base font-semibold" : ""}`}>
      <span className={r.bold ? "" : "text-zinc-600"}>{r.label}</span>
      <span>{r.negative ? `−${fmt(r.amount)}` : fmt(r.amount)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {paper === "a4" ? (
        <style>{"@page { size: A4; margin: 14mm; }"}</style>
      ) : (
        <ReceiptPrintSizer widthMm={paper === "58mm" ? 58 : 80} />
      )}
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <Link href="/invoices" className="mr-auto inline-flex items-center gap-0.5 text-sm text-zinc-500 hover:text-zinc-900">
          <ChevronLeft className="size-4" /> Invoices
        </Link>
        <Link href="/pos" className="btn-secondary">
          <Plus className="size-4" /> New sale
        </Link>
        <PaperToggle current={paper} />
        <a href={`/invoices/${sale.id}/pdf?download=1&paper=${paper}`} className="btn-secondary">
          <Download className="size-4" /> PDF
        </a>
        <a href={`/invoices/${sale.id}/pdf?paper=${paper}`} target="_blank" className="btn-secondary">
          <ExternalLink className="size-4" /> Open
        </a>
        <PrintButton />
      </div>

      {paper === "a4" ? (
      <article className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white p-10 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_32px_-12px_rgba(16,24,40,0.12)] ring-1 ring-zinc-900/5 max-sm:p-5 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-700 print:hidden" />
        <header className="flex flex-col justify-between gap-6 border-b border-zinc-200 pb-6 sm:flex-row">
          <div className="flex gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-zinc-900 text-base font-bold text-amber-300">
              {b.businessName
                .replace(/\(.*?\)/g, "")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{b.businessName}</h1>
              <div className="mt-1 text-sm leading-relaxed whitespace-pre-line text-zinc-500">{view.sellerLines.join("\n")}</div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-xs font-semibold tracking-[0.2em] text-zinc-400">{view.title}</div>
            <div className="mt-1.5 font-mono text-lg font-semibold">{sale.invoiceNumber}</div>
            <div className="text-sm text-zinc-500">{dateTime(sale.createdAt)}</div>
            <div className="mt-3">
              {sale.cancelledAt ? (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-red-700 ring-1 ring-red-600/15 ring-inset">
                  CANCELLED
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">
                  PAID · {sale.paymentMethod.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </header>

        <section className="py-6 text-sm">
          <div className="text-xs font-semibold text-zinc-500 uppercase">Sold to</div>
          <div className="mt-1 whitespace-pre-line">
            <div className="font-medium">{view.buyerLines[0]}</div>
            {view.buyerLines.slice(1).join("\n")}
          </div>
        </section>

        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit price</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.name}
                  <div className="font-mono text-xs text-zinc-400">{i.sku}</div>
                </td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right">{fmt(i.unitPrice)}</td>
                <td className="text-right">{fmt(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-6 text-sm">
          <div className="w-60 space-y-1">
            {view.vatBreakdown && (
              <div className="space-y-1 rounded-md border border-zinc-200 p-3">{view.vatBreakdown.map(row)}</div>
            )}
          </div>
          <div className="w-72 space-y-1">
            {view.totals.map(row)}
            {row({ label: `Paid (${sale.paymentMethod})`, amount: sale.amountPaid })}
            {row({ label: "Change", amount: sale.change })}
          </div>
        </div>

        {view.notes.length > 0 && (
          <div className="mt-6 space-y-1 text-xs text-zinc-600">
            {view.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}

        {b.invoiceFooter && (
          <footer className="mt-10 border-t border-zinc-200 pt-4 text-center text-sm text-zinc-500">
            {b.invoiceFooter}
          </footer>
        )}
      </article>
      ) : (
        <ReceiptView inv={inv} paper={paper} />
      )}
    </div>
  );
}
