// What an invoice shows, shared by the web page and the PDF so they always match.
import type { Invoice } from "./data";

export type InvoiceRow = { label: string; amount: number; negative?: boolean; bold?: boolean };

export type InvoiceView = {
  title: string;
  sellerLines: string[];
  buyerLines: string[]; // first line is the name
  totals: InvoiceRow[];
  vatBreakdown: InvoiceRow[] | null;
  notes: string[];
};

export function invoiceView({ sale, customer, business: b }: Invoice): InvoiceView {
  const mode = sale.taxMode;
  const tinLabel = mode === "vat" ? "VAT Reg. TIN" : mode === "nonvat" ? "Non-VAT Reg. TIN" : "TIN";
  const sellerLines = [b.address, b.phone, b.email, b.taxId && `${tinLabel}: ${b.taxId}`].filter(Boolean) as string[];
  if (mode !== "added" && !b.taxId) sellerLines.push(mode === "vat" ? "VAT-registered" : "Non-VAT");

  // Buyer details saved on the sale win; older sales fall back to the customer record.
  const name = sale.buyerName || customer?.name || "";
  const buyerLines = name
    ? [
        name,
        ...[sale.buyerAddress || customer?.address, sale.buyerName ? "" : customer?.phone, sale.buyerTin && `TIN: ${sale.buyerTin}`].filter(
          (x): x is string => !!x,
        ),
      ]
    : ["Walk-in customer"];

  const notes: string[] = [];
  if (sale.channel === "tiktok") notes.push(`TikTok Shop order ${sale.externalOrderId}`);
  if (sale.cancelledAt) notes.push("CANCELLED: this order was cancelled and its stock returned.");
  if (sale.seniorType) {
    notes.push(
      `${sale.seniorType === "senior" ? "Senior citizen" : "PWD"} discount (5% on basic necessities & prime commodities): ` +
        `${sale.seniorName}, ID no. ${sale.seniorIdNumber}`,
    );
  }

  if (mode === "added") {
    // Sales made before VAT mode existed: tax was added on top of prices.
    return {
      title: "INVOICE",
      sellerLines,
      buyerLines,
      totals: [
        { label: "Subtotal", amount: sale.subtotal },
        { label: "Discount", amount: sale.discount, negative: sale.discount > 0 },
        { label: `Tax (${sale.taxRate}%)`, amount: sale.tax },
        { label: "Total", amount: sale.total, bold: true },
      ],
      vatBreakdown: null,
      notes,
    };
  }

  const totals: InvoiceRow[] = [{ label: mode === "vat" ? "Total sales (VAT inclusive)" : "Total sales", amount: sale.subtotal }];
  if (sale.seniorDiscount > 0) {
    totals.push({ label: `Less: ${sale.seniorType === "pwd" ? "PWD" : "Senior"} discount (5%)`, amount: sale.seniorDiscount, negative: true });
  }
  if (sale.discount > 0) totals.push({ label: "Less: Discount", amount: sale.discount, negative: true });
  totals.push({ label: "Total amount due", amount: sale.total, bold: true });

  if (mode === "nonvat") notes.push("This document is not valid for claim of input tax.");

  return {
    title: "SALES INVOICE",
    sellerLines,
    buyerLines,
    totals,
    vatBreakdown:
      mode === "vat"
        ? [
            { label: "VATable sales", amount: sale.vatableSales },
            { label: `VAT (${sale.taxRate}%)`, amount: sale.tax },
            { label: "VAT-exempt sales", amount: sale.vatExemptSales },
            { label: "Zero-rated sales", amount: 0 },
          ]
        : null,
    notes,
  };
}
