import { db } from "@/db";
import type { MovementType } from "@/db/schema";
import { getProduct } from "@/lib/data";
import { applyStockChange } from "@/lib/inventory";
import type { FormState } from "@/lib/form-state";

// Direction of each manual movement type; "adjustment" sets an absolute count instead.
const SIGN: Partial<Record<MovementType, 1 | -1>> = { in: 1, return: 1, out: -1, damaged: -1 };

export async function recordStockChange(_prev: FormState, fd: FormData): Promise<FormState> {
  const productId = Number(fd.get("productId"));
  const type = String(fd.get("type")) as MovementType;
  const qty = Number(fd.get("quantity"));
  const note = String(fd.get("note") ?? "").trim();

  const product = getProduct(productId);
  if (!product) return { error: "Choose a product" };
  if (String(fd.get("quantity") ?? "") === "" || !Number.isInteger(qty) || qty < 0) {
    return { error: "Quantity must be a whole number of 0 or more" };
  }

  let change: number;
  if (type === "adjustment") {
    // Adjustments take the counted quantity; the movement stores the difference.
    change = qty - product.quantity;
    if (change === 0) return { error: `Stock is already ${qty}` };
    if (!note) return { error: "Add a note explaining the adjustment" };
  } else if (SIGN[type]) {
    if (qty === 0) return { error: "Quantity must be at least 1" };
    change = qty * SIGN[type];
  } else {
    return { error: "Unknown movement type" };
  }

  try {
    const { after } = db.transaction((tx) => applyStockChange(tx, { productId, type, change, note }));
    return { ok: `${product.name}: stock is now ${after}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
