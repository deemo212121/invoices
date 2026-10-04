import { revalidatePath } from "next/cache";
import { BackupError, restoreBackup } from "@/lib/backup";

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    const result = await restoreBackup(String(token ?? ""));
    revalidatePath("/", "layout");
    return Response.json(result);
  } catch (e) {
    const message = e instanceof BackupError ? e.message : `Restore failed: ${e instanceof Error ? e.message : e}`;
    return Response.json({ error: message }, { status: 400 });
  }
}
