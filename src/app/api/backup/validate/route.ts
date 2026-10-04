import { BackupError, validateBackup } from "@/lib/backup";

// Body is the raw backup ZIP. Validates and stages it without touching current data.
export async function POST(req: Request) {
  try {
    const zip = new Uint8Array(await req.arrayBuffer());
    if (!zip.length) return Response.json({ error: "No file received." }, { status: 400 });
    return Response.json(await validateBackup(zip));
  } catch (e) {
    const message = e instanceof BackupError ? e.message : `Could not check backup: ${e instanceof Error ? e.message : e}`;
    return Response.json({ error: message }, { status: 400 });
  }
}
