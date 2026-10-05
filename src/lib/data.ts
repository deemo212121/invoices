import { and, desc, eq, gte, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, inventoryMovements, products, saleItems, sales, settings } from "@/db/schema";

export function getSettings() {
  return db.select().from(settings).where(eq(settings.id, 1)).get()!;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export type ProductFilters = {
  q?: string;
  category?: string;
  brand?: string;
  stock?: string; // in | low | out
  archived?: string; // "1" shows archived products instead of active
};

export function listProducts(f: ProductFilters = {}) {
  const where: SQL[] = [eq(products.archived, f.archived === "1")];
  if (f.q) {
    const q = `%${f.q}%`;
    where.push(or(like(products.name, q), like(products.sku, q), like(products.barcode, q))!);
  }
  if (f.category) where.push(eq(products.category, f.category));
  if (f.brand) where.push(eq(products.brand, f.brand));
  if (f.stock === "out") where.push(sql`${products.quantity} <= 0`);
  if (f.stock === "low") where.push(sql`${products.quantity} > 0 and ${products.quantity} <= ${products.minStock}`);
  if (f.stock === "in") where.push(sql`${products.quantity} > ${products.minStock}`);
  return db
    .select()
    .from(products)
    .where(and(...where))
    .orderBy(products.name)
    .all();
}

export function distinctValues(column: typeof products.category | typeof products.brand) {
  return db
    .selectDistinct({ v: column })
    .from(products)
    .where(sql`${column} <> ''`)
    .orderBy(column)
    .all()
    .map((r) => r.v);
}

export function getProduct(id: number) {
  return db.select().from(products).where(eq(products.id, id)).get();
}

function movementWhere(opts: { productId?: number; type?: string }) {
  const where: SQL[] = [];
  if (opts.productId) where.push(eq(inventoryMovements.productId, opts.productId));
  if (opts.type) where.push(eq(inventoryMovements.type, opts.type as (typeof inventoryMovements.type.enumValues)[number]));
  return where.length ? and(...where) : undefined;
}

export function countMovements(opts: { productId?: number; type?: string } = {}) {
  return db.select({ n: sql<number>`count(*)` }).from(inventoryMovements).where(movementWhere(opts)).get()!.n;
}

export function listMovements(opts: { productId?: number; type?: string; limit?: number; offset?: number } = {}) {
  return db
    .select({
      id: inventoryMovements.id,
      type: inventoryMovements.type,
      quantityChange: inventoryMovements.quantityChange,
      quantityAfter: inventoryMovements.quantityAfter,
      note: inventoryMovements.note,
      saleId: inventoryMovements.saleId,
      createdAt: inventoryMovements.createdAt,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      invoiceNumber: sales.invoiceNumber,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(sales, eq(sales.id, inventoryMovements.saleId))
    .where(movementWhere(opts))
    .orderBy(desc(inventoryMovements.id))
    .limit(opts.limit ?? 200)
    .offset(opts.offset ?? 0)
    .all();
}

export function listCustomers(q?: string) {
  const term = q ? `%${q}%` : undefined;
  return db
    .select()
    .from(customers)
    .where(
      term ? or(like(customers.name, term), like(customers.phone, term), like(customers.email, term)) : undefined,
    )
    .orderBy(customers.name)
    .all();
}

/** Order count and total spent per customer (cancelled sales excluded). */
export function customerStats() {
  const rows = db
    .select({
      customerId: sales.customerId,
      orders: sql<number>`count(*)`,
      spent: sql<number>`coalesce(sum(${sales.total}), 0)`,
      last: sql<string>`max(${sales.createdAt})`,
    })
    .from(sales)
    .where(and(isNull(sales.cancelledAt), sql`${sales.customerId} is not null`))
    .groupBy(sales.customerId)
    .all();
  return new Map(rows.map((r) => [r.customerId!, r]));
}

export function getCustomer(id: number) {
  return db.select().from(customers).where(eq(customers.id, id)).get();
}

function salesWhere(opts: { q?: string; customerId?: number }) {
  const where: SQL[] = [];
  if (opts.q) {
    const q = `%${opts.q}%`;
    where.push(or(like(sales.invoiceNumber, q), like(customers.name, q))!);
  }
  if (opts.customerId) where.push(eq(sales.customerId, opts.customerId));
  return where.length ? and(...where) : undefined;
}

export function countSales(opts: { q?: string; customerId?: number } = {}) {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(salesWhere(opts))
    .get()!.n;
}

export function listSales(opts: { q?: string; limit?: number; offset?: number; customerId?: number } = {}) {
  return db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      total: sales.total,
      paymentMethod: sales.paymentMethod,
      createdAt: sales.createdAt,
      channel: sales.channel,
      cancelledAt: sales.cancelledAt,
      customerName: sql<string | null>`coalesce(nullif(${sales.buyerName}, ''), ${customers.name})`,
      itemCount: sql<number>`(select coalesce(sum(${saleItems.quantity}), 0) from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .where(salesWhere(opts))
    .orderBy(desc(sales.id))
    .limit(opts.limit ?? 500)
    .offset(opts.offset ?? 0)
    .all();
}

export function getInvoice(id: number) {
  const sale = db.select().from(sales).where(eq(sales.id, id)).get();
  if (!sale) return undefined;
  const items = db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(saleItems.id).all();
  const customer = sale.customerId ? getCustomer(sale.customerId) : undefined;
  return { sale, items, customer, business: getSettings() };
}

export type Invoice = NonNullable<ReturnType<typeof getInvoice>>;

export function dashboardStats() {
  const today = db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)` })
    .from(sales)
    .where(and(gte(sales.createdAt, startOfToday()), isNull(sales.cancelledAt)))
    .get()!;
  const productCount = db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.archived, false))
    .get()!.n;
  const lowStock = db
    .select()
    .from(products)
    .where(and(eq(products.archived, false), sql`${products.quantity} <= ${products.minStock}`))
    .orderBy(products.quantity)
    .all();
  return { today, productCount, lowStock };
}

export function recentSaleItems(limit = 8) {
  return db
    .select({
      id: saleItems.id,
      saleId: saleItems.saleId,
      name: saleItems.name,
      quantity: saleItems.quantity,
      lineTotal: saleItems.lineTotal,
      createdAt: sales.createdAt,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(isNull(sales.cancelledAt))
    .orderBy(desc(saleItems.id))
    .limit(limit)
    .all();
}

/** Revenue per local day for the last `days` days (all channels, cancellations excluded). */
export function dailyRevenue(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const buckets = new Map<string, { total: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(key(d), { total: 0, orders: 0 });
  }
  const rows = db
    .select({ createdAt: sales.createdAt, total: sales.total })
    .from(sales)
    .where(and(gte(sales.createdAt, start.toISOString()), isNull(sales.cancelledAt)))
    .all();
  for (const r of rows) {
    const b = buckets.get(key(new Date(r.createdAt)));
    if (b) {
      b.total += r.total;
      b.orders++;
    }
  }
  return [...buckets].map(([day, v]) => ({ day, total: Math.round(v.total * 100) / 100, orders: v.orders }));
}
