"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { savePrintPreference } from "@/app/actions/settings";
import { INVOICE_PAPERS, type InvoicePaper } from "@/lib/labels";

/** A4 / thermal receipt switch for invoices; the choice becomes the default next time. */
export function PaperToggle({ current }: { current: InvoicePaper }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  return (
    <div
      data-tour="invoice-paper"
      className="flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-zinc-200" role="radiogroup" aria-label="Paper: A4 page or thermal receipt roll" title="Paper: A4 page or thermal receipt">
      {INVOICE_PAPERS.map((p) => (
        <button
          key={p.id}
          role="radio"
          aria-checked={current === p.id}
          onClick={() =>
            start(async () => {
              await savePrintPreference("invoicePaper", p.id);
              router.replace(`${pathname}?${new URLSearchParams({ ...Object.fromEntries(params), paper: p.id })}`);
            })
          }
          className={`h-9 rounded-md px-3 text-sm font-medium transition ${
            current === p.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
