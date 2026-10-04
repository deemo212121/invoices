"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, RefreshCw, Upload } from "lucide-react";
import {
  connectWithCode,
  disconnectTikTok,
  linkListing,
  pushTikTokStock,
  saveTikTokSettings,
  setTikTokAutoSync,
  syncTikTok,
} from "@/app/actions/marketplaces";
import { dateTime, money } from "@/lib/format";
import { Empty, Field, FormMessage } from "./ui";
import { TikTokLoginButton } from "./TikTokLoginButton";

type Props = {
  connection: {
    appKey: string;
    hasSecret: boolean;
    authUrl: string;
    connected: boolean;
    shopName: string;
    shopRegion: string;
    sellerName: string;
    refreshExpiresAt: number;
    autoSync: boolean;
    lastSyncAt: string | null;
    lastSyncResult: string;
  };
  listings: {
    id: number;
    title: string;
    sellerSku: string;
    status: string;
    externalQuantity: number;
    productId: number | null;
    ourQuantity: number | null;
  }[];
  orders: {
    id: number;
    externalOrderId: string;
    status: string;
    orderCreatedAt: string;
    total: number;
    buyerName: string;
    problem: string;
    saleId: number | null;
    invoiceNumber: string | null;
    cancelledAt: string | null;
  }[];
  products: { id: number; name: string; sku: string }[];
  currency: string;
  flash: { connected?: string; error?: string };
};

