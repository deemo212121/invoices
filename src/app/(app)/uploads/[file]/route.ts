import fs from "node:fs/promises";
import path from "node:path";
import { uploadPath } from "@/db";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Serves product images saved to data/uploads (files added after build aren't served from /public).
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[file]">) {
  const name = path.basename((await ctx.params).file);
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(uploadPath(name));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
