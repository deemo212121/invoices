import { CsvImport } from "@/components/CsvImport";
import { SalesExport } from "@/components/SalesExport";

export default function CsvPage() {
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Export CSV</h2>
        <p className="text-sm text-zinc-600">Opens in Excel, Google Sheets or LibreOffice.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/csv/products" download className="btn-secondary">
            Products
          </a>
          <a href="/api/csv/customers" download className="btn-secondary">
            Customers
          </a>
        </div>
        <SalesExport />
      </section>

      <CsvImport />
    </div>
  );
}
