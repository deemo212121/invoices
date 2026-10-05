import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import type { FormState } from "@/lib/form-state";

export async function saveCustomer(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = Number(fd.get("id")) || undefined;
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const values = {
    name: get("name"),
    phone: get("phone"),
    email: get("email"),
    address: get("address"),
    tin: get("tin"),
    notes: get("notes"),
  };
  if (!values.name) return { error: "Name is required" };

  if (id) db.update(customers).set(values).where(eq(customers.id, id)).run();
  else db.insert(customers).values(values).run();

  return { go: "/customers" };
}
