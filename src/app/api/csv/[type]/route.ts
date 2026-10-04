import { and, asc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { customers, products, saleItems, sales } from "@/db/schema";
import { csvResponse, localDateStamp, localDateTime, toCsv } from "@/lib/csv";
import { CUSTOMER_TEMPLATE, PRODUCT_TEMPLATE } from "@/lib/csv-import";

// GET /api/csv/products | customers | sales | sale-items
//   ?template=1             header row only (products, customers)
//   ?from=YYYY-MM-DD&to=…   date range, inclusive (sales, sale-items)
export async function GET(req: Request, ctx: RouteContext<"/api/csv/[type]">) {
  const { type } = await ctx.params;
  const url = new URL(req.url);
  const stamp = localDateStamp();

  if (url.searchParams.has("template")) {
    if (type === "products") return csvResponse(toCsv(PRODUCT_TEMPLATE, []), "products-template.csv");
    if (type === "customers") return csvResponse(toCsv(CUSTOMER_TEMPLATE, []), "customers-template.csv");
    return new Response("Not found", { status: 404 });
  }

  if (type === "products") {
    const rows = db.select().from(products).orderBy(asc(products.name)).all();
    const csv = toCsv(
      [...PRODUCT_TEMPLATE, "archived", "created_at", "updated_at"],
      rows.map((p) => [
        p.sku,
        p.barcode,
        p.name,
        p.description,
        p.category,
        p.brand,
        p.costPrice,
        p.sellingPrice,
        p.quantity,
        p.minStock,
        p.vatExempt ? "yes" : "no",
        p.seniorEligible ? "yes" : "no",
        p.archived ? "yes" : "no",
        localDateTime(p.createdAt),
        localDateTime(p.updatedAt),
      ]),
    );
    return csvResponse(csv, `products-${stamp}.csv`);
  }

  if (type === "customers") {
    const rows = db.select().from(customers).orderBy(asc(customers.name)).all();
    const csv = toCsv(
      [...CUSTOMER_TEMPLATE, "created_at"],
      rows.map((c) => [c.name, c.phone, c.email, c.address, c.tin, c.notes, localDateTime(c.createdAt)]),
    );
    return csvResponse(csv, `customers-${stamp}.csv`);
  }

  if (type === "sales" || type === "sale-items") {
    const where: SQL[] = [];
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    // Dates are local calendar days; stored timestamps are UTC ISO strings.
    if (from) where.push(gte(sales.createdAt, new Date(`${from}T00:00:00`).toISOString()));
    if (to) {
      const end = new Date(`${to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      where.push(lt(sales.createdAt, end.toISOString()));
    }
    const range = from || to ? `-${from ?? "start"}-to-${to ?? stamp}` : `-${stamp}`;

    if (type === "sales") {
      const rows = db
        .select({
          s: sales,
          customer: customers.name,
          items: sql<number>`(select coalesce(sum(${saleItems.quantity}), 0) from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
        })
        .from(sales)
        .leftJoin(customers, eq(customers.id, sales.customerId))
        .where(where.length ? and(...where) : undefined)
        .orderBy(asc(sales.id))
        .all();
      const csv = toCsv(
        ["invoice_number", "date", "customer", "buyer_tin", "items", "tax_mode", "subtotal", "senior_pwd_discount",
          "senior_pwd_id", "discount", "total", "vatable_sales", "vat", "vat_exempt_sales", "tax_added",
          "payment_method", "amount_paid", "change", "channel", "marketplace_order_id", "status"],
        rows.map(({ s, customer, items }) => {
          // "added" = sales made before VAT mode, where tax was added on top of prices.
          const added = s.taxMode === "added";
          return [
            s.invoiceNumber, localDateTime(s.createdAt), s.buyerName || customer || "Walk-in", s.buyerTin, items,
            { vat: "VAT", nonvat: "Non-VAT", added: "Tax added (old)" }[s.taxMode], s.subtotal, s.seniorDiscount,
            s.seniorIdNumber, s.discount, s.total, added ? 0 : s.vatableSales, added ? 0 : s.tax, s.vatExemptSales,
            added ? s.tax : 0, s.paymentMethod, s.amountPaid, s.change, s.channel === "tiktok" ? "TikTok" : "POS",
            s.externalOrderId, s.cancelledAt ? "cancelled" : "completed",
          ];
        }),
      );
      return csvResponse(csv, `sales${range}.csv`);
    }

    const rows = db
      .select({ i: saleItems, s: sales, customer: customers.name })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(saleItems.id))
      .all();
    const csv = toCsv(
      ["invoice_number", "date", "customer", "sku", "product", "quantity", "unit_price", "line_total", "payment_method"],
      rows.map(({ i, s, customer }) => [
        s.invoiceNumber, localDateTime(s.createdAt), customer ?? "Walk-in", i.sku, i.name, i.quantity, i.unitPrice, i.lineTotal,
        s.paymentMethod,
      ]),
    );
    return csvResponse(csv, `sale-items${range}.csv`);
  }

  return new Response("Not found", { status: 404 });
}
