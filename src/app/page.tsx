import Link from "next/link";
import { dailyRevenue, dashboardStats, getSettings, listSales, recentSaleItems } from "@/lib/data";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { dateTime, money, stockStatus } from "@/lib/format";
import { AlertTriangle, Package, Plus, Receipt, type LucideIcon } from "lucide-react";
import { Empty, StockBadge } from "@/components/ui";

export default function Dashboard() {
  const { today, productCount, lowStock } = dashboardStats();
  const items = recentSaleItems(8);
  const invoices = listSales({ limit: 8 });
  const s = getSettings();
  const cur = s.currencySymbol;
  const trend = dailyRevenue(14);
  const trendTotal = trend.reduce((t, d) => t + d.total, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{greeting}</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ·{" "}
            {s.businessName}
          </p>
        </div>
        <Link href="/pos" className="btn" data-tour="dash-new-sale">
          <Plus className="size-4" /> New sale
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Today's sales"
          value={money(today.total, cur)}
          sub={`${today.count} transactions`}
          icon={Receipt}
        />
        <Stat label="Total products" value={String(productCount)} sub="active" href="/products" icon={Package} />
        <Stat
          label="Low-stock products"
          value={String(lowStock.length)}
          sub="at or below minimum"
          href="/products?stock=low"
          warn={lowStock.length > 0}
          icon={AlertTriangle}
        />
      </div>

      <section className="card">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-semibold tracking-tight">Revenue, last 14 days</h2>
            <p className="text-sm text-zinc-500">All sales, excluding cancellations</p>
          </div>
          <span className="text-sm text-zinc-500 tabular-nums">{money(trendTotal, cur)} total</span>
        </div>
        <ColumnChart
          ariaLabel="Revenue per day, last 14 days"
          currency={cur}
          data={trend.map((d) => ({
            key: d.day,
            label: new Date(`${d.day}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
            value: d.total,
            detail: `${d.orders} sale${d.orders === 1 ? "" : "s"}`,
          }))}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold">Recent sales</h2>
          {items.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Amount</th>
                  <th className="col-sm">Time</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/invoices/${i.saleId}`} className="hover:underline">
                        {i.name}
                      </Link>
                    </td>
                    <td className="text-right">{i.quantity}</td>
                    <td className="text-right">{money(i.lineTotal, cur)}</td>
                    <td className="col-sm text-zinc-500">{dateTime(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No sales yet.</Empty>
          )}
        </section>

        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Recent invoices</h2>
            <Link href="/invoices" className="text-sm text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {invoices.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th className="col-sm">Customer</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/invoices/${s.id}`} className="font-mono text-indigo-600 hover:underline">
                        {s.invoiceNumber}
                      </Link>
                    </td>
                    <td className="col-sm">{s.customerName ?? <span className="text-zinc-400">Walk-in</span>}</td>
                    <td className="text-right">{money(s.total, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No invoices yet.</Empty>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">Low-stock products</h2>
        {lowStock.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="col-sm">SKU</th>
                <th className="text-right">Qty</th>
                <th className="col-sm text-right">Min</th>
                <th className="col-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/products/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="col-sm font-mono text-xs">{p.sku}</td>
                  <td className="text-right">{p.quantity}</td>
                  <td className="col-sm text-right">{p.minStock}</td>
                  <td className="col-sm">
                    <StockBadge status={stockStatus(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>All products are above their minimum stock.</Empty>
        )}
      </section>
    </div>
  );
}

function Stat(props: { label: string; value: string; sub: string; href?: string; warn?: boolean; icon: LucideIcon }) {
  const Icon = props.icon;
  const body = (
    <div className="card h-full transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-500">{props.label}</div>
        <div
          className={`grid size-9 place-items-center rounded-xl ${props.warn ? "bg-amber-50 text-amber-600" : "bg-zinc-100 text-zinc-600"}`}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </div>
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${props.warn ? "text-amber-600" : ""}`}>
        {props.value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{props.sub}</div>
    </div>
  );
  return props.href ? <Link href={props.href}>{body}</Link> : body;
}
