// Makes an invoice PDF in the browser and opens or downloads it.
import { getInvoice } from "./data";
import { download } from "./download";
import { invoicePaper, type InvoicePaper } from "./labels";

async function render(saleId: number, paper?: InvoicePaper) {
  const inv = getInvoice(saleId);
  if (!inv) throw new Error("Invoice not found");
  const p = invoicePaper(paper ?? inv.business.invoicePaper);
  const { renderInvoicePdf, renderReceiptPdf } = await import("./pdf"); // loaded only when needed
  const bytes = p === "a4" ? await renderInvoicePdf(inv) : await renderReceiptPdf(inv, p);
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), name: `${inv.sale.invoiceNumber}.pdf` };
}

/** Opens the PDF in a new tab. */
export async function openInvoicePdf(saleId: number, paper?: InvoicePaper) {
  // Open the tab right away (still inside the click), or popup blockers stop it.
  const tab = window.open("", "_blank");
  try {
    const { blob } = await render(saleId, paper);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

export async function downloadInvoicePdf(saleId: number, paper?: InvoicePaper) {
  const { blob, name } = await render(saleId, paper);
  download(blob, name);
}
