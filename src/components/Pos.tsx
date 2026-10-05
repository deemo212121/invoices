"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Minus, Package, Plus, ScanLine, Search, ShoppingBag, Trash2, X } from "lucide-react";
import { completeSale, getSeniorWeeklyUsage } from "@/app/actions/sales";
import { fileUrl } from "@/lib/files";
import { invoiceHref } from "@/lib/links";
import { money, PAYMENT_METHODS, round2 } from "@/lib/format";
import { BUYER_INFO_THRESHOLD, computeSale, SENIOR_WEEKLY_PURCHASE_CAP, VAT_RATE } from "@/lib/tax";

type PosProduct = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  price: number;
  quantity: number;
  minStock: number;
  imagePath: string | null;
  vatExempt: boolean;
  seniorEligible: boolean;
};
type PosCustomer = { id: number; name: string; phone: string; address: string; tin: string };

export function Pos({
  products,
  customers,
  currency,
  vatRegistered,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
  currency: string;
  vatRegistered: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({}); // productId -> qty
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [amountPaid, setAmountPaid] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [buyer, setBuyer] = useState({ name: "", address: "", tin: "" });
  const [showBuyer, setShowBuyer] = useState(false);
  const [senior, setSenior] = useState<{ type: "senior" | "pwd"; name: string; idNumber: string } | null>(null);
  const [seniorUsed, setSeniorUsed] = useState(0);
  const [error, setError] = useState("");
  const [cartOpen, setCartOpen] = useState(false); // phones only: the cart is a full-screen sheet
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const fmt = (n: number) => money(n, currency);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.toLowerCase() === q),
    );
  }, [search, category, products]);

  // The guided tour asks to show the cart (or get it out of the way) on phones.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const target = (e as CustomEvent<string>).detail;
      if (["pos-cart", "pos-senior", "pos-charge"].includes(target)) setCartOpen(true);
      else if (target.startsWith("nav-")) setCartOpen(false);
    };
    window.addEventListener("tour:reveal", onReveal);
    return () => window.removeEventListener("tour:reveal", onReveal);
  }, []);

  // Look up how much of this week's senior/PWD limit the ID has used (debounced).
  const seniorId = senior?.idNumber.trim() ?? "";
  useEffect(() => {
    if (!seniorId) return;
    const t = setTimeout(() => getSeniorWeeklyUsage(seniorId).then(setSeniorUsed), 300);
    return () => clearTimeout(t);
  }, [seniorId]);

  function setQty(id: number, qty: number) {
    const max = byId.get(id)?.quantity ?? 0;
    const next = Math.max(0, Math.min(Math.floor(qty) || 0, max));
    setCart((c) => {
      const copy = { ...c };
      if (next > 0) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }

  function add(p: PosProduct) {
    setError("");
    if ((cart[p.id] ?? 0) >= p.quantity) {
      setError(`Only ${p.quantity} of ${p.name} in stock`);
      return;
    }
    setQty(p.id, (cart[p.id] ?? 0) + 1);
  }

  // Enter adds an exact barcode/SKU match (works with barcode scanners) or the only result.
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    const exact = products.find((p) => p.barcode?.toLowerCase() === q || p.sku.toLowerCase() === q);
    const hit = exact ?? (matches.length === 1 ? matches[0] : undefined);
    if (hit) {
      add(hit);
      setSearch("");
    }
  }

  function chooseCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => String(x.id) === id);
    setBuyer(c ? { name: c.name, address: c.address, tin: c.tin } : { name: "", address: "", tin: "" });
  }

  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = byId.get(Number(id))!;
    return { p, qty, total: round2(p.price * qty) };
  });
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const firstAvailable = matches.findIndex((p) => p.quantity - (cart[p.id] ?? 0) > 0);

  // Same calculation the server uses (the server recalculates and has the final say).
  const t = computeSale({
    lines: lines.map((l) => ({
      price: l.p.price,
      quantity: l.qty,
      vatExempt: l.p.vatExempt,
      seniorEligible: l.p.seniorEligible,
    })),
    vatRegistered,
    discountType,
    discountValue: Number(discountValue) || 0,
    senior: !!senior,
    seniorUsedThisWeek: seniorId ? seniorUsed : 0,
  });
  const paid = amountPaid === "" ? t.total : Number(amountPaid) || 0;
  const change = round2(paid - t.total);
  const buyerOpen = showBuyer || t.total >= BUYER_INFO_THRESHOLD;
  const seniorIncomplete = senior !== null && (!senior.name.trim() || !senior.idNumber.trim());
  const eligibleInCart = round2(lines.filter((l) => l.p.seniorEligible).reduce((s, l) => s + l.total, 0));

  function reset() {
    setCart({});
    setDiscountValue("");
    setAmountPaid("");
    chooseCustomer("");
    setShowBuyer(false);
    setSenior(null);
    setError("");
  }

  function complete() {
    setError("");
    startTransition(async () => {
      const res = await completeSale({
        items: lines.map((l) => ({ productId: l.p.id, quantity: l.qty })),
        customerId: customerId ? Number(customerId) : null,
        discountType,
        discountValue: Number(discountValue) || 0,
        paymentMethod,
        amountPaid: paid,
        senior,
        buyer,
      });
      if (res.ok) router.push(invoiceHref(res.saleId));
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5 lg:h-[calc(100dvh-3rem)] lg:flex-row">
      {/* ───────────── Product picker ───────────── */}
      <section className="card flex min-h-[60vh] min-w-0 flex-1 flex-col overflow-hidden p-0 lg:min-h-0">
        <div className="space-y-3 border-b border-zinc-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search products, or scan a barcode and press Enter"
              className="input h-11 pr-10 pl-9"
            />
            <ScanLine className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-300" />
          </div>
          {categories.length > 0 && (
            <div className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {["", ...categories].map((c) => (
                <button
                  key={c || "all"}
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                    category === c
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                  }`}
                >
                  {c || "All"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {matches.map((p, i) => {
              const inCart = cart[p.id] ?? 0;
              const left = p.quantity - inCart;
              const low = p.quantity <= p.minStock;
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={left <= 0}
                  data-tour={i === firstAvailable ? "pos-product" : undefined}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl bg-white text-left ring-1 transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none ${
                    inCart ? "ring-2 ring-zinc-900" : "ring-zinc-200 hover:ring-zinc-300"
                  }`}
                >
                  <div className="relative aspect-[16/10] w-full bg-zinc-50">
                    {p.imagePath ? (
                      <img src={fileUrl(p.imagePath) ?? undefined} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center text-zinc-300">
                        <Package className="size-8" strokeWidth={1.25} />
                      </div>
                    )}
                    {inCart > 0 && (
                      <span className="absolute top-2 right-2 grid min-w-6 place-items-center rounded-full bg-zinc-900 px-1.5 text-xs font-semibold text-white tabular-nums shadow">
                        {inCart}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-[13px] leading-snug font-medium text-zinc-900">{p.name}</span>
                    <span className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <span className="text-[15px] font-semibold tracking-tight tabular-nums">{fmt(p.price)}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                          left <= 0
                            ? "bg-red-50 text-red-600"
                            : low
                              ? "bg-amber-50 text-amber-700"
                              : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {left <= 0 ? "Sold out" : `${left} left`}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {!matches.length && (
            <div className="grid place-items-center py-16 text-sm text-zinc-500">No products match “{search}”.</div>
          )}
        </div>
      </section>

      {/* ───────────── Cart & checkout ───────────── */}
      {/* Phones: a floating bar opens the cart as a full-screen sheet. */}
      {lines.length > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-[76px] z-30 flex h-14 items-center justify-between rounded-2xl bg-zinc-900 px-5 text-white shadow-xl shadow-zinc-900/30 lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShoppingBag className="size-4" /> View cart · {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="text-base font-semibold tabular-nums">{fmt(t.total)}</span>
        </button>
      )}

      <aside
        className={`${cartOpen ? "fixed inset-0 z-50 flex rounded-none" : "hidden"} card min-h-0 w-full shrink-0 flex-col overflow-hidden p-0 lg:static lg:z-auto lg:flex lg:w-[420px] lg:rounded-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="font-semibold tracking-tight">Current sale</h2>
            <p className="text-xs text-zinc-500">
              {vatRegistered ? `VAT-registered · prices include ${VAT_RATE}% VAT` : "Non-VAT"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {lines.length > 0 && (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-3.5" /> Clear
              </button>
            )}
            <button
              onClick={() => setCartOpen(false)}
              className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 lg:hidden"
              aria-label="Close cart"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Cart lines: the only part that grows; scrolls on its own */}
        <div className="scroll-thin min-h-[140px] flex-1 overflow-y-auto px-5" data-tour="pos-cart">
          {lines.length ? (
            <ul className="divide-y divide-zinc-100">
              {lines.map((l) => (
                <li key={l.p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.p.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                      <span className="tabular-nums">{fmt(l.p.price)}</span>
                      {vatRegistered && l.p.vatExempt && <Tag>VAT-exempt</Tag>}
                      {senior && l.p.seniorEligible && <Tag tone="amber">5% senior/PWD</Tag>}
                    </div>
                  </div>
                  <div className="flex items-center rounded-lg ring-1 ring-zinc-200">
                    <button
                      onClick={() => setQty(l.p.id, l.qty - 1)}
                      className="grid size-8 place-items-center text-zinc-500 hover:text-zinc-900"
                      aria-label="Decrease"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={l.p.quantity}
                      value={l.qty}
                      onChange={(e) => setQty(l.p.id, Number(e.target.value))}
                      className="w-9 [appearance:textfield] bg-transparent text-center text-sm font-medium tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => add(l.p)}
                      className="grid size-8 place-items-center text-zinc-500 hover:text-zinc-900"
                      aria-label="Increase"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums">{fmt(l.total)}</div>
                  <button
                    onClick={() => setQty(l.p.id, 0)}
                    className="text-zinc-300 transition hover:text-red-500"
                    aria-label={`Remove ${l.p.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid h-full min-h-[140px] place-items-center text-center">
              <div>
                <ShoppingBag className="mx-auto size-8 text-zinc-300" strokeWidth={1.25} />
                <p className="mt-2 text-sm text-zinc-500">Tap a product to add it</p>
              </div>
            </div>
          )}
        </div>

        {/* Options: capped height, scrolls separately so it never covers the cart */}
        <div className="scroll-thin max-h-[38%] shrink-0 space-y-3 overflow-y-auto border-t border-zinc-100 bg-zinc-50/70 px-5 py-4 text-sm">
          <select value={customerId} onChange={(e) => chooseCustomer(e.target.value)} className="input">
            <option value="">Walk-in customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
              </option>
            ))}
          </select>

          <Disclosure
            open={buyerOpen}
            onToggle={() => setShowBuyer(!showBuyer)}
            locked={t.total >= BUYER_INFO_THRESHOLD}
            title="Buyer name, address & TIN"
            hint={t.total >= BUYER_INFO_THRESHOLD ? `Needed for ${fmt(BUYER_INFO_THRESHOLD)}+ sales to VAT-registered buyers` : "Optional"}
          >
            <input
              value={buyer.name}
              onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
              placeholder="Registered name"
              className="input"
            />
            <input
              value={buyer.address}
              onChange={(e) => setBuyer({ ...buyer, address: e.target.value })}
              placeholder="Address"
              className="input"
            />
            <input
              value={buyer.tin}
              onChange={(e) => setBuyer({ ...buyer, tin: e.target.value })}
              placeholder="TIN (123-456-789-00000)"
              className="input"
            />
          </Disclosure>

          <div className="rounded-xl bg-white ring-1 ring-zinc-200" data-tour="pos-senior">
            <label className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
              <span>
                <span className="font-medium">Senior citizen / PWD</span>
                <span className="block text-xs text-zinc-500">5% off basic necessities</span>
              </span>
              <Switch
                on={senior !== null}
                onChange={(on) => setSenior(on ? { type: "senior", name: "", idNumber: "" } : null)}
              />
            </label>
            {senior && (
              <div className="space-y-2 border-t border-zinc-100 p-3">
                <div className="flex gap-2">
                  <select
                    value={senior.type}
                    onChange={(e) => setSenior({ ...senior, type: e.target.value as "senior" | "pwd" })}
                    className="input w-28"
                  >
                    <option value="senior">Senior</option>
                    <option value="pwd">PWD</option>
                  </select>
                  <input
                    value={senior.idNumber}
                    onChange={(e) => setSenior({ ...senior, idNumber: e.target.value })}
                    placeholder={senior.type === "senior" ? "OSCA / Senior ID no." : "PWD ID no."}
                    className="input"
                  />
                </div>
                <input
                  value={senior.name}
                  onChange={(e) => setSenior({ ...senior, name: e.target.value })}
                  placeholder="Name on ID"
                  className="input"
                />
                <div className="space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{
                        width: `${Math.min(100, (((seniorId ? seniorUsed : 0) + t.seniorEligible) / SENIOR_WEEKLY_PURCHASE_CAP) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 tabular-nums">
                    Eligible in cart {fmt(eligibleInCart)} · used this week {fmt(seniorId ? seniorUsed : 0)} of{" "}
                    {fmt(SENIOR_WEEKLY_PURCHASE_CAP)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex">
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="Discount"
                className="input rounded-r-none"
              />
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")}
                className="input w-16 rounded-l-none px-2"
                aria-label="Discount type"
              >
                <option value="amount">{currency}</option>
                <option value="percent">%</option>
              </select>
            </div>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input">
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Amount received (${t.total.toFixed(2)})`}
              className="input tabular-nums"
            />
            {paymentMethod === "Cash" && (
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Exact", value: "" },
                  ...[100, 500, 1000].map((n) => ({ label: fmt(n).replace(".00", ""), value: String(n) })),
                ].map((b) => (
                  <button
                    key={b.label}
                    onClick={() => setAmountPaid(b.value)}
                    className={`h-8 rounded-md text-xs font-medium ring-1 transition ${
                      amountPaid === b.value
                        ? "bg-zinc-900 text-white ring-zinc-900"
                        : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-100"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Totals + charge: always visible */}
        <div className="shrink-0 border-t border-zinc-200 px-5 pt-4 pb-5" data-tour="pos-charge">
          <dl className="space-y-1 text-sm tabular-nums">
            <Row label={`Subtotal · ${itemCount} item${itemCount === 1 ? "" : "s"}`} value={fmt(t.subtotal)} />
            {t.seniorDiscount > 0 && <Row label="Senior/PWD discount" value={`−${fmt(t.seniorDiscount)}`} accent />}
            {t.discount > 0 && <Row label="Discount" value={`−${fmt(t.discount)}`} accent />}
            {vatRegistered && lines.length > 0 && (
              <Row
                label={`VAT ${VAT_RATE}% (included)`}
                value={fmt(t.vat)}
                muted
                title={`VATable ${fmt(t.vatableSales)} · VAT-exempt ${fmt(t.vatExemptSales)}`}
              />
            )}
          </dl>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-sm text-zinc-500">Total</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{fmt(t.total)}</span>
          </div>
          {lines.length > 0 && (
            <div className={`mt-1 text-right text-sm tabular-nums ${change < 0 ? "text-red-600" : "text-zinc-500"}`}>
              {change < 0 ? `Short ${fmt(-change)}` : `Change ${fmt(change)}`}
            </div>
          )}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={complete}
            disabled={pending || !lines.length || change < 0 || seniorIncomplete}
            className="btn mt-4 h-12 w-full rounded-xl text-base"
          >
            {pending ? "Processing…" : lines.length ? `Charge ${fmt(t.total)}` : "Add items to charge"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Row(props: { label: string; value: string; accent?: boolean; muted?: boolean; title?: string }) {
  return (
    <div
      title={props.title}
      className={`flex justify-between ${props.accent ? "text-emerald-700" : props.muted ? "text-zinc-400" : "text-zinc-600"}`}
    >
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function Tag({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "amber" }) {
  return (
    <span
      className={`rounded px-1 py-px text-[10px] font-medium ${
        tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {children}
    </span>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-zinc-900" : "bg-zinc-200"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

function Disclosure(props: {
  open: boolean;
  locked: boolean;
  onToggle: () => void;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200">
      <button
        type="button"
        onClick={props.locked ? undefined : props.onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span>
          <span className="font-medium">{props.title}</span>
          <span className="block text-xs text-zinc-500">{props.hint}</span>
        </span>
        {!props.locked && (
          <ChevronDown className={`size-4 text-zinc-400 transition-transform ${props.open ? "rotate-180" : ""}`} />
        )}
      </button>
      {props.open && <div className="space-y-2 border-t border-zinc-100 p-3">{props.children}</div>}
    </div>
  );
}
