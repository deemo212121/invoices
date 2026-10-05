// Product images (and backup documents) stored inside the database's `files` table.
// Raw SQL here because Drizzle's sql.js driver decodes binary columns as text.
import { rawDb } from "@/db";

export type StoredFile = { name: string; type: string; data: Uint8Array };

export function putFile(f: StoredFile) {
  rawDb().run("insert or replace into files (name, type, data) values (?, ?, ?)", [f.name, f.type, f.data]);
  forget(f.name);
}

export function deleteFile(name: string | null | undefined) {
  if (!name) return;
  rawDb().run("delete from files where name = ?", [name]);
  forget(name);
}

export function getFile(name: string): StoredFile | undefined {
  const stmt = rawDb().prepare("select name, type, data from files where name = ?", [name]);
  try {
    if (!stmt.step()) return undefined;
    const [n, type, data] = stmt.get();
    return { name: String(n), type: String(type), data: data as Uint8Array };
  } finally {
    stmt.free();
  }
}

export function listFiles(): StoredFile[] {
  const out: StoredFile[] = [];
  const stmt = rawDb().prepare("select name, type, data from files order by name");
  while (stmt.step()) {
    const [name, type, data] = stmt.get();
    out.push({ name: String(name), type: String(type), data: data as Uint8Array });
  }
  stmt.free();
  return out;
}

// Object URLs for <img>, made once per file and reused.
const urls = new Map<string, string>();

function forget(name: string) {
  const u = urls.get(name);
  if (u) URL.revokeObjectURL(u);
  urls.delete(name);
}

/** A URL an <img> can show, or null if the file is missing. */
export function fileUrl(name: string | null | undefined) {
  if (!name) return null;
  let u = urls.get(name);
  if (!u) {
    const f = getFile(name);
    if (!f) return null;
    u = URL.createObjectURL(new Blob([f.data as BlobPart], { type: f.type }));
    urls.set(name, u);
  }
  return u;
}

/** Shrinks a photo to at most `max` px on its longest side, as WebP (or JPEG), to keep the database small. */
export async function shrinkImage(file: File, max = 640): Promise<{ data: Uint8Array; type: string; ext: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg"); // Safari can't encode WebP
  if (!blob) throw new Error("This image could not be read.");
  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    type: blob.type,
    ext: blob.type === "image/webp" ? ".webp" : ".jpg",
  };
}
