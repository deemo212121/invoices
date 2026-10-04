import { currentSummary, listSafetyBackups } from "@/lib/backup";
import { dateTime, fileSize } from "@/lib/format";
import { BackupRestore } from "@/components/BackupRestore";

export default function BackupPage() {
  const now = currentSummary();
  const safety = listSafetyBackups();

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Export full backup</h2>
        <p className="text-sm text-zinc-600">
          Downloads one ZIP file with everything: products, inventory history, customers, sales, invoices,
          settings, product images and documents. Copy it to a USB drive or another computer, then use{" "}
          <strong>Import backup</strong> there to restore.
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-4">
          <li>{now.counts.products} products</li>
          <li>{now.counts.customers} customers</li>
          <li>{now.counts.sales} invoices</li>
          <li>{now.counts.inventory_movements} stock movements</li>
          <li>{now.imageCount} images</li>
          <li>{now.documentCount} documents</li>
        </ul>
        <a href="/api/backup/export" className="btn" data-tour="backup-download">
          Download backup
        </a>
      </section>

      <BackupRestore />

      <section className="card">
        <h2 className="mb-1 font-semibold">Automatic safety backups</h2>
        <p className="mb-2 text-sm text-zinc-600">
          Made automatically before every restore. Stored in <code>data/backups</code>. Import one to undo a restore.
        </p>
        {safety.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Created</th>
                <th className="text-right">Size</th>
              </tr>
            </thead>
            <tbody>
              {safety.map((b) => (
                <tr key={b.name}>
                  <td>
                    <a href={`/api/backup/files/${b.name}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {b.name}
                    </a>
                  </td>
                  <td>{dateTime(b.createdAt)}</td>
                  <td className="text-right">{fileSize(b.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-500">None yet.</p>
        )}
      </section>
    </div>
  );
}
