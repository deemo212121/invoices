"use client";

import { useActionState, useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/app/actions/products";
import { fileUrl } from "@/lib/files";
import type { FormState } from "@/lib/form-state";
import type { Product } from "@/db/schema";
import { Field, FormMessage } from "./ui";

/** A titled block inside the product form, with its explanation on the left on wide screens. */
function Section({ title, hint, first, children }: { title: string; hint?: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={`grid gap-4 py-6 lg:grid-cols-[200px_1fr] lg:gap-8 ${first ? "pt-0" : "border-t border-zinc-100"}`}>
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {hint && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Check({ name, checked, title, hint }: { name: string; checked?: boolean; title: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-zinc-200 transition ring-inset hover:bg-zinc-50 has-[:checked]:bg-zinc-50 has-[:checked]:ring-zinc-900">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-4 accent-zinc-900" />
      <span className="text-sm">
        <span className="font-medium">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{hint}</span>
      </span>
    </label>
  );
}

export function ProductForm({ product, categories, brands }: { product?: Product; categories: string[]; brands: string[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await saveProduct(prev, fd);
    if (res.go) router.push(res.go);
    return res;
  }, {});
  const p = product;
  const [preview, setPreview] = useState<string | null>(() => fileUrl(p?.imagePath));
  const [removed, setRemoved] = useState(false);

  // Release object URLs created for local previews.
  // (Stored images share a cached URL; only previews of a newly chosen file are released.)
  useEffect(() => () => void (preview?.startsWith("blob:") && preview !== fileUrl(p?.imagePath) && URL.revokeObjectURL(preview)), [preview, p?.imagePath]);

  return (
    <form action={action} className="card p-6">
      {p && <input type="hidden" name="id" value={p.id} />}
      {removed && <input type="hidden" name="removeImage" value="on" />}
      <div className="mb-4 empty:hidden">
        <FormMessage state={state} />
      </div>

      <Section first title="Details" hint="How the product appears at the counter and on invoices.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name *" className="sm:col-span-2">
            <input name="name" required defaultValue={p?.name} className="input" placeholder="e.g. Cola Soda 1.5L" />
          </Field>
          <Field label="SKU *">
            <input name="sku" required defaultValue={p?.sku} className="input font-mono" placeholder="BEV-001" />
          </Field>
          <Field label="Barcode">
            <input name="barcode" defaultValue={p?.barcode ?? ""} className="input font-mono" placeholder="Scan or type" />
          </Field>
          <Field label="Category">
            <input name="category" list="categories" defaultValue={p?.category} className="input" />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Brand">
            <input name="brand" list="brands" defaultValue={p?.brand} className="input" />
            <datalist id="brands">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea name="description" rows={3} defaultValue={p?.description} className="input" />
          </Field>
        </div>
      </Section>

      <Section title="Pricing & stock" hint="Selling prices include VAT. Stock changes go through stock movements.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost price">
            <input name="costPrice" type="number" min="0" step="0.01" defaultValue={p?.costPrice ?? 0} className="input" />
          </Field>
          <Field label="Selling price">
            <input name="sellingPrice" type="number" min="0" step="0.01" defaultValue={p?.sellingPrice ?? 0} className="input" />
          </Field>
          <Field label="Minimum stock">
            <input name="minStock" type="number" min="0" step="1" defaultValue={p?.minStock ?? 0} className="input" />
          </Field>
          {p ? (
            <div>
              <span className="label">In stock</span>
              <div className="flex h-10 items-center rounded-lg bg-zinc-50 px-3 text-sm text-zinc-500 ring-1 ring-zinc-200 ring-inset">
                {p.quantity} (change via stock movements)
              </div>
            </div>
          ) : (
            <Field label="Opening quantity">
              <input name="quantity" type="number" min="0" step="1" defaultValue={0} className="input" />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Tax & discounts" hint="Used for VAT invoices and the senior citizen / PWD discount.">
        <Check
          name="vatExempt"
          checked={p?.vatExempt}
          title="VAT-exempt item"
          hint="For example unprocessed rice, fresh fish or vegetables. Only matters when the business is VAT-registered."
        />
        <Check
          name="seniorEligible"
          checked={p?.seniorEligible}
          title="Basic necessity / prime commodity"
          hint="Gets the senior citizen & PWD 5% discount: rice, canned goods, noodles, cooking oil, condiments, coffee, water, soap, detergent (DTI-DA-DOE JAO 24-02)."
        />
      </Section>

      <Section title="Image" hint="JPG, PNG, WEBP or GIF. Resized automatically to keep your store small.">
        <div className="flex items-center gap-5">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-50 ring-1 ring-zinc-200">
            {preview && !removed ? (
              <img src={preview} alt="" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-7 text-zinc-300" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="btn-secondary cursor-pointer">
              <ImagePlus className="size-4" />
              {preview && !removed ? "Replace image" : "Upload image"}
              <input
                name="image"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPreview(URL.createObjectURL(f));
                    setRemoved(false);
                  }
                }}
              />
            </label>
            {preview && !removed && p?.imagePath && (
              <button type="button" onClick={() => setRemoved(true)} className="btn-danger">
                <Trash2 className="size-4" /> Remove
              </button>
            )}
          </div>
        </div>
      </Section>

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button className="btn min-w-36" disabled={pending}>
          {pending ? "Saving…" : p ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
