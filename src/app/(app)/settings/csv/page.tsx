"use client";

import { CsvImport } from "@/components/CsvImport";
import { SalesExport } from "@/components/SalesExport";
import { downloadCsv } from "@/lib/csv-export";

export default function CsvPage() {
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">Export CSV</h2>
        <p className="text-sm text-zinc-600">Opens in Excel, Google Sheets or LibreOffice.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv("products")} className="btn-secondary">
            Products
          </button>
          <button onClick={() => downloadCsv("customers")} className="btn-secondary">
            Customers
          </button>
        </div>
        <SalesExport />
      </section>

      <CsvImport />
    </div>
  );
}
