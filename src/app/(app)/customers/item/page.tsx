"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { customerStats, getCustomer, getSettings, listSales } from "@/lib/data";
import { dateTime, money } from "@/lib/format";
import { CustomerForm } from "@/components/CustomerForm";
import { Figure, PageHeader } from "@/components/PageHeader";
import { Avatar, Empty, Missing } from "@/components/ui";
import { useLive } from "@/db/live";
import { invoiceHref } from "@/lib/links";

export default function CustomerPage() {
  useLive();
  const c = getCustomer(Number(useSearchParams().get("id")));
  if (!c) return <Missing what="customer" back={{ href: "/customers", label: "Customers" }} />;
  const history = listSales({ customerId: c.id });
  const s = customerStats().get(c.id);
  const cur = getSettings().currencySymbol;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={c.name} size={44} />
            {c.name}
          </span>
        }
        subtitle={[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details yet"}
      />
      <div className="grid grid-cols-3 gap-4">
        <Figure label="Orders" value={s?.orders ?? 0} />
        <Figure label="Total spent" value={money(s?.spent ?? 0, cur)} />
        <Figure label="Average order" value={money(s?.orders ? s.spent / s.orders : 0, cur)} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <CustomerForm key={c.id} customer={c} />
        <section className="card">
          <h2 className="mb-2 font-semibold tracking-tight">Purchase history</h2>
          {history.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <Link href={invoiceHref(h.id)} className="font-mono text-xs text-indigo-600 hover:underline">
                        {h.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-zinc-500">{dateTime(h.createdAt)}</td>
                    <td className="text-right font-medium">{money(h.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No purchases yet.</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
