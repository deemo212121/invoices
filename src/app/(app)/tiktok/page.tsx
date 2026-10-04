import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, CircleAlert, Link2, PackageX, Settings2 } from "lucide-react";
import { getSettings } from "@/lib/data";
import { dateTime, money } from "@/lib/format";
import { getConnection } from "@/lib/tiktok/client";
import { RANGES, tiktokDashboard, type Range } from "@/lib/tiktok/dashboard";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { BarList } from "@/components/charts/BarList";
import { TikTokSyncButton } from "@/components/TikTokSyncButton";
import { Empty } from "@/components/ui";
import { TikTokComingSoon } from "@/components/TikTokComingSoon";

const STATUS_LABEL: Record<string, string> = {
  UNPAID: "Awaiting payment",
  ON_HOLD: "On hold",
  AWAITING_SHIPMENT: "To ship",
  AWAITING_COLLECTION: "Awaiting pickup",
  PARTIALLY_SHIPPING: "Partially shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function TikTokDashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const days = (RANGES.find((r) => String(r) === range) ?? 30) as Range;
  const c = getConnection();
  // Until a shop is connected the dashboard has nothing real to show.
  if (!c.accessToken || !c.shopCipher) return <TikTokComingSoon hasKeys={!!c.appKey && !!c.appSecret} />;
  const d = tiktokDashboard(days);
  const cur = getSettings().currencySymbol;
  const fmt = (n: number) => money(n, cur);
  const connected = !!c.accessToken && !!c.shopCipher;

  const avg = d.current.count ? d.current.total / d.current.count : 0;
  const prevAvg = d.previous.count ? d.previous.total / d.previous.count : 0;
  const share = d.current.total + d.posTotal > 0 ? d.current.total / (d.current.total + d.posTotal) : 0;
  const shortDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">TikTok Shop</h1>
          <p className="page-subtitle">
            {connected ? (
              <>
                {c.shopName}
                {c.shopRegion ? ` · ${c.shopRegion}` : ""}
                {c.lastSyncAt ? ` · last synced ${dateTime(c.lastSyncAt)}` : " · not synced yet"}
              </>
            ) : (
              "Not connected. Showing TikTok orders already in this app."
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings/marketplaces" className="btn-secondary">
            <Settings2 className="size-4" /> Settings
          </Link>
          {connected ? (
            <TikTokSyncButton />
          ) : (
            // One click: opens TikTok's own sign-in to approve access, then returns here connected.
            <a href="/api/tiktok/connect" className="btn">
              <Link2 className="size-4" /> Connect TikTok Shop
            </a>
          )}
        </div>
      </div>

      {/* Filters: one row, above everything they scope */}
      <div className="flex items-center gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-zinc-200 w-fit">
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/tiktok?range=${r}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              r === days ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            Last {r} days
          </Link>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="TikTok sales" value={fmt(d.current.total)} now={d.current.total} prev={d.previous.total} days={days} />
        <StatTile label="Orders" value={String(d.current.count)} now={d.current.count} prev={d.previous.count} days={days} />
        <StatTile label="Average order" value={fmt(avg)} now={avg} prev={prevAvg} days={days} />
        <div className="card">
          <div className="text-sm font-medium text-zinc-500">Share of all sales</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{Math.round(share * 100)}%</div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2a78d6]/15" role="meter" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="TikTok share of all sales">
            <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${share * 100}%` }} />
          </div>
          <div className="mt-2 text-xs text-zinc-500">TikTok vs in-store (POS) sales</div>
        </div>
      </div>

      {(d.needsAttention.length > 0 || d.listings.unlinked > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/15">
          <CircleAlert className="size-4 shrink-0" />
          <span className="flex-1">
            {d.needsAttention.length > 0 && `${d.needsAttention.length} order(s) couldn't be imported. `}
            {d.listings.unlinked > 0 && `${d.listings.unlinked} TikTok SKU(s) aren't linked to a product.`}
          </span>
          <Link href="/settings/marketplaces" className="font-medium underline underline-offset-4">
            Review
          </Link>
        </div>
      )}

      {/* Trend */}
      <section className="card">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="font-semibold tracking-tight">Daily TikTok sales</h2>
            <p className="text-sm text-zinc-500">Imported orders, excluding cancellations</p>
          </div>
          <span className="text-sm text-zinc-500">{fmt(d.current.total)} total</span>
        </div>
        {d.current.count ? (
          <>
            <ColumnChart
              ariaLabel={`Daily TikTok sales, last ${days} days`}
              currency={cur}
              data={d.daily.map((x) => ({
                key: x.day,
                label: shortDay(x.day),
                value: x.total,
                detail: `${x.orders} order${x.orders === 1 ? "" : "s"}`,
              }))}
            />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-zinc-500 hover:text-zinc-900">Show as table</summary>
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {d.daily.filter((x) => x.orders).reverse().map((x) => (
                    <tr key={x.day}>
                      <td>{shortDay(x.day)}</td>
                      <td className="text-right">{x.orders}</td>
                      <td className="text-right">{fmt(x.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <Empty>No TikTok sales in the last {days} days.</Empty>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold tracking-tight">Order pipeline</h2>
          <p className="mb-4 text-sm text-zinc-500">
            {d.ordersPlaced} order(s) placed in the period
            {d.ordersPlaced ? ` · ${Math.round((d.cancelled / d.ordersPlaced) * 100)}% cancelled` : ""}
          </p>
          <BarList
            format={(n) => n.toLocaleString("en-US")}
            rows={d.pipeline.map((p) => ({ key: p.status, label: p.label, value: p.count, muted: p.status === "CANCELLED" }))}
            empty="No orders placed in this period."
          />
        </section>

        <section className="card">
          <h2 className="font-semibold tracking-tight">Top products on TikTok</h2>
          <p className="mb-4 text-sm text-zinc-500">By sales in the period</p>
          <BarList
            format={fmt}
            rows={d.topProducts.map((p) => ({ key: String(p.productId), label: p.name, value: p.revenue, sub: `${p.qty} sold` }))}
          />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Recent TikTok orders</h2>
            <Link href="/settings/marketplaces" className="text-sm text-indigo-600 hover:underline">
              All orders
            </Link>
          </div>
          {d.recentOrders.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.recentOrders.map((o) => (
                  <tr key={o.externalOrderId}>
                    <td>
                      {o.saleId ? (
                        <Link href={`/invoices/${o.saleId}`} className="font-mono text-xs text-indigo-600 hover:underline">
                          {o.invoiceNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-zinc-500">{o.externalOrderId}</span>
                      )}
                      <div className="text-xs text-zinc-400">{dateTime(o.orderCreatedAt)}</div>
                    </td>
                    <td>{o.buyerName || "—"}</td>
                    <td>
                      {o.problem ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <CircleAlert className="size-3.5" /> Needs attention
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">{STATUS_LABEL[o.status] ?? o.status}</span>
                      )}
                    </td>
                    <td className="text-right">{fmt(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No TikTok orders yet.</Empty>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold tracking-tight">Stock watch</h2>
          <p className="mb-3 text-sm text-zinc-500">TikTok products that are low or out of stock here</p>
          {d.stockWatch.length ? (
            <ul className="divide-y divide-zinc-100">
              {d.stockWatch.map((s) => (
                <li key={s.productId} className="flex items-center gap-3 py-2.5 text-sm">
                  <PackageX className={`size-4 shrink-0 ${s.quantity <= 0 ? "text-red-500" : "text-amber-500"}`} />
                  <Link href={`/products/${s.productId}`} className="min-w-0 flex-1 truncate hover:underline">
                    {s.name}
                  </Link>
                  <span className={`text-xs font-medium tabular-nums ${s.quantity <= 0 ? "text-red-600" : "text-amber-700"}`}>
                    {s.quantity <= 0 ? "Out of stock" : `${s.quantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {d.listings.total ? "All linked TikTok products are well stocked." : "No TikTok products linked yet."}
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({ label, value, now, prev, days }: { label: string; value: string; now: number; prev: number; days: number }) {
  const change = prev > 0 ? (now - prev) / prev : null;
  const up = change !== null && change >= 0;
  return (
    <div className="card">
      <div className="text-sm font-medium text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-zinc-500">
        {change === null ? (
          `No sales in the previous ${days} days`
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 font-medium ${up ? "text-emerald-700" : "text-red-600"}`}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(Math.round(change * 100))}%
            </span>
            vs previous {days} days
          </span>
        )}
      </div>
    </div>
  );
}
