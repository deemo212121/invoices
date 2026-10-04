"use server";

import { revalidatePath } from "next/cache";
import { previewImport, runImport, type ImportKind, type Preview } from "@/lib/csv-import";

type Result = { ok: true; preview: Preview } | { ok: false; error: string };

function check(kind: string): asserts kind is ImportKind {
  if (kind !== "products" && kind !== "customers") throw new Error("Unknown import type");
}

/** Reads the CSV and reports what would happen to each row. Changes nothing. */
export async function previewCsvImport(kind: string, text: string): Promise<Result> {
  try {
    check(kind);
    return { ok: true, preview: previewImport(kind, text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Imports all valid rows in one transaction; rows with errors are skipped. */
export async function runCsvImport(kind: string, text: string): Promise<Result> {
  try {
    check(kind);
    const preview = runImport(kind, text);
    revalidatePath("/", "layout");
    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
