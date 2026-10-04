import Link from "next/link";
import { Barcode, Download, Package, Plus, Upload } from "lucide-react";
import { products } from "@/db/schema";
import { distinctValues, getSettings, listProducts, type ProductFilters } from "@/lib/data";
import { money, stockStatus } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ProductThumb, SearchInput, StockBadge } from "@/components/ui";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ProductFilters> }) {
  const f = await searchParams;
  const rows = listProducts(f);
  const categories = distinctValues(products.category);
  const brands = distinctValues(products.brand);
  const cur = getSettings().currencySymbol;
  const filtered = !!(f.q || f.category || f.brand || f.stock || f.archived);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle={`${rows.length} ${f.archived === "1" ? "archived" : "active"} product${rows.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/settings/csv" className="btn-secondary">
              <Upload className="size-4" /> Import
            </Link>
            <a href="/api/csv/products" download className="btn-secondary">
              <Download className="size-4" /> Export
            </a>
            <Link href="/products/labels" className="btn-secondary" data-tour="products-labels">
              <Barcode className="size-4" /> Print labels
            </Link>
            <Link href="/products/new" className="btn" data-tour="products-add">
              <Plus className="size-4" /> Add product
            </Link>
          </>
        }
      />

      <form className="flex flex-wrap items-center gap-2">
        <SearchInput defaultValue={f.q} placeholder="Search name, SKU or barcode" />
        <select name="category" defaultValue={f.category ?? ""} className="input w-auto">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="brand" defaultValue={f.brand ?? ""} className="input w-auto">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <select name="stock" defaultValue={f.stock ?? ""} className="input w-auto">
          <option value="">Any stock</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select name="archived" defaultValue={f.archived ?? ""} className="input w-auto">
          <option value="">Active</option>
          <option value="1">Archived</option>
        </select>
        <button className="btn-secondary">Apply</button>
        {filtered && (
          <Link href="/products" className="px-2 text-sm text-zinc-500 hover:text-zinc-900">
            Clear
          </Link>
        )}
      </form>

      {rows.length ? (
        <div className="card-table">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="col-md">Category</th>
                <th className="col-sm text-right">Cost</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock</th>
                <th className="col-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}`} className="flex items-center gap-3">
                      <ProductThumb src={p.imagePath} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900 hover:underline">{p.name}</span>
                        <span className="font-mono text-xs text-zinc-400">{p.sku}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="col-md">
                    <div className="text-zinc-700">{p.category || "—"}</div>
                    {p.brand && <div className="text-xs text-zinc-400">{p.brand}</div>}
                  </td>
                  <td className="col-sm text-right text-zinc-500">{money(p.costPrice, cur)}</td>
                  <td className="text-right font-medium">{money(p.sellingPrice, cur)}</td>
                  <td className="text-right">{p.quantity}</td>
                  <td className="col-sm">
                    <StockBadge status={stockStatus(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card grid place-items-center py-16 text-center">
          <Package className="size-8 text-zinc-300" strokeWidth={1.5} />
          <p className="mt-3 font-medium">{filtered ? "No products match" : "No products yet"}</p>
          <p className="text-sm text-zinc-500">
            {filtered ? "Try a different search or filter." : "Add your first product, or import a CSV."}
          </p>
        </div>
      )}
    </div>
  );
}
