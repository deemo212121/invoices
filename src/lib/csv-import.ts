import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, products, type Customer, type Product } from "@/db/schema";
import { parseCsv } from "./csv";
import { applyStockChange, nowSql } from "./inventory";

export const PRODUCT_TEMPLATE = [
  "sku", "barcode", "name", "description", "category", "brand", "cost_price", "selling_price", "quantity", "min_stock",
  "vat_exempt", "senior_pwd_eligible",
];
export const CUSTOMER_TEMPLATE = ["name", "phone", "email", "address", "tin", "notes"];

const MAX_ROWS = 10_000;

const FIELD_LABEL: Record<string, string> = {
  sku: "SKU", barcode: "Barcode", name: "Name", description: "Description", category: "Category", brand: "Brand",
  costPrice: "Cost price", sellingPrice: "Selling price", minStock: "Minimum stock", archived: "Archived",
  vatExempt: "VAT-exempt", seniorEligible: "Senior/PWD eligible", tin: "TIN",
  phone: "Phone", email: "Email", address: "Address", notes: "Notes",
};

const show = (v: unknown) => (v === true ? "yes" : v === false ? "no" : String(v ?? ""));

export type ImportKind = "products" | "customers";

export type PreviewRow = {
  line: number;
  action: "create" | "update" | "unchanged" | "error";
  label: string;
  changes: string[];
  errors: string[];
};

export type Preview = {
  rows: PreviewRow[];
  counts: Record<PreviewRow["action"], number>;
  columns: string[]; // recognised columns
  ignored: string[]; // columns that will not be imported
};

// Accepted header spellings (after normalizeHeader) for each field.
const PRODUCT_ALIASES = {
  sku: ["sku", "itemcode", "code"],
  barcode: ["barcode", "upc", "ean"],
  name: ["name", "productname", "product", "item"],
  description: ["description"],
  category: ["category"],
  brand: ["brand"],
  costPrice: ["costprice", "cost"],
  sellingPrice: ["sellingprice", "price", "saleprice", "unitprice"],
  quantity: ["quantity", "qty", "stock"],
  minStock: ["minstock", "minimumstock", "reorderlevel"],
  archived: ["archived"],
  vatExempt: ["vatexempt", "exempt"],
  seniorEligible: ["seniorpwdeligible", "senioreligible", "bnpc"],
} as const;

const CUSTOMER_ALIASES = {
  name: ["name", "customername", "customer", "fullname"],
  phone: ["phone", "phonenumber", "mobile", "contact"],
  email: ["email", "emailaddress"],
  address: ["address"],
  tin: ["tin", "tinno", "tinnumber", "taxid"],
  notes: ["notes", "note"],
} as const;

/** Maps each field to the CSV column it comes from, if present. */
function resolveColumns<K extends string>(headers: string[], aliases: Record<K, readonly string[]>) {
  const map = {} as Partial<Record<K, string>>;
  for (const field of Object.keys(aliases) as K[]) {
    const col = aliases[field].find((a) => headers.includes(a));
    if (col) map[field] = col;
  }
  const used = new Set(Object.values(map));
  return { map, ignored: headers.filter((h) => h && !used.has(h)) };
}

