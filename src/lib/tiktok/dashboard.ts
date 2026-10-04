import "server-only";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceListings, marketplaceOrders, products, saleItems, sales } from "@/db/schema";
import { CHANNEL } from "./client";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function periodStart(days: number, offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days + 1 - offsetDays);
  return d;
}

function salesTotal(channel: "pos" | "tiktok", from: Date, to?: Date) {
  return db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)` })
    .from(sales)
    .where(
      and(
        eq(sales.channel, channel),
        isNull(sales.cancelledAt),
        gte(sales.createdAt, from.toISOString()),
        to ? lt(sales.createdAt, to.toISOString()) : undefined,
      ),
    )
    .get()!;
}

export function tiktokDashboard(days: Range) {
  const start = periodStart(days);
  const prevStart = periodStart(days, days);

  const current = salesTotal("tiktok", start);
  const previous = salesTotal("tiktok", prevStart, start);
  const pos = salesTotal("pos", start);

  // Daily TikTok sales, one bucket per local day (zero-filled).
  const rows = db
    .select({ createdAt: sales.createdAt, total: sales.total })
    .from(sales)
    .where(and(eq(sales.channel, "tiktok"), isNull(sales.cancelledAt), gte(sales.createdAt, start.toISOString())))
    .all();
  const buckets = new Map<string, { total: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(localDay(d), { total: 0, orders: 0 });
  }
  for (const r of rows) {
    const b = buckets.get(localDay(new Date(r.createdAt)));
    if (b) {
      b.total += r.total;
      b.orders++;
    }
  }
  const daily = [...buckets].map(([day, v]) => ({ day, total: Math.round(v.total * 100) / 100, orders: v.orders }));

  // Order pipeline: TikTok's own status for orders placed in the period.
  const statusRows = db
    .select({ status: marketplaceOrders.status, n: sql<number>`count(*)` })
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.channel, CHANNEL), gte(marketplaceOrders.orderCreatedAt, start.toISOString())))
    .groupBy(marketplaceOrders.status)
    .all();
  const PIPELINE = [
    ["UNPAID", "Awaiting payment"],
    ["ON_HOLD", "On hold"],
    ["AWAITING_SHIPMENT", "To ship"],
    ["AWAITING_COLLECTION", "Awaiting pickup"],
    ["PARTIALLY_SHIPPING", "Partially shipped"],
    ["IN_TRANSIT", "In transit"],
    ["DELIVERED", "Delivered"],
    ["COMPLETED", "Completed"],
    ["CANCELLED", "Cancelled"],
  ] as const;
  const byStatus = new Map(statusRows.map((r) => [r.status, r.n]));
  const pipeline = PIPELINE.map(([status, label]) => ({ status, label, count: byStatus.get(status) ?? 0 })).filter(
    (p) => p.count > 0 || ["AWAITING_SHIPMENT", "IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(p.status),
  );
  const ordersPlaced = statusRows.reduce((s, r) => s + r.n, 0);
  const cancelled = byStatus.get("CANCELLED") ?? 0;

  const needsAttention = db
    .select()
    .from(marketplaceOrders)
    .where(and(eq(marketplaceOrders.channel, CHANNEL), sql`${marketplaceOrders.problem} <> ''`))
    .orderBy(desc(marketplaceOrders.orderCreatedAt))
    .all();

  // Best sellers on TikTok in the period, by revenue.
  const topProducts = db
    .select({
      productId: saleItems.productId,
      name: saleItems.name,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<number>`round(sum(${saleItems.lineTotal}), 2)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(sales.channel, "tiktok"), isNull(sales.cancelledAt), gte(sales.createdAt, start.toISOString())))
    .groupBy(saleItems.productId, saleItems.name)
    .orderBy(sql`sum(${saleItems.lineTotal}) desc`)
    .limit(8)
    .all();

  // Linked TikTok SKUs that are low or out of stock here (TikTok will soon show them sold out).
  const stockWatch = db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      quantity: products.quantity,
      minStock: products.minStock,
      tiktokQty: marketplaceListings.externalQuantity,
    })
    .from(marketplaceListings)
    .innerJoin(products, eq(products.id, marketplaceListings.productId))
    .where(and(eq(marketplaceListings.channel, CHANNEL), sql`${products.quantity} <= ${products.minStock}`))
    .orderBy(products.quantity)
    .all();

  const listingCounts = db
    .select({
      total: sql<number>`count(*)`,
      unlinked: sql<number>`sum(case when ${marketplaceListings.productId} is null then 1 else 0 end)`,
    })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.channel, CHANNEL))
    .get()!;

  const recentOrders = db
    .select({
      externalOrderId: marketplaceOrders.externalOrderId,
      status: marketplaceOrders.status,
      orderCreatedAt: marketplaceOrders.orderCreatedAt,
      total: marketplaceOrders.total,
      buyerName: marketplaceOrders.buyerName,
      problem: marketplaceOrders.problem,
      saleId: marketplaceOrders.saleId,
      invoiceNumber: sales.invoiceNumber,
    })
    .from(marketplaceOrders)
    .leftJoin(sales, eq(sales.id, marketplaceOrders.saleId))
    .where(eq(marketplaceOrders.channel, CHANNEL))
    .orderBy(desc(marketplaceOrders.orderCreatedAt))
    .limit(8)
    .all();

  return {
    days,
    current,
    previous,
    posTotal: pos.total,
    daily,
    pipeline,
    ordersPlaced,
    cancelled,
    needsAttention,
    topProducts,
    stockWatch,
    listings: { total: listingCounts.total, unlinked: listingCounts.unlinked ?? 0 },
    recentOrders,
  };
}

export type TikTokDashboard = ReturnType<typeof tiktokDashboard>;
