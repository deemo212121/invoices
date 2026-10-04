import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceListings, marketplaceOrders, products, saleItems, sales, settings } from "@/db/schema";
import { round2 } from "../format";
import { applyStockChange, nowSql } from "../inventory";
import { nextInvoiceNumber } from "../sales";
import { computeSale, VAT_RATE } from "../tax";
import {
  CHANNEL,
  getConnection,
  searchOrders,
  searchProducts,
  updateConnection,
  updateInventory,
  type TtOrder,
} from "./client";

// Paid orders become sales; unpaid / on-hold orders wait; cancelled orders are reversed if imported.
const IMPORTABLE = new Set([
  "AWAITING_SHIPMENT",
  "PARTIALLY_SHIPPING",
  "AWAITING_COLLECTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
]);
const FIRST_SYNC_DAYS = 30;
const MAX_PAGES = 40;

const iso = (unix: number) => new Date(unix * 1000).toISOString();

// ---------- listings ----------

/** Downloads all TikTok products/SKUs and links new ones to our products by matching SKU. */
export async function syncListings() {
  const listings: { productId: string; title: string; status: string; skuId: string; sellerSku: string; qty: number; warehouseId: string }[] = [];
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const data = await searchProducts(page);
    for (const p of data.products ?? []) {
      for (const s of p.skus ?? []) {
        listings.push({
          productId: p.id,
          title: p.title,
          status: p.status,
          skuId: s.id,
          sellerSku: s.seller_sku ?? "",
          qty: (s.inventory ?? []).reduce((t, inv) => t + (inv.quantity ?? 0), 0),
          warehouseId: s.inventory?.[0]?.warehouse_id ?? "",
        });
      }
    }
    page = data.next_page_token;
    if (!page) break;
  }

  const bySku = new Map(db.select({ id: products.id, sku: products.sku }).from(products).all().map((p) => [p.sku, p.id]));
  let linked = 0;
  db.transaction((tx) => {
    for (const l of listings) {
      const existing = tx
        .select()
        .from(marketplaceListings)
        .where(and(eq(marketplaceListings.channel, CHANNEL), eq(marketplaceListings.externalSkuId, l.skuId)))
        .get();
      const values = {
        externalProductId: l.productId,
        sellerSku: l.sellerSku,
        title: l.title,
        status: l.status,
        externalQuantity: l.qty,
        warehouseId: l.warehouseId,
        updatedAt: nowSql,
      };
      if (existing) {
        tx.update(marketplaceListings).set(values).where(eq(marketplaceListings.id, existing.id)).run();
      } else {
        const productId = (l.sellerSku && bySku.get(l.sellerSku)) || null;
        if (productId) linked++;
        tx.insert(marketplaceListings).values({ channel: CHANNEL, externalSkuId: l.skuId, productId, ...values }).run();
      }
    }
  });
  return { listings: listings.length, autoLinked: linked };
}

// ---------- orders ----------

type Outcome = "imported" | "waiting" | "problem" | "cancelled" | "unchanged";

function recordOrder(o: TtOrder, values: { saleId?: number | null; problem?: string }) {
  const row = {
    status: o.status,
    orderCreatedAt: iso(o.create_time),
    total: Number(o.payment?.total_amount ?? 0) || 0,
    buyerName: o.recipient_address?.name ?? "",
    problem: values.problem ?? "",
    updatedAt: nowSql,
    ...(values.saleId !== undefined ? { saleId: values.saleId } : {}),
  };
  db.insert(marketplaceOrders)
    .values({ channel: CHANNEL, externalOrderId: o.id, ...row })
    .onConflictDoUpdate({ target: [marketplaceOrders.channel, marketplaceOrders.externalOrderId], set: row })
    .run();
}

