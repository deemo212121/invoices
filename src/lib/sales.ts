import { desc, like } from "drizzle-orm";
import { sales } from "@/db/schema";
import type { Tx } from "./inventory";

/** INV-<year>-<6-digit sequence>, restarting each year. Shared by POS and marketplace sales. */
export function nextInvoiceNumber(tx: Tx) {
  const prefix = `INV-${new Date().getFullYear()}-`;
  const last = tx
    .select({ n: sales.invoiceNumber })
    .from(sales)
    .where(like(sales.invoiceNumber, `${prefix}%`))
    .orderBy(desc(sales.invoiceNumber))
    .limit(1)
    .get();
  const seq = last ? Number(last.n.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(6, "0");
}
