import "server-only";
import PDFDocument from "pdfkit";
import type { Invoice } from "./data";
import { dateTime } from "./format";
import { invoiceView, type InvoiceRow } from "./invoice-view";

// The built-in PDF fonts only cover Latin-1 (plus €), so other symbols become their currency code.
const SYMBOL_CODE: Record<string, string> = { "₱": "PHP ", "₹": "INR ", "₩": "KRW ", "₫": "VND ", "฿": "THB ", "₦": "NGN " };

function pdfMoney(n: number, symbol: string) {
  const sym = /^[\x20-\xFF€]*$/.test(symbol) ? symbol : (SYMBOL_CODE[symbol.trim()] ?? "");
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${sym}${s}`;
}

export function renderInvoicePdf(inv: Invoice): Promise<Buffer> {
  const { sale, items, business: b } = inv;
  const view = invoiceView(inv);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const fmt = (n: number) => pdfMoney(n, b.currencySymbol);
  const left = 50;
  const right = doc.page.width - 50;
  const width = right - left;
  const grey = "#64748b";

  // Header: business on the left, invoice details on the right.
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#000").text(b.businessName, left, 50, { width: width / 2 });
  doc.font("Helvetica").fontSize(9).fillColor(grey);
  for (const line of view.sellerLines) {
    doc.text(line, { width: width / 2 });
  }
  const afterBusiness = doc.y;

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#94a3b8").text(view.title, left, 50, { width, align: "right" });
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text(sale.invoiceNumber, { width, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(grey).text(dateTime(sale.createdAt), { width, align: "right" });

  let y = Math.max(afterBusiness, doc.y) + 20;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();

  // Bill to
  y += 15;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(grey).text("SOLD TO", left, y);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text(view.buyerLines[0]).font("Helvetica");
  for (const line of view.buyerLines.slice(1)) doc.text(line);

  // Items table
  const cols = { item: left, qty: left + width * 0.55, price: left + width * 0.7, amount: left + width * 0.85 };
  const colW = width * 0.15;
  y = doc.y + 20;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(grey);
  doc.text("ITEM", cols.item, y);
  doc.text("QTY", cols.qty, y, { width: colW, align: "right" });
  doc.text("PRICE", cols.price, y, { width: colW, align: "right" });
  doc.text("AMOUNT", cols.amount, y, { width: colW, align: "right" });
  y += 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#e2e8f0").stroke();
  y += 6;

  doc.font("Helvetica").fontSize(10).fillColor("#000");
  for (const i of items) {
    const nameH = doc.heightOfString(i.name, { width: width * 0.53 });
    const rowH = nameH + 14;
    if (y + rowH > doc.page.height - 150) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor("#000").text(i.name, cols.item, y, { width: width * 0.53 });
    doc.fontSize(8).fillColor(grey).text(i.sku, cols.item, y + nameH, { width: width * 0.53 });
    doc.fontSize(10).fillColor("#000");
    doc.text(String(i.quantity), cols.qty, y, { width: colW, align: "right" });
    doc.text(fmt(i.unitPrice), cols.price, y, { width: colW, align: "right" });
    doc.text(fmt(i.lineTotal), cols.amount, y, { width: colW, align: "right" });
    y += rowH;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor("#f1f5f9").stroke();
  }

  // Totals on the right, VAT breakdown on the left.
  y += 10;
  const top = y;
  const labelX = left + width * 0.5;
  const amount = (r: InvoiceRow) => (r.negative ? `-${fmt(r.amount)}` : fmt(r.amount));
  const totalsRow = (r: InvoiceRow) => {
    if (r.bold) {
      doc.moveTo(labelX, y).lineTo(right, y).strokeColor("#cbd5e1").stroke();
      y += 6;
    }
    doc.font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(r.bold ? 12 : 10).fillColor(r.bold ? "#000" : grey);
    doc.text(r.label, labelX, y, { width: width * 0.3 });
    doc.fillColor("#000").text(amount(r), cols.amount - colW, y, { width: colW * 2, align: "right" });
    y += r.bold ? 20 : 15;
  };
  view.totals.forEach(totalsRow);
  totalsRow({ label: `Paid (${sale.paymentMethod})`, amount: sale.amountPaid });
  totalsRow({ label: "Change", amount: sale.change });

  if (view.vatBreakdown) {
    const boxW = width * 0.4;
    const boxH = view.vatBreakdown.length * 14 + 12;
    doc.roundedRect(left, top, boxW, boxH, 3).strokeColor("#e2e8f0").stroke();
    let by = top + 7;
    for (const r of view.vatBreakdown) {
      doc.font("Helvetica").fontSize(9).fillColor(grey).text(r.label, left + 8, by, { width: boxW * 0.55 });
      doc.fillColor("#000").text(amount(r), left + 8, by, { width: boxW - 16, align: "right" });
      by += 14;
    }
    y = Math.max(y, top + boxH + 10);
  }

  if (view.notes.length) {
    y += 10;
    doc.font("Helvetica").fontSize(8).fillColor(grey);
    for (const n of view.notes) {
      doc.text(n, left, y, { width });
      y = doc.y + 3;
    }
  }

  if (b.invoiceFooter) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(grey)
      .text(b.invoiceFooter, left, Math.max(y + 30, doc.page.height - 90), { width, align: "center" });
  }

  doc.end();
  return done;
}

// ---------- thermal receipt (80mm / 58mm roll) ----------

const MM = 72 / 25.4;

function drawReceipt(doc: PDFKit.PDFDocument, inv: Invoice, width: number) {
  const { sale, items, business: b } = inv;
  const view = invoiceView(inv);
  const fmt = (n: number) => pdfMoney(n, b.currencySymbol);
  const m = 3 * MM;
  const w = width - m * 2;
  const size = width < 70 * MM ? 7 : 8.5;
  let y = m;
  const text = (t: string, opts: { bold?: boolean; align?: "left" | "center" | "right"; scale?: number } = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size * (opts.scale ?? 1));
    doc.text(t, m, y, { width: w, align: opts.align ?? "left" });
    y = doc.y + 1;
  };
  const pair = (l: string, r: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? size * 1.15 : size);
    // The label column is only as wide as its text, so short labels leave room for the value.
    const lw = Math.min(doc.widthOfString(l) + 6, w * 0.62);
    const rw = w - lw;
    const h = Math.max(doc.heightOfString(l, { width: lw }), doc.heightOfString(r, { width: rw }));
    doc.text(l, m, y, { width: lw });
    doc.text(r, m + lw, y, { width: rw, align: "right" });
    y += h + 1;
  };
  const rule = () => {
    y += 2;
    doc.save().moveTo(m, y).lineTo(m + w, y).dash(1.5, { space: 1.5 }).strokeColor("#888").lineWidth(0.5).stroke().restore();
    y += 4;
  };

  doc.fillColor("#000");
  text(b.businessName, { bold: true, align: "center", scale: 1.3 });
  for (const l of view.sellerLines) text(l, { align: "center" });
  rule();
  text(view.title, { bold: true, align: "center" });
  pair("No.", sale.invoiceNumber);
  pair("Date", dateTime(sale.createdAt));
  pair("Sold to", view.buyerLines.join(", "));
  rule();
  for (const i of items) {
    text(i.name, { bold: true });
    pair(`${i.quantity} x ${fmt(i.unitPrice)}`, fmt(i.lineTotal));
  }
  rule();
  for (const r of view.totals) pair(r.label, r.negative ? `-${fmt(r.amount)}` : fmt(r.amount), r.bold);
  pair(`Paid (${sale.paymentMethod})`, fmt(sale.amountPaid));
  pair("Change", fmt(sale.change));
  if (view.vatBreakdown) {
    rule();
    for (const r of view.vatBreakdown) pair(r.label, fmt(r.amount));
  }
  if (view.notes.length) {
    rule();
    for (const n of view.notes) text(n, { scale: 0.92 });
  }
  if (b.invoiceFooter) {
    rule();
    text(b.invoiceFooter, { align: "center" });
  }
  return y + m;
}

/** Receipt PDF sized to the roll width, and exactly as long as its content. */
export function renderReceiptPdf(inv: Invoice, paper: "80mm" | "58mm"): Promise<Buffer> {
  const width = (paper === "58mm" ? 58 : 80) * MM;
  // First pass on a scratch page to measure the height.
  const scratch = new PDFDocument({ size: [width, 5000], margin: 0 });
  const height = drawReceipt(scratch, inv, width);
  scratch.end();

  const doc = new PDFDocument({ size: [width, Math.ceil(height)], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  drawReceipt(doc, inv, width);
  doc.end();
  return done;
}
