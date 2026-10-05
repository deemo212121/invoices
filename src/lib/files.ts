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
  const img = await decodeImage(file, max);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img.source, 0, 0, canvas.width, canvas.height);
  img.done();
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

/**
 * Opens a photo for drawing. Tries the fast decoder first, then an <img> element, which reads
 * more formats in some browsers (Safari opens iPhone HEIC photos this way).
 */
async function decodeImage(file: File, max: number): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  // Big phone photos (48 MP and up) can be too large for a phone browser to open at full size,
  // so first ask for a reduced copy, then the full one, then fall back to an <img>.
  for (const opts of [{ resizeWidth: max * 2, resizeQuality: "high" } as ImageBitmapOptions, undefined]) {
    try {
      const bitmap = await createImageBitmap(file, opts);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(await unreadableReason(file));
  }
}

/** Looks inside the file to say what it really is, since the name (".jpg") can be wrong. */
async function unreadableReason(file: File) {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const brand = new TextDecoder().decode(head.slice(4, 12));
  const fix = "Take a screenshot of the photo and upload the screenshot, or save it as JPG/PNG first.";
  if (/^ftyp(heic|heix|hevc|mif1|msf1)/.test(brand)) {
    return `This is an iPhone HEIC photo${file.name.match(/.jpe?g$/i) ? " named .jpg" : ""}, which this browser can't open. ${fix}`;
  }
  if (/^ftypavi[fs]/.test(brand)) return `This is an AVIF image, which this browser can't open. ${fix}`;
  if (head[0] === 0xff && head[1] === 0xd8) {
    return `This JPG couldn't be opened on this device (it may be very large or damaged). ${fix}`;
  }
  return `This file isn't a photo this browser can open${file.type ? ` (${file.type})` : ""}. ${fix}`;
}
