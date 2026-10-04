import { getSettings, listCustomers, listProducts } from "@/lib/data";
import { Pos } from "@/components/Pos";

export default function PosPage() {
  const s = getSettings();
  const products = listProducts().map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    category: p.category,
    price: p.sellingPrice,
    quantity: p.quantity,
    minStock: p.minStock,
    imagePath: p.imagePath,
    vatExempt: p.vatExempt,
    seniorEligible: p.seniorEligible,
  }));
  const customers = listCustomers().map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    tin: c.tin,
  }));
  return <Pos products={products} customers={customers} currency={s.currencySymbol} vatRegistered={s.vatRegistered} />;
}