function parseMoney(v: string) {
  const n = Number(v.replace(/[\s,$₱€£]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function parseCount(v: string) {
  const n = Number(v.replace(/[\s,]/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function parseBool(v: string) {
  const s = v.toLowerCase();
  if (["yes", "y", "true", "1"].includes(s)) return true;
  if (["no", "n", "false", "0"].includes(s)) return false;
  return null;
}

function counts(rows: PreviewRow[]) {
  const c = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const r of rows) c[r.action]++;
  return c;
}

// ---------- products ----------

type ProductFields = Partial<Omit<Product, "id" | "imagePath" | "createdAt" | "updatedAt">>;
type ProductOp = PreviewRow & { existing?: Product; fields: ProductFields };

function planProducts(text: string) {
  const csv = parseCsv(text);
  if (csv.rows.length > MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS}).`);
  const { map, ignored } = resolveColumns(csv.headers, PRODUCT_ALIASES);
  if (!map.sku) throw new Error('A "sku" column is required. Download the template to see the expected columns.');

  const bySku = new Map(db.select().from(products).all().map((p) => [p.sku, p]));
  const seen = new Set<string>();

  const ops: ProductOp[] = csv.rows.map(({ line, values }) => {
    const get = (f: keyof typeof PRODUCT_ALIASES) => (map[f] ? values[map[f]!] : "");
    const sku = get("sku");
    const errors: string[] = [];
    const fields: ProductFields = {};

    // Blank cells are skipped: they keep the current value (or the default for new products).
    for (const f of ["name", "barcode", "description", "category", "brand"] as const) {
      if (get(f)) fields[f] = get(f);
    }
    for (const [f, label] of [["costPrice", "Cost price"], ["sellingPrice", "Selling price"]] as const) {
      if (!get(f)) continue;
      const n = parseMoney(get(f));
      if (n === null) errors.push(`${label} "${get(f)}" is not a valid amount`);
      else fields[f] = n;
    }
    for (const [f, label] of [["quantity", "Quantity"], ["minStock", "Minimum stock"]] as const) {
      if (!get(f)) continue;
      const n = parseCount(get(f));
      if (n === null) errors.push(`${label} "${get(f)}" must be a whole number of 0 or more`);
      else fields[f] = n;
    }
    for (const [f, label] of [["archived", "Archived"], ["vatExempt", "VAT-exempt"], ["seniorEligible", "Senior/PWD eligible"]] as const) {
      if (!get(f)) continue;
      const b = parseBool(get(f));
      if (b === null) errors.push(`${label} "${get(f)}" should be yes or no`);
      else fields[f] = b;
    }

    if (!sku) errors.push("SKU is missing");
    else if (seen.has(sku)) errors.push(`SKU ${sku} appears more than once in the file`);
    if (sku) {
      seen.add(sku);
      fields.sku = sku;
    }

    const existing = sku ? bySku.get(sku) : undefined;
    if (!existing && !fields.name) errors.push("Name is required for a new product");
    const label = `${sku || "—"} · ${fields.name ?? existing?.name ?? ""}`;
    if (errors.length) return { line, action: "error", label, changes: [], errors, fields };

    if (!existing) {
      const changes = [`New product${fields.quantity ? `, opening stock ${fields.quantity}` : ""}`];
      return { line, action: "create", label, changes, errors, fields };
    }
    const changes: string[] = [];
    for (const [k, v] of Object.entries(fields) as [keyof ProductFields, unknown][]) {
      const before = existing[k];
      if (before === v) continue;
      if (k === "quantity") changes.push(`Stock ${before} → ${v} (adjustment)`);
      else changes.push(`${FIELD_LABEL[k]}: "${show(before)}" → "${show(v)}"`);
    }
    return { line, action: changes.length ? "update" : "unchanged", label, changes, errors, fields, existing };
  });

  const preview: Preview = { rows: ops.map(toPreviewRow), counts: counts(ops), columns: Object.values(map), ignored };
  return { ops, preview };
}

function applyProducts(text: string) {
  return db.transaction((tx) => {
    // Plan inside the transaction so it reflects the data being written to.
    const { ops, preview } = planProducts(text);
    for (const op of ops) {
      if (op.action === "create") {
        const { quantity = 0, ...rest } = op.fields;
        const { id } = tx
          .insert(products)
          .values({ ...rest, sku: rest.sku!, name: rest.name!, quantity: 0 })
          .returning({ id: products.id })
          .get();
        if (quantity > 0) applyStockChange(tx, { productId: id, type: "in", change: quantity, note: "CSV import" });
      } else if (op.action === "update" && op.existing) {
        const { quantity, ...rest } = op.fields;
        tx.update(products).set({ ...rest, updatedAt: nowSql }).where(eq(products.id, op.existing.id)).run();
        if (quantity !== undefined && quantity !== op.existing.quantity) {
          applyStockChange(tx, {
            productId: op.existing.id,
            type: "adjustment",
            change: quantity - op.existing.quantity,
            note: "CSV import",
          });
        }
      }
    }
    return preview;
  });
}

// ---------- customers ----------

type CustomerFields = Partial<Pick<Customer, "name" | "phone" | "email" | "address" | "tin" | "notes">>;
type CustomerOp = PreviewRow & { existing?: Customer; fields: CustomerFields };

const digits = (s: string) => s.replace(/\D/g, "");

function planCustomers(text: string) {
  const csv = parseCsv(text);
  if (csv.rows.length > MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS}).`);
  const { map, ignored } = resolveColumns(csv.headers, CUSTOMER_ALIASES);
  if (!map.name) throw new Error('A "name" column is required. Download the template to see the expected columns.');

  // Existing customers are matched by email, then by phone number.
  const all = db.select().from(customers).all();
  const byEmail = new Map(all.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c]));
  const byPhone = new Map(all.filter((c) => digits(c.phone).length >= 6).map((c) => [digits(c.phone), c]));
  const seen = new Set<string>();

  const ops: CustomerOp[] = csv.rows.map(({ line, values }) => {
    const fields: CustomerFields = {};
    for (const f of Object.keys(CUSTOMER_ALIASES) as (keyof CustomerFields)[]) {
      const v = map[f] ? values[map[f]!] : "";
      if (v) fields[f] = v;
    }
    const errors: string[] = [];
    if (!fields.name) errors.push("Name is missing");
    if (fields.email && !/^\S+@\S+\.\S+$/.test(fields.email)) errors.push(`Email "${fields.email}" looks invalid`);

    const emailKey = fields.email?.toLowerCase();
    const phoneKey = fields.phone && digits(fields.phone).length >= 6 ? digits(fields.phone) : undefined;
    for (const key of [emailKey && `e:${emailKey}`, phoneKey && `p:${phoneKey}`]) {
      if (!key) continue;
      if (seen.has(key)) errors.push(`Same ${key.startsWith("e:") ? "email" : "phone"} appears more than once in the file`);
      seen.add(key);
    }

    const existing = (emailKey && byEmail.get(emailKey)) || (phoneKey && byPhone.get(phoneKey)) || undefined;
    // Same email in different case, or same number formatted differently, is not a change.
    if (existing && fields.email?.toLowerCase() === existing.email.toLowerCase()) delete fields.email;
    if (existing && fields.phone && digits(fields.phone) === digits(existing.phone)) delete fields.phone;
    const label = fields.name ?? existing?.name ?? "—";
    if (errors.length) return { line, action: "error", label, changes: [], errors, fields };
    if (!existing) return { line, action: "create", label, changes: ["New customer"], errors, fields };

    const changes = (Object.entries(fields) as [keyof CustomerFields, string][])
      .filter(([k, v]) => existing[k] !== v)
      .map(([k, v]) => `${FIELD_LABEL[k]}: "${existing[k]}" → "${v}"`);
    return {
      line,
      action: changes.length ? "update" : "unchanged",
      label: `${label} (matches existing)`,
      changes,
      errors,
      fields,
      existing,
    };
  });

  const preview: Preview = { rows: ops.map(toPreviewRow), counts: counts(ops), columns: Object.values(map), ignored };
  return { ops, preview };
}

function applyCustomers(text: string) {
  return db.transaction((tx) => {
    const { ops, preview } = planCustomers(text);
    for (const op of ops) {
      if (op.action === "create") tx.insert(customers).values({ ...op.fields, name: op.fields.name! }).run();
      else if (op.action === "update" && op.existing) {
        tx.update(customers).set(op.fields).where(eq(customers.id, op.existing.id)).run();
      }
    }
    return preview;
  });
}

function toPreviewRow({ line, action, label, changes, errors }: PreviewRow): PreviewRow {
  return { line, action, label, changes, errors };
}

// ---------- public ----------

export function previewImport(kind: ImportKind, text: string): Preview {
  return kind === "products" ? planProducts(text).preview : planCustomers(text).preview;
}

export function runImport(kind: ImportKind, text: string): Preview {
  return kind === "products" ? applyProducts(text) : applyCustomers(text);
}
