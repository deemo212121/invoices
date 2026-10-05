"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLive } from "@/db/live";
import { countMovements, getProduct, listMovements, listProducts } from "@/lib/data";
import { MOVEMENT_LABEL } from "@/lib/format";
import { StockForm } from "@/components/StockForm";
import { MovementTable } from "@/components/MovementTable";
import { PageHeader, Pager } from "@/components/PageHeader";

const PER_PAGE = 25;
const TYPES = ["", "sale", "in", "return", "damaged", "out", "adjustment"];

export default function InventoryPage() {
  useLive();
  const sp = Object.fromEntries(useSearchParams()) as { type?: string; product?: string; page?: string };
  const type = TYPES.includes(sp.type ?? "") ? (sp.type ?? "") : "";
  const productId = Number(sp.product) || undefined;
  const product = productId ? getProduct(productId) : undefined;
  const total = countMovements({ type, productId });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const rows = listMovements({ type, productId, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const options = listProducts().map((p) => ({ id: p.id, name: p.name, sku: p.sku, quantity: p.quantity }));

  const href = (params: { type?: string; page?: number; product?: number | null }) => {
    const q = new URLSearchParams();
    const t = params.type ?? type;
    const pr = params.product === null ? undefined : (params.product ?? productId);
    if (t) q.set("type", t);
    if (pr) q.set("product", String(pr));
    if (params.page && params.page > 1) q.set("page", String(params.page));
    const s = q.toString();
    return `/inventory${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Every change to stock is recorded here: sales, deliveries, returns, damage and counts." />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[360px_1fr]">
        <div className="xl:sticky xl:top-6" data-tour="inventory-form">
          <StockForm products={options} />
        </div>

        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">Stock movements</h2>
              <p className="text-sm text-zinc-500 tabular-nums">{total.toLocaleString("en-US")} records</p>
            </div>
            {product && (
              <Link
                href={href({ product: null, page: 1 })}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 py-1 pr-2 pl-3 text-xs font-medium text-white"
              >
                {product.name}
                <X className="size-3.5" />
              </Link>
            )}
          </div>
          <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {TYPES.map((t) => (
              <Link
                key={t || "all"}
                href={href({ type: t, page: 1 })}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                  type === t ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {t ? MOVEMENT_LABEL[t] : "All"}
              </Link>
            ))}
          </div>
          <MovementTable rows={rows} />
          <Pager page={page} pages={pages} href={(p) => href({ page: p })} />
        </section>
      </div>
    </div>
  );
}
