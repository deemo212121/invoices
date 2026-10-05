import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, products, saleItems, sales, settings } from "@/db/schema";
import { applyStockChange, type Tx } from "@/lib/inventory";
import { nextInvoiceNumber } from "@/lib/sales";
import { PAYMENT_METHODS, round2 } from "@/lib/format";
import { computeSale, normalizeId, startOfWeek, VAT_RATE } from "@/lib/tax";

export type CompleteSaleInput = {
  items: { productId: number; quantity: number }[];
  customerId: number | null;
  discountType: "amount" | "percent";
  discountValue: number;
  paymentMethod: string;
  amountPaid: number;
  senior: { type: "senior" | "pwd"; name: string; idNumber: string } | null;
  buyer: { name: string; address: string; tin: string };
};

function seniorUsage(tx: Pick<Tx, "select">, idNumber: string) {
  return tx
    .select({ used: sql<number>`coalesce(sum(${sales.seniorEligible}), 0)` })
    .from(sales)
    .where(and(eq(sales.seniorIdNumber, idNumber), gte(sales.createdAt, startOfWeek().toISOString()), isNull(sales.cancelledAt)))
    .get()!.used;
}

/** Eligible purchases already counted this week for a senior citizen / PWD ID. */
export async function getSeniorWeeklyUsage(idNumber: string) {
  const id = normalizeId(idNumber);
  return id ? seniorUsage(db, id) : 0;
}

export async function completeSale(
  input: CompleteSaleInput,
): Promise<{ ok: true; saleId: number } | { ok: false; error: string }> {
  try {
    const lines = input.items.filter((i) => i.quantity > 0);
    if (!lines.length) throw new Error("Cart is empty");
    if (lines.some((i) => !Number.isInteger(i.quantity))) throw new Error("Quantities must be whole numbers");
    if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) throw new Error("Choose a payment method");
    if (!(input.discountValue >= 0)) throw new Error("Discount cannot be negative");
    if (!(input.amountPaid >= 0)) throw new Error("Enter the amount paid");
    const senior = input.senior
      ? { ...input.senior, name: input.senior.name.trim(), idNumber: normalizeId(input.senior.idNumber) }
      : null;
    if (senior && (!senior.name || !senior.idNumber)) {
      throw new Error("Enter the senior citizen / PWD name and ID number");
    }

    const saleId = db.transaction((tx) => {
      if (input.customerId && !tx.select().from(customers).where(eq(customers.id, input.customerId)).get()) {
        throw new Error("Customer not found");
      }
      const { vatRegistered } = tx.select().from(settings).where(eq(settings.id, 1)).get()!;
      // Prices and tax flags always come from the database, never from the browser.
      const rows = tx
        .select()
        .from(products)
        .where(inArray(products.id, lines.map((l) => l.productId)))
        .all();
      const byId = new Map(rows.map((r) => [r.id, r]));
      const priced = lines.map((l) => {
        const p = byId.get(l.productId);
        if (!p || p.archived) throw new Error("A product in the cart is no longer available");
        return { p, quantity: l.quantity };
      });

      const t = computeSale({
        lines: priced.map(({ p, quantity }) => ({
          price: p.sellingPrice,
          quantity,
          vatExempt: p.vatExempt,
          seniorEligible: p.seniorEligible,
        })),
        vatRegistered,
        discountType: input.discountType,
        discountValue: input.discountValue,
        senior: !!senior,
        seniorUsedThisWeek: senior ? seniorUsage(tx, senior.idNumber) : 0,
      });
      if (senior && t.seniorEligible === 0) {
        throw new Error("No senior/PWD discount applies: no eligible items, or this week's ₱2,500 limit is used up");
      }
      const amountPaid = round2(input.amountPaid);
      if (amountPaid < t.total) throw new Error("Amount paid is less than the total");

      const sale = tx
        .insert(sales)
        .values({
          invoiceNumber: nextInvoiceNumber(tx),
          customerId: input.customerId,
          subtotal: t.subtotal,
          discount: t.discount,
          taxMode: vatRegistered ? "vat" : "nonvat",
          taxRate: vatRegistered ? VAT_RATE : 0,
          tax: t.vat,
          vatableSales: t.vatableSales,
          vatExemptSales: t.vatExemptSales,
          seniorDiscount: t.seniorDiscount,
          seniorEligible: t.seniorEligible,
          seniorType: senior?.type ?? null,
          seniorName: senior?.name ?? "",
          seniorIdNumber: senior?.idNumber ?? "",
          buyerName: input.buyer.name.trim(),
          buyerAddress: input.buyer.address.trim(),
          buyerTin: input.buyer.tin.trim(),
          total: t.total,
          paymentMethod: input.paymentMethod,
          amountPaid,
          change: round2(amountPaid - t.total),
        })
        .returning({ id: sales.id, invoiceNumber: sales.invoiceNumber })
        .get();

      for (const { p, quantity } of priced) {
        tx.insert(saleItems)
          .values({
            saleId: sale.id,
            productId: p.id,
            name: p.name,
            sku: p.sku,
            quantity,
            unitPrice: p.sellingPrice,
            lineTotal: round2(p.sellingPrice * quantity),
          })
          .run();
        applyStockChange(tx, { productId: p.id, type: "sale", change: -quantity, note: sale.invoiceNumber, saleId: sale.id });
      }
      return sale.id;
    });

    return { ok: true, saleId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
