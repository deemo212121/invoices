import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { listMovements } from "@/lib/data";
import { dateTime, MOVEMENT_LABEL } from "@/lib/format";
import { Empty } from "./ui";

const TYPE_STYLE: Record<string, string> = {
  in: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  return: "bg-sky-50 text-sky-700 ring-sky-600/15",
  sale: "bg-zinc-100 text-zinc-700 ring-zinc-900/5",
  out: "bg-zinc-100 text-zinc-700 ring-zinc-900/5",
  damaged: "bg-red-50 text-red-700 ring-red-600/15",
  adjustment: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export function TypePill({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TYPE_STYLE[type] ?? TYPE_STYLE.out}`}
    >
      {MOVEMENT_LABEL[type] ?? type}
    </span>
  );
}

export function MovementTable({
  rows,
  showProduct = true,
}: {
  rows: ReturnType<typeof listMovements>;
  showProduct?: boolean;
}) {
  if (!rows.length) return <Empty>No stock movements yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            {showProduct && <th>Product</th>}
            <th>Type</th>
            <th className="text-right">Change</th>
            <th className="col-sm text-right">Stock after</th>
            <th className="col-md">Reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="text-zinc-500 sm:whitespace-nowrap">{dateTime(m.createdAt)}</td>
              {showProduct && (
                <td className="max-w-64">
                  <Link href={`/products/${m.productId}`} className="block truncate font-medium hover:underline">
                    {m.productName}
                  </Link>
                  <span className="font-mono text-xs text-zinc-400">{m.sku}</span>
                </td>
              )}
              <td>
                <TypePill type={m.type} />
              </td>
              <td className="text-right">
                <span
                  className={`inline-flex items-center gap-0.5 font-semibold ${m.quantityChange < 0 ? "text-zinc-900" : "text-emerald-700"}`}
                >
                  {m.quantityChange < 0 ? (
                    <ArrowDownLeft className="size-3.5 text-zinc-400" />
                  ) : (
                    <ArrowUpRight className="size-3.5" />
                  )}
                  {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                </span>
              </td>
              <td className="col-sm text-right text-zinc-600">{m.quantityAfter}</td>
              <td className="col-md max-w-72 truncate text-zinc-600">
                {m.saleId ? (
                  <Link href={`/invoices/${m.saleId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                    {m.invoiceNumber}
                  </Link>
                ) : (
                  m.note || <span className="text-zinc-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
