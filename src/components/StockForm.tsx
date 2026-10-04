"use client";

import { useActionState, useState } from "react";
import { recordStockChange } from "@/app/actions/inventory";
import { Field, FormMessage } from "./ui";

const TYPES = [
  { value: "in", label: "Stock in" },
  { value: "out", label: "Stock out" },
  { value: "return", label: "Customer return" },
  { value: "damaged", label: "Damaged" },
  { value: "adjustment", label: "Adjustment (set counted qty)" },
];

type Option = { id: number; name: string; sku: string; quantity: number };

/** Records a manual stock movement. Pass `productId` to fix the product, or `products` to pick one. */
export function StockForm({ productId, products }: { productId?: number; products?: Option[] }) {
  const [state, action, pending] = useActionState(recordStockChange, {});
  const [type, setType] = useState("in");

  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Record stock movement</h2>
      <FormMessage state={state} />
      {productId ? (
        <input type="hidden" name="productId" value={productId} />
      ) : (
        <Field label="Product">
          <select name="productId" required className="input" defaultValue="">
            <option value="" disabled>
              Select a product…
            </option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}) — {p.quantity} in stock
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={type === "adjustment" ? "Counted quantity" : "Quantity"}>
          <input name="quantity" type="number" min="0" step="1" required className="input" />
        </Field>
      </div>
      <Field label={type === "adjustment" ? "Reason *" : "Note"}>
        <input name="note" className="input" placeholder="Supplier, reason, reference…" />
      </Field>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Record"}
      </button>
    </form>
  );
}
