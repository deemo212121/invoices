"use client";

import { CustomerForm } from "@/components/CustomerForm";
import { PageHeader } from "@/components/PageHeader";

export default function NewCustomerPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader back={{ href: "/customers", label: "Customers" }} title="Add customer" subtitle="Their details can be printed on invoices." />
      <CustomerForm />
    </div>
  );
}
