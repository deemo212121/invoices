import type { Invoice } from "@/lib/data";
import { dateTime, money } from "@/lib/format";
import { invoiceView, type InvoiceRow } from "@/lib/invoice-view";

// Narrow receipt for thermal printers (80mm or 58mm roll). Same content as the A4 invoice.
export function ReceiptView({ inv, paper }: { inv: Invoice; paper: "80mm" | "58mm" }) {
  const { sale, items, business: b } = inv;
  const view = invoiceView(inv);
  const fmt = (n: number) => money(n, b.currencySymbol);
  const narrow = paper === "58mm";

  return (
    <div className="mx-auto" style={{ width: paper }} data-receipt>
      <div
        className={`bg-white px-3 py-4 leading-snug text-zinc-950 shadow-[0_1px_3px_rgba(16,24,40,0.08),0_12px_32px_-12px_rgba(16,24,40,0.15)] ring-1 ring-zinc-900/5 print:px-[3mm] print:py-[2mm] print:shadow-none print:ring-0 ${
          narrow ? "text-[10.5px]" : "text-[12px]"
        }`}
      >
        <div className="text-center">
          <div className="text-[1.25em] font-bold">{b.businessName}</div>
          {view.sellerLines.map((l) => (
            <div key={l} className="whitespace-pre-line">
              {l}
            </div>
          ))}
        </div>
        <Rule />
        <div className="text-center font-bold tracking-widest">{view.title}</div>
        <Pair left="No." right={<span className="font-mono font-semibold">{sale.invoiceNumber}</span>} />
        <Pair left="Date" right={dateTime(sale.createdAt)} />
        <Pair left="Sold to" right={view.buyerLines.join(", ")} />
        <Rule />
        {items.map((i) => (
          <div key={i.id} className="mb-1">
            <div className="font-medium">{i.name}</div>
            <Pair left={`${i.quantity} × ${fmt(i.unitPrice)}`} right={fmt(i.lineTotal)} />
          </div>
        ))}
        <Rule />
        {view.totals.map((r) => (
          <Line key={r.label} r={r} fmt={fmt} />
        ))}
        <Line r={{ label: `Paid (${sale.paymentMethod})`, amount: sale.amountPaid }} fmt={fmt} />
        <Line r={{ label: "Change", amount: sale.change }} fmt={fmt} />
        {view.vatBreakdown && (
          <>
            <Rule />
            {view.vatBreakdown.map((r) => (
              <Line key={r.label} r={r} fmt={fmt} />
            ))}
          </>
        )}
        {view.notes.length > 0 && (
          <>
            <Rule />
            {view.notes.map((n) => (
              <div key={n} className="text-[0.92em]">
                {n}
              </div>
            ))}
          </>
        )}
        {b.invoiceFooter && (
          <>
            <Rule />
            <div className="text-center">{b.invoiceFooter}</div>
          </>
        )}
      </div>
    </div>
  );
}

function Pair({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 whitespace-nowrap">{left}</span>
      <span className="text-right tabular-nums">{right}</span>
    </div>
  );
}

function Line({ r, fmt }: { r: InvoiceRow; fmt: (n: number) => string }) {
  return (
    <div className={`flex justify-between gap-2 ${r.bold ? "text-[1.15em] font-bold" : ""}`}>
      <span>{r.label}</span>
      <span className="shrink-0 tabular-nums">{r.negative ? `-${fmt(r.amount)}` : fmt(r.amount)}</span>
    </div>
  );
}

function Rule() {
  return <div className="my-2 border-t border-dashed border-zinc-400" />;
}
