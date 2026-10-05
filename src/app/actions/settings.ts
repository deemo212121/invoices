import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import type { FormState } from "@/lib/form-state";
import { INVOICE_PAPERS, LABEL_FORMATS } from "@/lib/labels";

export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  if (!get("businessName")) return { error: "Business name is required" };

  db.update(settings)
    .set({
      businessName: get("businessName"),
      address: get("address"),
      phone: get("phone"),
      email: get("email"),
      taxId: get("taxId"),
      vatRegistered: get("vatRegistered") === "1",
      currencySymbol: get("currencySymbol") || "₱",
      invoiceFooter: get("invoiceFooter"),
      ...(INVOICE_PAPERS.some((p) => p.id === get("invoicePaper")) ? { invoicePaper: get("invoicePaper") } : {}),
      ...(LABEL_FORMATS.some((f) => f.id === get("labelFormat")) ? { labelFormat: get("labelFormat") } : {}),
    })
    .where(eq(settings.id, 1))
    .run();
  return { ok: "Settings saved" };
}

/** Remembers the chosen invoice paper / label stock (used as the default next time). */
export async function savePrintPreference(key: "invoicePaper" | "labelFormat", value: string) {
  const allowed = key === "invoicePaper" ? INVOICE_PAPERS.map((p) => p.id as string) : LABEL_FORMATS.map((f) => f.id);
  if (!allowed.includes(value)) throw new Error("Unknown option");
  db.update(settings).set({ [key]: value }).where(eq(settings.id, 1)).run();
}
