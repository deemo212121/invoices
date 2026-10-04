import { getSettings, listProducts } from "@/lib/data";
import { labelFormat } from "@/lib/labels";
import { LabelStudio } from "@/components/LabelStudio";

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const s = getSettings();
  const products = listProducts().map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    price: p.sellingPrice,
    category: p.category,
    quantity: p.quantity,
  }));
  const preselected = (ids ?? "")
    .split(",")
    .map(Number)
    .filter((n) => products.some((p) => p.id === n));
  return (
    <LabelStudio
      products={products}
      currency={s.currencySymbol}
      initialFormat={labelFormat(s.labelFormat).id}
      preselected={preselected}
    />
  );
}
