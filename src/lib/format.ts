export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function money(n: number, symbol = "$") {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}${symbol}${s}`;
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export function dateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export type StockStatus = "in" | "low" | "out";

export function stockStatus(p: { quantity: number; minStock: number }): StockStatus {
  if (p.quantity <= 0) return "out";
  if (p.quantity <= p.minStock) return "low";
  return "in";
}

export const STOCK_LABEL: Record<StockStatus, string> = { in: "In stock", low: "Low stock", out: "Out of stock" };

export const MOVEMENT_LABEL: Record<string, string> = {
  in: "Stock in",
  out: "Stock out",
  adjustment: "Adjustment",
  damaged: "Damaged",
  return: "Return",
  sale: "Sale",
};

export const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "E-wallet", "Other"] as const;
