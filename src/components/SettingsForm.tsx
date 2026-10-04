"use client";

import { useActionState, useState } from "react";
import { saveSettings } from "@/app/actions/settings";
import type { Settings } from "@/db/schema";
import { Field, FormMessage } from "./ui";
import { INVOICE_PAPERS, LABEL_FORMATS } from "@/lib/labels";

export function SettingsForm({ settings: s }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, {});
  const [vat, setVat] = useState(s.vatRegistered);

  return (
    <form action={action} className="card space-y-4">
      <FormMessage state={state} />

      <div className="rounded-xl border border-zinc-200 p-4" data-tour="settings-vat">
        <input type="hidden" name="vatRegistered" value={vat ? "1" : "0"} />
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">VAT registration</div>
            <div className="text-sm text-zinc-600">{vat ? "VAT-registered" : "Non-VAT"}</div>
          </div>
          <div className="flex rounded-lg border border-zinc-300 p-0.5" role="radiogroup" aria-label="VAT registration">
            {[
              { on: false, label: "Non-VAT" },
              { on: true, label: "VAT-registered" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={vat === o.on}
                onClick={() => setVat(o.on)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  vat === o.on ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          {vat
            ? "Selling prices already include 12% VAT. Invoices show VATable sales, VAT, VAT-exempt and zero-rated sales, and \"VAT Reg. TIN\". Mark VAT-exempt products on the product page."
            : "No VAT is shown on invoices, which say \"Non-VAT Reg. TIN\". Non-VAT businesses (₱3M or less in yearly sales) pay 3% percentage tax quarterly (BIR Form 2551Q). It is not added to receipts."}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Applies to new sales. Past invoices keep the setting they were issued under.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *">
          <input name="businessName" required defaultValue={s.businessName} className="input" />
        </Field>
        <Field label="TIN (with branch code)">
          <input name="taxId" defaultValue={s.taxId} placeholder="123-456-789-00000" className="input" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={s.phone} className="input" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={s.email} className="input" />
        </Field>
        <Field label="Currency symbol">
          <input name="currencySymbol" defaultValue={s.currencySymbol} className="input" maxLength={4} />
        </Field>
      </div>
      <Field label="Registered address">
        <textarea name="address" rows={2} defaultValue={s.address} className="input" />
      </Field>
      <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <div className="font-medium">Printing</div>
          <div className="text-sm text-zinc-500">Defaults; you can also switch on the invoice and label pages.</div>
        </div>
        <Field label="Invoice paper">
          <select name="invoicePaper" defaultValue={s.invoicePaper} className="input">
            {INVOICE_PAPERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === "a4" ? "A4 page (regular printer)" : `Thermal receipt, ${p.id} roll`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Barcode label stock">
          <select name="labelFormat" defaultValue={s.labelFormat} className="input">
            {LABEL_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Invoice footer">
        <input name="invoiceFooter" defaultValue={s.invoiceFooter} className="input" />
      </Field>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
