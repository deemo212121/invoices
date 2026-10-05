"use client";

import { products } from "@/db/schema";
import { distinctValues } from "@/lib/data";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { useLive } from "@/db/live";

export default function NewProductPage() {
  useLive();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader back={{ href: "/products", label: "Products" }} title="Add product" subtitle="Opening stock is recorded as a stock-in movement." />
      <ProductForm categories={distinctValues(products.category)} brands={distinctValues(products.brand)} />
    </div>
  );
}
