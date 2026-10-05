"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { countSales, getSettings, listSales } from "@/lib/data";
import { dateTime, money } from "@/lib/format";
import { PageHeader, Pager } from "@/components/PageHeader";
import { SearchInput } from "@/components/ui";
import { useLive } from "@/db/live";
import { downloadCsv } from "@/lib/csv-export";
import { openInvoicePdf } from "@/lib/invoice-pdf";
import { invoiceHref } from "@/lib/links";

const PER_PAGE = 25;

export default function InvoicesPage() {
  useLive();
  const sp = useSearchParams();
  const q = sp.get("q") ?? undefined;
  const pageParam = sp.get("page");
  const total = countSales({ q });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pages);
  const rows = listSales({ q, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const cur = getSettings().currencySymbol;
  const href = (p: number) => {
    const qs = new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return `/invoices${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${total.toLocaleString("en-US")} sales invoice${total === 1 ? "" : "s"}`}
        actions={
          <button onClick={() => downloadCsv("sales")} className="btn-secondary">
            <Download className="size-4" /> Export CSV
          </button>
        }
      />
      <Form action="/invoices" className="flex gap-2">
        <SearchInput defaultValue={q} placeholder="Search invoice number or customer" />
        <button className="btn-secondary">Search</button>
      </Form>

      {rows.length ? (
        <div className="card-table" data-tour="invoices-list">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th className="col-sm">Customer</th>
                <th className="col-md">Channel</th>
                <th className="col-md">Payment</th>
                <th className="col-md text-right">Items</th>
                <th className="text-right">Total</th>
                <th className="text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.id} className={s.cancelledAt ? "opacity-60" : ""}>
                  <td>
                    <Link
                      href={invoiceHref(s.id)}
                      data-tour={i === 0 ? "invoices-first" : undefined}
                      className="font-mono text-[13px] font-medium text-zinc-900 hover:underline"
                    >
                      {s.invoiceNumber}
                    </Link>
                    <div className="text-xs text-zinc-500">{dateTime(s.createdAt)}</div>
                  </td>
                  <td className="col-sm">{s.customerName ?? <span className="text-zinc-400">Walk-in</span>}</td>
                  <td className="col-md">
                    {s.channel === "tiktok" ? (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">TikTok</span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">In store</span>
                    )}
                    {s.cancelledAt && (
                      <span className="ml-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/15 ring-inset">
                        Cancelled
                      </span>
                    )}
                  </td>
                  <td className="col-md text-zinc-600">{s.paymentMethod}</td>
                  <td className="col-md text-right text-zinc-600">{s.itemCount}</td>
                  <td className={`text-right font-semibold ${s.cancelledAt ? "line-through" : ""}`}>{money(s.total, cur)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => openInvoicePdf(s.id).catch((e) => alert(e.message))}
                      className="inline-grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
                      aria-label={`Open PDF of ${s.invoiceNumber}`}
                    >
                      <FileText className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-4">
            <Pager page={page} pages={pages} href={href} />
          </div>
        </div>
      ) : (
        <div className="card grid place-items-center py-16 text-center">
          <FileText className="size-8 text-zinc-300" strokeWidth={1.5} />
          <p className="mt-3 font-medium">{q ? "No invoices match" : "No invoices yet"}</p>
          <p className="text-sm text-zinc-500">Every completed sale gets a numbered Sales Invoice here.</p>
        </div>
      )}
    </div>
  );
}
