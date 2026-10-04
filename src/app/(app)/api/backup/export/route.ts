import { createBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, filename } = await createBackup();
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