export function TikTokPanel({ connection: c, listings, orders, products, currency, flash }: Props) {
  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState(saveTikTokSettings, {});
  const [codeState, codeAction, exchanging] = useActionState(connectWithCode, {});
  const [result, setResult] = useState<{ ok: boolean; summary: string } | null>(null);
  const [busy, startTransition] = useTransition();
  // Developer fields stay folded away once the keys are saved.
  const [showSetup, setShowSetup] = useState(!c.appKey || !c.hasSecret);

  const run = (fn: () => Promise<{ ok: boolean; summary: string }>) =>
    startTransition(async () => {
      setResult(await fn());
      router.refresh();
    });

  const unlinked = listings.filter((l) => !l.productId).length;
  const problems = orders.filter((o) => o.problem).length;

  return (
    <div className="space-y-4">
      {flash.connected && <Banner ok>Connected to {flash.connected}. Run a sync to bring in products and orders.</Banner>}
      {flash.error && <Banner>{flash.error}</Banner>}

      {/* ── Connection ── */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-zinc-900 text-sm font-bold text-white">TT</div>
            <div>
              <h2 className="font-semibold tracking-tight">TikTok Shop</h2>
              <p className="text-sm text-zinc-500">
                {c.connected
                  ? `Connected to ${c.shopName}${c.shopRegion ? ` (${c.shopRegion})` : ""}${c.sellerName ? ` · ${c.sellerName}` : ""}`
                  : "Not connected"}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
              c.connected ? "bg-emerald-50 text-emerald-700 ring-emerald-600/15" : "bg-zinc-100 text-zinc-600 ring-zinc-900/5"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {c.connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {c.connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={busy} onClick={() => run(syncTikTok)}>
                <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> {busy ? "Syncing…" : "Sync now"}
              </button>
              <button className="btn-secondary" disabled={busy} onClick={() => run(pushTikTokStock)}>
                <Upload className="size-4" /> Push stock to TikTok
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  defaultChecked={c.autoSync}
                  onChange={(e) => startTransition(() => setTikTokAutoSync(e.target.checked))}
                />
                Auto-sync every 10 minutes while the app is open
              </label>
            </div>
            {result && <Banner ok={result.ok}>{result.summary}</Banner>}
            {c.lastSyncAt && (
              <p className="text-xs text-zinc-500">
                Last sync {dateTime(c.lastSyncAt)}: {c.lastSyncResult}
              </p>
            )}
            {c.refreshExpiresAt > 0 && (
              <p className="text-xs text-zinc-500">
                Connection valid until {dateTime(new Date(c.refreshExpiresAt * 1000).toISOString())}. It renews
                automatically when you sync.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-zinc-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">Connect your TikTok Shop</div>
              <p className="mt-0.5 max-w-md text-sm text-zinc-500">
                Sign in on TikTok Shop&apos;s own page and tap Authorize. You&apos;ll come straight back here, connected.
                TikTok only allows it once it has approved our app.
              </p>
            </div>
            <TikTokLoginButton ready={c.appKey !== "" && c.hasSecret} />
          </div>
        )}

        <div className="border-t border-zinc-100 pt-3">
          <button onClick={() => setShowSetup(!showSetup)} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
            {showSetup ? "Hide" : "Show"} developer settings
          </button>
        </div>

        {showSetup && (
          <div className="grid gap-6 lg:grid-cols-2">
            <form action={saveAction} className="space-y-3">
              <FormMessage state={saveState} />
              <Field label="App Key">
                <input name="appKey" defaultValue={c.appKey} className="input font-mono" autoComplete="off" />
              </Field>
              <Field label="App Secret">
                <input
                  name="appSecret"
                  type="password"
                  placeholder={c.hasSecret ? "Saved. Leave blank to keep it" : "Paste the App Secret"}
                  className="input font-mono"
                  autoComplete="off"
                />
              </Field>
              <Field label="Authorization link (optional)">
                <input
                  name="authUrl"
                  defaultValue={c.authUrl}
                  placeholder="Built automatically from the App Key"
                  className="input font-mono text-xs"
                />
              </Field>
              <p className="text-xs text-zinc-500">
                Find these in TikTok Shop Partner Center → App &amp; Service → your app. The redirect URL there must
                be <code className="rounded bg-zinc-100 px-1">http://localhost:3000/api/tiktok/callback</code>.
                Keys and tokens are stored only in this computer&apos;s database (and in its backups).
              </p>
              <button className="btn" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </form>

            <form action={codeAction} className="space-y-3 rounded-xl bg-zinc-50 p-4">
              <div className="text-sm font-medium">Connect with an authorization code</div>
              <p className="text-xs text-zinc-500">
                If the redirect after approving didn&apos;t come back to this app, paste the full address it landed on
                (or just the <code>code=</code> value).
              </p>
              <FormMessage state={codeState} />
              <input name="code" placeholder="http://localhost:3000/api/tiktok/callback?code=…" className="input font-mono text-xs" />
              <button className="btn-secondary" disabled={exchanging}>
                {exchanging ? "Connecting…" : "Connect"}
              </button>
            </form>
          </div>
        )}

        {c.connected && (
          <div className="border-t border-zinc-100 pt-3">
            <button
              onClick={() => {
                if (confirm("Disconnect TikTok Shop? Orders already imported stay in your records.")) {
                  startTransition(async () => {
                    await disconnectTikTok();
                    router.refresh();
                  });
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Disconnect
            </button>
          </div>
        )}
      </section>

      {/* ── Orders ── */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold tracking-tight">TikTok orders</h2>
            <p className="text-sm text-zinc-500">
              Paid orders become sales with your own Sales Invoice, and stock goes down automatically.
            </p>
          </div>
          {problems > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
              {problems} need attention
            </span>
          )}
        </div>
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Buyer</th>
                  <th>TikTok status</th>
                  <th className="text-right">Total</th>
                  <th>In this app</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="font-mono text-xs">{o.externalOrderId}</td>
                    <td className="whitespace-nowrap text-zinc-500">{dateTime(o.orderCreatedAt)}</td>
                    <td>{o.buyerName}</td>
                    <td className="text-xs">{o.status.replaceAll("_", " ").toLowerCase()}</td>
                    <td className="text-right">{money(o.total, currency)}</td>
                    <td>
                      {o.problem ? (
                        <span className="flex items-start gap-1.5 text-xs text-amber-700">
                          <CircleAlert className="mt-px size-3.5 shrink-0" /> {o.problem}
                        </span>
                      ) : o.saleId ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className={`size-3.5 ${o.cancelledAt ? "text-zinc-400" : "text-emerald-600"}`} />
                          <Link href={`/invoices/${o.saleId}`} className="link font-mono text-xs">
                            {o.invoiceNumber}
                          </Link>
                          {o.cancelledAt && <span className="text-xs text-zinc-500">cancelled, stock returned</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">Waiting for payment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No TikTok orders yet. They appear here after a sync.</Empty>
        )}
        {problems > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Fix the cause (link the product below, or record a stock-in), then sync again. Problem orders are retried
            automatically.
          </p>
        )}
      </section>

      {/* ── Product links ── */}
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold tracking-tight">Product links</h2>
            <p className="text-sm text-zinc-500">
              Each TikTok SKU is linked to one of your products. SKUs whose seller SKU matches your product SKU link
              automatically.
            </p>
          </div>
          {unlinked > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
              {unlinked} not linked
            </span>
          )}
        </div>
        {listings.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>TikTok product</th>
                  <th>Seller SKU</th>
                  <th className="text-right">TikTok stock</th>
                  <th>Linked product</th>
                  <th className="text-right">Your stock</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.title}
                      <div className="text-xs text-zinc-400">{l.status.toLowerCase()}</div>
                    </td>
                    <td className="font-mono text-xs">{l.sellerSku || "—"}</td>
                    <td className="text-right">{l.externalQuantity}</td>
                    <td>
                      <select
                        defaultValue={l.productId ?? ""}
                        onChange={(e) =>
                          startTransition(async () => {
                            await linkListing(l.id, e.target.value ? Number(e.target.value) : null);
                            router.refresh();
                          })
                        }
                        className={`input h-9 min-w-56 ${l.productId ? "" : "ring-amber-300"}`}
                      >
                        <option value="">Not linked</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">{l.ourQuantity ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No TikTok products yet. They appear here after a sync.</Empty>
        )}
      </section>
    </div>
  );
}

function Banner({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ring-1 ${
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-600/10" : "bg-red-50 text-red-700 ring-red-600/10"
      }`}
    >
      {children}
    </p>
  );
}
