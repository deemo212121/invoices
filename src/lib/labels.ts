// Barcode label stock and barcode helpers (shared by the server and the label page).

export type LabelFormat = {
  id: string;
  name: string;
  kind: "sheet" | "thermal";
  width: number; // label size, mm
  height: number;
  cols?: number; // sheets only
  rows?: number;
  marginTop?: number; // sheet margins, mm
  marginLeft?: number;
};

export const LABEL_FORMATS: LabelFormat[] = [
  { id: "a4-3x8", name: "A4 sheet · 24 labels (70×37 mm)", kind: "sheet", width: 70, height: 37, cols: 3, rows: 8, marginTop: 0.5, marginLeft: 0 },
  { id: "a4-4x10", name: "A4 sheet · 40 labels (52.5×29.7 mm)", kind: "sheet", width: 52.5, height: 29.7, cols: 4, rows: 10, marginTop: 0, marginLeft: 0 },
  { id: "thermal-50x30", name: "Thermal label · 50×30 mm", kind: "thermal", width: 50, height: 30 },
  { id: "thermal-40x30", name: "Thermal label · 40×30 mm", kind: "thermal", width: 40, height: 30 },
];

export const labelFormat = (id: string) => LABEL_FORMATS.find((f) => f.id === id) ?? LABEL_FORMATS[0];

export const INVOICE_PAPERS = [
  { id: "a4", name: "A4" },
  { id: "80mm", name: "80mm" },
  { id: "58mm", name: "58mm" },
] as const;
export type InvoicePaper = (typeof INVOICE_PAPERS)[number]["id"];
export const invoicePaper = (v: string | undefined): InvoicePaper =>
  (INVOICE_PAPERS.find((p) => p.id === v)?.id ?? "a4") as InvoicePaper;

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string) {
  const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export const isEan13 = (v: string) => /^\d{13}$/.test(v) && ean13CheckDigit(v.slice(0, 12)) === v[12];

/**
 * In-store barcode for a product without one. EAN-13 numbers starting with "2" are reserved for
 * a store's own use, so they never clash with manufacturers' barcodes: 20 + 10-digit id + check digit.
 */
export function inStoreBarcode(productId: number) {
  const first12 = `20${String(productId).padStart(10, "0")}`;
  return first12 + ean13CheckDigit(first12);
}
