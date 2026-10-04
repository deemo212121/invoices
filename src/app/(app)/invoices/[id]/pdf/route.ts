import { getInvoice } from "@/lib/data";
import { renderInvoicePdf, renderReceiptPdf } from "@/lib/pdf";
import { invoicePaper } from "@/lib/labels";

export async function GET(req: Request, ctx: RouteContext<"/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  const inv = getInvoice(Number(id));
  if (!inv) return new Response("Invoice not found", { status: 404 });

  const url = new URL(req.url);
  const paper = invoicePaper(url.searchParams.get("paper") ?? inv.business.invoicePaper);
  const pdf = paper === "a4" ? await renderInvoicePdf(inv) : await renderReceiptPdf(inv, paper);
  const download = url.searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${inv.sale.invoiceNumber}.pdf"`,
    },
  });
}
