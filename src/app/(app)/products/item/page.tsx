"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, Barcode } from "lucide-react";
import { setArchived } from "@/app/actions/products";
import { products } from "@/db/schema";
import { countMovements, distinctValues, getProduct, getSettings, listMovements } from "@/lib/data";
import { dateTime, money, stockStatus } from "@/lib/format";
import { ProductForm } from "@/components/ProductForm";
import { StockForm } from "@/components/StockForm";
import { MovementTable } from "@/components/MovementTable";
import { Figure, PageHeader } from "@/components/PageHeader";
import { Missing, ProductThumb, StockBadge } from "@/components/ui";
import { useLive } from "@/db/live";

export default function ProductPage() {
  useLive();
  const p = getProduct(Number(useSearchParams().get("id")));
  if (!p) return <Missing what="product" back={{ href: "/products", label: "Products" }} />;
  const cur = getSettings().currencySymbol;
  const margin = p.sellingPrice - p.costPrice;
  const marginPct = p.sellingPrice > 0 ? Math.round((margin / p.sellingPrice) * 100) : 0;
  const status = stockStatus(p);
  const history = listMovements({ productId: p.id, limit: 10 });
  const totalMoves = countMovements({ productId: p.id });

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/products", label: "Products" }}
        title={
          <span className="flex items-center gap-3">
            <ProductThumb src={p.imagePath} size={44} />
            {p.name}
          </span>
        }
        badge={
          <>
            <StockBadge status={status} />
            {p.archived && <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium">Archived</span>}
          </>
        }
        subtitle={
          <>
            <span className="font-mono">{p.sku}</span>
            {p.category ? ` · ${p.category}` : ""} · updated {dateTime(p.updatedAt)}
          </>
        }
        actions={
          <>
          <Link href={`/products/labels?ids=${p.id}`} className="btn-secondary">
            <Barcode className="size-4" /> Print label
          </Link>
          <button onClick={() => setArchived(p.id, !p.archived)} className={p.archived ? "btn-secondary" : "btn-danger"}>
              {p.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              {p.archived ? "Restore" : "Archive"}
          </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure label="In stock" value={p.quantity} tone={status === "out" ? "bad" : status === "low" ? "warn" : undefined} />
        <Figure label="Minimum stock" value={p.minStock} />
        <Figure label="Margin" value={`${money(margin, cur)} · ${marginPct}%`} />
        <Figure label="Stock value (at cost)" value={money(p.costPrice * p.quantity, cur)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
        <ProductForm key={p.id} product={p} categories={distinctValues(products.category)} brands={distinctValues(products.brand)} />
        <div className="space-y-6 xl:sticky xl:top-6">
          <StockForm productId={p.id} />
        </div>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold tracking-tight">Stock history</h2>
            <p className="text-sm text-zinc-500">Latest 10 of {totalMoves} movements</p>
          </div>
          {totalMoves > 10 && (
            <Link href={`/inventory?product=${p.id}`} className="btn-secondary h-9">
              View all
            </Link>
          )}
        </div>
        <MovementTable rows={history} showProduct={false} />
      </section>
    </div>
  );
}