/** Turns one TikTok order into a sale (or reverses it if cancelled). Never guesses: problems are recorded. */
function processOrder(o: TtOrder): Outcome {
  const known = db
    .select()
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.channel, CHANNEL), eq(marketplaceOrders.externalOrderId, o.id)))
    .get();

  if (o.status === "CANCELLED") {
    if (known?.saleId) {
      const sale = db.select().from(sales).where(eq(sales.id, known.saleId)).get();
      if (sale && !sale.cancelledAt) {
        db.transaction((tx) => {
          for (const item of tx.select().from(saleItems).where(eq(saleItems.saleId, sale.id)).all()) {
            applyStockChange(tx, {
              productId: item.productId,
              type: "return",
              change: item.quantity,
              note: `TikTok order ${o.id} cancelled (${sale.invoiceNumber})`,
              saleId: sale.id,
            });
          }
          tx.update(sales).set({ cancelledAt: nowSql }).where(eq(sales.id, sale.id)).run();
        });
        recordOrder(o, {});
        return "cancelled";
      }
    }
    recordOrder(o, {});
    return "unchanged";
  }

  if (known?.saleId) {
    recordOrder(o, {}); // already imported; just keep the status current
    return "unchanged";
  }
  if (!IMPORTABLE.has(o.status)) {
    recordOrder(o, { problem: "" });
    return "waiting";
  }

  // Each TikTok line item is one unit: group them per SKU (skipping cancelled items).
  const groups = new Map<string, { qty: number; price: number; name: string; sellerSku: string }>();
  for (const li of o.line_items ?? []) {
    if (li.display_status === "CANCELLED") continue;
    const g = groups.get(li.sku_id) ?? {
      qty: 0,
      price: Number(li.sale_price ?? li.original_price ?? 0) || 0,
      name: [li.product_name, li.sku_name && li.sku_name !== "Default" ? li.sku_name : ""].filter(Boolean).join(" - "),
      sellerSku: li.seller_sku ?? "",
    };
    g.qty++;
    groups.set(li.sku_id, g);
  }
  if (!groups.size) {
    recordOrder(o, { problem: "Order has no items" });
    return "problem";
  }

  // Link each TikTok SKU to one of our products.
  const listings = db
    .select()
    .from(marketplaceListings)
    .where(and(eq(marketplaceListings.channel, CHANNEL), inArray(marketplaceListings.externalSkuId, [...groups.keys()])))
    .all();
  const linkBySku = new Map(listings.map((l) => [l.externalSkuId, l.productId]));
  const lines: { productId: number; qty: number; price: number; name: string }[] = [];
  const unlinked: string[] = [];
  for (const [skuId, g] of groups) {
    let productId = linkBySku.get(skuId) ?? null;
    if (!productId && g.sellerSku) {
      productId = db.select({ id: products.id }).from(products).where(eq(products.sku, g.sellerSku)).get()?.id ?? null;
    }
    if (!productId) unlinked.push(`${g.name || skuId}${g.sellerSku ? ` (SKU ${g.sellerSku})` : ""}`);
    else lines.push({ productId, qty: g.qty, price: g.price, name: g.name });
  }
  if (unlinked.length) {
    recordOrder(o, { problem: `Not linked to a product: ${unlinked.join(", ")}` });
    return "problem";
  }

  try {
    const saleId = db.transaction((tx) => {
      const { vatRegistered } = tx.select().from(settings).where(eq(settings.id, 1)).get()!;
      const rows = tx.select().from(products).where(inArray(products.id, lines.map((l) => l.productId))).all();
      const byId = new Map(rows.map((r) => [r.id, r]));
      const t = computeSale({
        lines: lines.map((l) => ({
          price: l.price,
          quantity: l.qty,
          vatExempt: byId.get(l.productId)!.vatExempt,
          seniorEligible: false,
        })),
        vatRegistered,
        discountType: "amount",
        discountValue: 0,
        senior: false,
        seniorUsedThisWeek: 0,
      });
      const invoiceNumber = nextInvoiceNumber(tx);
      const sale = tx
        .insert(sales)
        .values({
          invoiceNumber,
          customerId: null,
          subtotal: t.subtotal,
          discount: 0,
          taxMode: vatRegistered ? "vat" : "nonvat",
          taxRate: vatRegistered ? VAT_RATE : 0,
          tax: t.vat,
          vatableSales: t.vatableSales,
          vatExemptSales: t.vatExemptSales,
          total: t.total,
          paymentMethod: "TikTok Shop",
          amountPaid: t.total,
          change: 0,
          buyerName: o.recipient_address?.name ?? "",
          buyerAddress: o.recipient_address?.full_address ?? "",
          channel: "tiktok",
          externalOrderId: o.id,
          createdAt: iso(o.paid_time || o.create_time),
        })
        .returning({ id: sales.id })
        .get();
      for (const l of lines) {
        const p = byId.get(l.productId)!;
        tx.insert(saleItems)
          .values({
            saleId: sale.id,
            productId: p.id,
            name: p.name,
            sku: p.sku,
            quantity: l.qty,
            unitPrice: l.price,
            lineTotal: round2(l.price * l.qty),
          })
          .run();
        applyStockChange(tx, {
          productId: p.id,
          type: "sale",
          change: -l.qty,
          note: `${invoiceNumber} · TikTok ${o.id}`,
          saleId: sale.id,
        });
      }
      return sale.id;
    });
    recordOrder(o, { saleId, problem: "" });
    return "imported";
  } catch (e) {
    // Typically "Not enough stock": nothing was written; it is retried on the next sync.
    recordOrder(o, { problem: e instanceof Error ? e.message : String(e) });
    return "problem";
  }
}

