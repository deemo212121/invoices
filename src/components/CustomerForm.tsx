"use client";

import { useActionState } from "react";
import { saveCustomer } from "@/app/actions/customers";
import type { Customer } from "@/db/schema";
import { Field, FormMessage } from "./ui";

export function CustomerForm({ customer: c }: { customer?: Customer }) {
  const [state, action, pending] = useActionState(saveCustomer, {});
  return (
    <form action={action} className="card space-y-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input name="name" required defaultValue={c?.name} className="input" />
        </Field>
        <Field label="Phone">
          <input name="phone" defaultValue={c?.phone} className="input" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={c?.email} className="input" />
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={c?.address} className="input" />
        </Field>
        <Field label="TIN (for business buyers)">
          <input name="tin" defaultValue={c?.tin} placeholder="123-456-789-00000" className="input" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={c?.notes} className="input" />
      </Field>
      <button className="btn" disabled={pending}>
        {pending ? "Saving…" : c ? "Save changes" : "Add customer"}
      </button>
    </form>
  );
}
