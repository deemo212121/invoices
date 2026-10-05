import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { applyStockChange, nowSql } from "@/lib/inventory";
import type { FormState } from "@/lib/form-state";
import { inStoreBarcode } from "@/lib/labels";
import { deleteFile, putFile, shrinkImage } from "@/lib/files";
import { productHref } from "@/lib/links";


/** Stores a resized copy of the photo in the database and returns its file name. */
async function saveImage(file: File) {
  // Phones sometimes report HEIC or nothing at all; the decoder decides whether it can be read.
  if (file.type && !file.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG, WEBP or GIF).");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image must be 15 MB or smaller");
  const { data, type, ext } = await shrinkImage(file);
  const name = `${crypto.randomUUID()}${ext}`;
  putFile({ name, type, data });
  return name;
}

function removeImage(name: string | null) {
  deleteFile(name);
}

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function num(fd: FormData, key: string, label: string) {
  const n = Number(str(fd, key) || 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a number of 0 or more`);
  return n;
}

function readFields(fd: FormData) {
  const sku = str(fd, "sku");
  const name = str(fd, "name");
  if (!sku) throw new Error("SKU is required");
  if (!name) throw new Error("Name is required");
  return {
    sku,
    name,
    barcode: str(fd, "barcode") || null,
    description: str(fd, "description"),
    category: str(fd, "category"),
    brand: str(fd, "brand"),
    costPrice: num(fd, "costPrice", "Cost price"),
    sellingPrice: num(fd, "sellingPrice", "Selling price"),
    minStock: Math.floor(num(fd, "minStock", "Minimum stock")),
    vatExempt: fd.get("vatExempt") === "on",
    seniorEligible: fd.get("seniorEligible") === "on",
  };
}

function friendly(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("UNIQUE constraint failed: products.sku")) return "Another product already uses this SKU";
  return msg;
}

export async function saveProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = Number(fd.get("id")) || undefined;
  let newImage: string | undefined;
  let savedId: number;
  try {
    const fields = readFields(fd);
    const opening = id ? 0 : Math.floor(num(fd, "quantity", "Opening quantity"));
    const file = fd.get("image");
    if (file instanceof File && file.size > 0) newImage = await saveImage(file);
    const existing = id ? db.select().from(products).where(eq(products.id, id)).get() : undefined;
    if (id && !existing) throw new Error("Product not found");
    const replaceImage = newImage !== undefined || fd.get("removeImage") === "on";

    savedId = db.transaction((tx) => {
      if (existing) {
        tx.update(products)
          .set({ ...fields, ...(replaceImage ? { imagePath: newImage ?? null } : {}), updatedAt: nowSql })
          .where(eq(products.id, existing.id))
          .run();
        return existing.id;
      }
      const created = tx
        .insert(products)
        .values({ ...fields, imagePath: newImage ?? null, quantity: 0 })
        .returning({ id: products.id })
        .get();
      // Opening stock is recorded as a stock-in movement like any other change.
      if (opening > 0) {
        applyStockChange(tx, { productId: created.id, type: "in", change: opening, note: "Opening stock" });
      }
      return created.id;
    });
    if (existing && replaceImage) removeImage(existing.imagePath);
  } catch (e) {
    if (newImage) removeImage(newImage);
    return { error: friendly(e) };
  }
  return { go: productHref(savedId) };
}

export async function setArchived(id: number, archived: boolean) {
  db.update(products).set({ archived, updatedAt: nowSql }).where(eq(products.id, id)).run();
}

/** Gives products without a barcode an in-store EAN-13 (2…), so they can get printed labels. */
export async function generateBarcodes(ids: number[]) {
  let made = 0;
  db.transaction((tx) => {
    for (const id of ids) {
      const p = tx.select().from(products).where(eq(products.id, id)).get();
      if (!p || p.barcode) continue;
      const code = inStoreBarcode(p.id);
      if (tx.select({ id: products.id }).from(products).where(eq(products.barcode, code)).get()) continue;
      tx.update(products).set({ barcode: code, updatedAt: nowSql }).where(eq(products.id, p.id)).run();
      made++;
    }
  });
  return made;
}