/** Fetches orders updated since the last sync and processes them; also retries earlier problems. */
export async function syncOrders() {
  const c = getConnection();
  const now = Math.floor(Date.now() / 1000);
  // Overlap by 10 minutes so nothing updated during the previous sync is missed.
  const since = c.ordersSyncedTo ? c.ordersSyncedTo - 600 : now - FIRST_SYNC_DAYS * 86400;
  const counts: Record<Outcome, number> = { imported: 0, waiting: 0, problem: 0, cancelled: 0, unchanged: 0 };

  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const data = await searchOrders({ update_time_ge: since }, page);
    for (const o of data.orders ?? []) counts[processOrder(o)]++;
    page = data.next_page_token;
    if (!page) break;
  }
  updateConnection({ ordersSyncedTo: now });
  return counts;
}

/** Re-checks stored orders that had problems (e.g. after linking a product or adding stock). */
export async function retryProblemOrders() {
  const pending = db
    .select()
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.channel, CHANNEL), sql`${marketplaceOrders.problem} <> ''`))
    .all();
  if (!pending.length) return 0;
  // Re-fetch them by searching from the oldest problem's creation time.
  const oldest = Math.min(...pending.map((p) => Math.floor(new Date(p.orderCreatedAt).getTime() / 1000)));
  const ids = new Set(pending.map((p) => p.externalOrderId));
  let fixed = 0;
  let page: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const data = await searchOrders({ update_time_ge: oldest }, page);
    for (const o of data.orders ?? []) if (ids.has(o.id) && processOrder(o) === "imported") fixed++;
    page = data.next_page_token;
    if (!page) break;
  }
  return fixed;
}

// ---------- stock push ----------

/** Sends our stock level for every linked SKU to TikTok, so the shop never oversells. */
export async function pushStock() {
  const rows = db
    .select({ l: marketplaceListings, qty: products.quantity, archived: products.archived })
    .from(marketplaceListings)
    .innerJoin(products, eq(products.id, marketplaceListings.productId))
    .where(and(eq(marketplaceListings.channel, CHANNEL), isNotNull(marketplaceListings.productId)))
    .all();
  const byProduct = new Map<string, typeof rows>();
  for (const r of rows) byProduct.set(r.l.externalProductId, [...(byProduct.get(r.l.externalProductId) ?? []), r]);

  let updated = 0;
  const errors: string[] = [];
  for (const [externalProductId, group] of byProduct) {
    const skus = group.map((r) => ({
      id: r.l.externalSkuId,
      inventory: [{ quantity: r.archived ? 0 : Math.max(0, r.qty), ...(r.l.warehouseId ? { warehouse_id: r.l.warehouseId } : {}) }],
    }));
    try {
      const res = await updateInventory(externalProductId, skus);
      const failed = new Set((res.errors ?? []).map((e) => e.detail?.sku_id).filter(Boolean));
      for (const e of res.errors ?? []) errors.push(`${group[0].l.title}: ${e.message ?? "update failed"}`);
      for (const r of group) {
        if (failed.has(r.l.externalSkuId)) continue;
        db.update(marketplaceListings)
          .set({ externalQuantity: r.archived ? 0 : Math.max(0, r.qty), updatedAt: nowSql })
          .where(eq(marketplaceListings.id, r.l.id))
          .run();
        updated++;
      }
    } catch (e) {
      errors.push(`${group[0].l.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { updated, errors };
}

// ---------- full sync ----------

export async function runSync() {
  const started = new Date().toISOString();
  try {
    const l = await syncListings();
    const o = await syncOrders();
    const fixed = await retryProblemOrders();
    const s = await pushStock();
    const summary =
      `${o.imported + fixed} order(s) imported, ${o.cancelled} cancelled, ${o.problem} need attention, ` +
      `${l.listings} TikTok SKU(s), ${s.updated} stock level(s) sent` +
      (s.errors.length ? `. Stock errors: ${s.errors.slice(0, 3).join("; ")}` : "");
    updateConnection({ lastSyncAt: started, lastSyncResult: summary });
    return { ok: true as const, summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    updateConnection({ lastSyncAt: started, lastSyncResult: `Failed: ${msg}` });
    return { ok: false as const, summary: msg };
  }
}
