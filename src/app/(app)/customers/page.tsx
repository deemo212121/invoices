"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { Download, Plus, Upload, Users } from "lucide-react";
import { customerStats, getSettings, listCustomers } from "@/lib/data";
import { dateOnly, money } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Avatar, SearchInput } from "@/components/ui";
import { useLive } from "@/db/live";
import { downloadCsv } from "@/lib/csv-export";
import { customerHref } from "@/lib/links";

export default function CustomersPage() {
  useLive();
  const q = useSearchParams().get("q") ?? undefined;
  const rows = listCustomers(q);
  const stats = customerStats();
  const cur = getSettings().currencySymbol;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} ${rows.length === 1 ? "customer" : "customers"}`}
        actions={
          <>
            <Link href="/settings/csv" className="btn-secondary">
              <Upload className="size-4" /> Import
            </Link>
            <button onClick={() => downloadCsv("customers")} className="btn-secondary">
              <Download className="size-4" /> Export
            </button>
            <Link href="/customers/new" className="btn">
              <Plus className="size-4" /> Add customer
            </Link>
          </>
        }
      />
      <Form action="/customers" className="flex gap-2">
        <SearchInput defaultValue={q} placeholder="Search name, phone or email" />
        <button className="btn-secondary">Search</button>
      </Form>
      {rows.length ? (
        <div className="card-table">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th className="col-md">Contact</th>
                <th className="col-sm text-right">Orders</th>
                <th className="text-right">Total spent</th>
                <th className="col-sm text-right">Last purchase</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={customerHref(c.id)} className="flex items-center gap-3">
                        <Avatar name={c.name} />
                        <span>
                          <span className="block font-medium text-zinc-900 hover:underline">{c.name}</span>
                          {c.address && <span className="block max-w-64 truncate text-xs text-zinc-500">{c.address}</span>}
                        </span>
                      </Link>
                    </td>
                    <td className="col-md text-zinc-600">
                      <div>{c.phone || <span className="text-zinc-300">—</span>}</div>
                      {c.email && <div className="text-xs text-zinc-500">{c.email}</div>}
                    </td>
                    <td className="col-sm text-right">{s?.orders ?? 0}</td>
                    <td className="text-right font-medium">{money(s?.spent ?? 0, cur)}</td>
                    <td className="col-sm text-right text-zinc-500">{s?.last ? dateOnly(s.last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card grid place-items-center py-16 text-center">
          <Users className="size-8 text-zinc-300" strokeWidth={1.5} />
          <p className="mt-3 font-medium">No customers found</p>
          <p className="text-sm text-zinc-500">Add regulars to track their purchases and print their details on invoices.</p>
        </div>
      )}
    </div>
  );
}
