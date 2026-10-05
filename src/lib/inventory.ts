import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryMovements, products, type MovementType } from "@/db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const nowSql = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/**
 * The only place product quantities change. Applies a signed quantity change
 * and records an inventory movement. Must be called inside a transaction.
 */
export function applyStockChange(
  tx: Tx,
  input: { productId: number; type: MovementType; change: number; note?: string; saleId?: number },
) {
  const product = tx.select().from(products).where(eq(products.id, input.productId)).get();
  if (!product) throw new Error("Product not found");
  const after = product.quantity + input.change;
  if (after < 0) {
    throw new Error(`Not enough stock for ${product.name} (have ${product.quantity}, need ${-input.change})`);
  }
  tx.update(products).set({ quantity: after, updatedAt: nowSql }).where(eq(products.id, product.id)).run();
  tx.insert(inventoryMovements)
    .values({
      productId: product.id,
      type: input.type,
      quantityChange: input.change,
      quantityAfter: after,
      note: input.note ?? "",
      saleId: input.saleId,
    })
    .run();
  return { product, after };
}
