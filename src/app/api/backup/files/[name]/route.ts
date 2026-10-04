import fs from "node:fs/promises";
import path from "node:path";
import { BACKUP_DIR } from "@/lib/backup";

// Downloads an automatic pre-restore backup from data/backups.
export async function GET(_req: Request, ctx: RouteContext<"/api/backup/files/[name]">) {
  const name = path.basename((await ctx.params).name);
  if (!name.endsWith(".zip")) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(path.join(BACKUP_DIR, name));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
