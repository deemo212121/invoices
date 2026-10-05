// "Try with demo data": fills an empty store with a month of connected demo data, in the browser.
//
// Everything is generated in time order so it all agrees: opening stock, weekly supplier
// deliveries, daily sales with invoices (some for customers), damaged stock, customer returns
// linked to invoices, cycle-count adjustments, and a few products left low or out of stock.
// To remove it later: Settings → Backup & Restore → Start over.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, inventoryMovements, products, saleItems, sales, settings, type MovementType } from "@/db/schema";
import { putFile } from "./files";
import { round2 } from "./format";
import { computeSale, startOfWeek, VAT_RATE } from "./tax";

export const DEMO_BUSINESS = "Mendoza Mini Mart (Demo)";

/** True while the store has no products, customers or sales. */
export function storeIsEmpty() {
  return ["products", "customers", "sales"].every(
    (t) => (db.get(sql.raw(`select count(*) as n from ${t}`)) as { n: number }).n === 0,
  );
}


// ---------- deterministic randomness, so every run gives the same demo ----------
let seed = 20261004;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
function weighted<T>(items: T[], weight: (t: T) => number) {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rand() * total;
  for (const i of items) if ((r -= weight(i)) <= 0) return i;
  return items[items.length - 1];
}

// ---------- catalogue ----------
type Demo = {
  sku: string; name: string; category: string; brand: string; cost: number; price: number;
  min: number; opening: number; popularity: number; description?: string;
  noRestock?: boolean; // left to run low / out, so the dashboard has something to show
  archived?: boolean;
};

const CATALOGUE: Demo[] = [
  { sku: "BEV-001", name: "Purified Water 500ml", category: "Beverages", brand: "AquaFresh", cost: 8, price: 15, min: 24, opening: 120, popularity: 10 },
  { sku: "BEV-002", name: "Purified Water 1L", category: "Beverages", brand: "AquaFresh", cost: 14, price: 25, min: 12, opening: 60, popularity: 5 },
  { sku: "BEV-003", name: "Cola Soda 1.5L", category: "Beverages", brand: "FizzUp", cost: 55, price: 75, min: 12, opening: 48, popularity: 8 },
  { sku: "BEV-004", name: "Orange Juice Drink 1L", category: "Beverages", brand: "Sunny Grove", cost: 48, price: 69, min: 8, opening: 30, popularity: 4 },
  { sku: "BEV-005", name: "Instant Coffee 3-in-1 (10 sachets)", category: "Beverages", brand: "Kape Uno", cost: 68, price: 95, min: 10, opening: 25, popularity: 7, noRestock: true },
  { sku: "BEV-006", name: "Energy Drink 250ml", category: "Beverages", brand: "Volt", cost: 22, price: 35, min: 12, opening: 48, popularity: 5 },
  { sku: "SNK-001", name: "Potato Chips Original 60g", category: "Snacks", brand: "Crispy Co", cost: 24, price: 38, min: 12, opening: 50, popularity: 7 },
  { sku: "SNK-002", name: "Chocolate Bar 40g", category: "Snacks", brand: "Cocoa Bay", cost: 20, price: 32, min: 15, opening: 60, popularity: 6 },
  { sku: "SNK-003", name: "Peanuts Garlic 100g", category: "Snacks", brand: "Mani Mani", cost: 18, price: 29, min: 10, opening: 40, popularity: 4 },
  { sku: "SNK-004", name: "Cream Crackers 250g", category: "Snacks", brand: "Biskwit", cost: 35, price: 52, min: 8, opening: 30, popularity: 4 },
  { sku: "CAN-001", name: "Corned Beef 150g", category: "Canned Goods", brand: "Rancho", cost: 38, price: 55, min: 12, opening: 48, popularity: 6 },
  { sku: "CAN-002", name: "Sardines in Tomato Sauce 155g", category: "Canned Goods", brand: "Dagat", cost: 19, price: 28, min: 24, opening: 96, popularity: 9 },
  { sku: "CAN-003", name: "Tuna Flakes in Oil 180g", category: "Canned Goods", brand: "Dagat", cost: 32, price: 45, min: 12, opening: 48, popularity: 5 },
  { sku: "CAN-004", name: "Luncheon Meat 340g", category: "Canned Goods", brand: "Rancho", cost: 92, price: 125, min: 6, opening: 24, popularity: 3 },
  { sku: "RCE-001", name: "Well-Milled Rice 5kg", category: "Rice & Grains", brand: "Bukid Gold", cost: 245, price: 290, min: 5, opening: 20, popularity: 4, description: "Premium well-milled white rice." },
  { sku: "RCE-002", name: "Instant Noodles Chicken 55g", category: "Rice & Grains", brand: "Mami Express", cost: 9, price: 14, min: 30, opening: 150, popularity: 10 },
  { sku: "RCE-003", name: "Instant Pancit Canton 60g", category: "Rice & Grains", brand: "Mami Express", cost: 11, price: 17, min: 30, opening: 120, popularity: 8 },
  { sku: "CON-001", name: "Soy Sauce 1L", category: "Condiments", brand: "Toyo King", cost: 42, price: 58, min: 6, opening: 24, popularity: 3 },
  { sku: "CON-002", name: "Cane Vinegar 1L", category: "Condiments", brand: "Toyo King", cost: 32, price: 45, min: 6, opening: 24, popularity: 3 },
  { sku: "CON-003", name: "Cooking Oil 1L", category: "Condiments", brand: "Golden Palm", cost: 85, price: 110, min: 6, opening: 24, popularity: 4 },
  { sku: "CON-004", name: "Iodized Salt 500g", category: "Condiments", brand: "Asin Pure", cost: 12, price: 20, min: 6, opening: 20, popularity: 2 },
  { sku: "HSE-001", name: "Dishwashing Liquid 250ml", category: "Household", brand: "Sparkle", cost: 38, price: 55, min: 6, opening: 18, popularity: 4, noRestock: true },
  { sku: "HSE-002", name: "Laundry Powder 1kg", category: "Household", brand: "Puti Max", cost: 95, price: 128, min: 6, opening: 24, popularity: 3 },
  { sku: "HSE-003", name: "Bath Tissue 4 rolls", category: "Household", brand: "SoftTouch", cost: 52, price: 72, min: 6, opening: 24, popularity: 3 },
  { sku: "HSE-004", name: "Disposable Lighter", category: "Household", brand: "Flick", cost: 9, price: 18, min: 10, opening: 40, popularity: 3 },
  { sku: "PRS-001", name: "Shampoo Sachet 12ml (6-pack)", category: "Personal Care", brand: "Silky", cost: 30, price: 45, min: 10, opening: 40, popularity: 5 },
  { sku: "PRS-002", name: "Bath Soap 135g", category: "Personal Care", brand: "Fresh Day", cost: 34, price: 48, min: 8, opening: 36, popularity: 4 },
  { sku: "PRS-003", name: "Toothpaste 150g", category: "Personal Care", brand: "Ngiti", cost: 68, price: 89, min: 6, opening: 24, popularity: 3, noRestock: true },
  { sku: "PRS-004", name: "Alcohol 70% 250ml", category: "Personal Care", brand: "Linis", cost: 45, price: 65, min: 6, opening: 20, popularity: 2 },
  // Discontinued: sold early in the month, then archived.
  { sku: "OLD-001", name: "Orange Soda 1L (discontinued)", category: "Beverages", brand: "FizzUp", cost: 38, price: 55, min: 0, opening: 12, popularity: 6, noRestock: true, archived: true },
];

// VAT-exempt: unprocessed agricultural products such as rice.
const VAT_EXEMPT = new Set(["RCE-001"]);
// Basic necessities & prime commodities: senior citizen / PWD 5% discount.
const SENIOR_ELIGIBLE = new Set([
  "BEV-001", "BEV-002", "BEV-005", "CAN-001", "CAN-002", "CAN-003", "CAN-004", "RCE-001", "RCE-002", "RCE-003",
  "CON-001", "CON-002", "CON-003", "CON-004", "HSE-002", "PRS-002",
]);

type DemoCustomer = {
  name: string; phone: string; email: string; address: string; notes: string; regular: number;
  tin?: string; senior?: { type: "senior" | "pwd"; id: string }; bulk?: boolean;
};

const CUSTOMERS: DemoCustomer[] = [
  { name: "Maria Santos", phone: "0917 555 0101", email: "maria.santos@example.com", address: "12 Rizal St., Brgy. San Isidro", notes: "Regular. Prefers e-wallet.", regular: 6 },
  { name: "Jose Reyes", phone: "0918 555 0202", email: "", address: "45 Mabini Ave.", notes: "Senior citizen.", regular: 4, senior: { type: "senior", id: "QC-OSCA-0012345" } },
  { name: "Ana Cruz", phone: "0919 555 0303", email: "ana.cruz@example.com", address: "7 Bonifacio St.", notes: "Buys rice every week.", regular: 5 },
  { name: "Carlo Mendoza", phone: "0920 555 0404", email: "carlo.m@example.com", address: "88 Luna St.", notes: "", regular: 3 },
  { name: "Liza Villanueva", phone: "0921 555 0505", email: "", address: "3 Aguinaldo St.", notes: "Carinderia owner. Bulk canned goods.", regular: 4, tin: "234-567-890-00000", bulk: true },
  { name: "Ramon Garcia", phone: "0922 555 0606", email: "ramon.garcia@example.com", address: "21 Del Pilar St.", notes: "", regular: 2 },
  { name: "Grace Tan", phone: "0923 555 0707", email: "grace.tan@example.com", address: "150 Quezon Blvd.", notes: "Pays by card.", regular: 2 },
  { name: "Paolo Lim", phone: "0924 555 0808", email: "", address: "9 Burgos St.", notes: "", regular: 1 },
  { name: "Joy Ramos", phone: "0925 555 0909", email: "joy.ramos@example.com", address: "64 Jacinto St.", notes: "", regular: 2 },
  { name: "Mark Bautista", phone: "0926 555 1010", email: "", address: "", notes: "Office supplies run on Fridays.", regular: 1 },
  { name: "Tess Aquino", phone: "0927 555 1111", email: "tess.aquino@example.com", address: "5 Silang St.", notes: "PWD.", regular: 2, senior: { type: "pwd", id: "PWD-137404-000123" } },
  { name: "Ben Navarro", phone: "0928 555 1212", email: "", address: "33 Lapu-Lapu St.", notes: "Sari-sari store reseller.", regular: 3, tin: "345-678-901-00000", bulk: true },
];

const SUPPLIERS = ["Metro Wholesale", "Northstar Distributors", "Golden Grocery Supply"];
const DAYS = 30;

// ---------- simple product images: a pastel tile with a product "box" in the category colour ----------
const COLOURS: Record<string, [number, number, number]> = {
  Beverages: [37, 99, 235], Snacks: [234, 88, 12], "Canned Goods": [220, 38, 38], "Rice & Grains": [202, 138, 4],
  Condiments: [101, 163, 13], Household: [8, 145, 178], "Personal Care": [192, 38, 211],
};

function tile(rgb: [number, number, number], variant: number) {
  const mix = (t: number) => `rgb(${rgb.map((v) => Math.round(v + (255 - v) * t)).join(",")})`;
  const dark = `rgb(${rgb.map((v) => Math.round(v * 0.82)).join(",")})`;
  const w = 30 + (variant % 3) * 6; // slightly different box widths per product
  const x = 80 - w;
  return new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">` +
      `<rect width="160" height="160" fill="${mix(0.9)}"/>` +
      `<ellipse cx="80" cy="132" rx="${w + 8}" ry="7" fill="${mix(0.78)}"/>` +
      `<rect x="${x}" y="34" width="${w * 2}" height="96" rx="10" fill="rgb(${rgb.join(",")})"/>` +
      `<path d="M${x} 50V44a10 10 0 0 1 10-10h${w * 2 - 20}a10 10 0 0 1 10 10v6z" fill="${dark}"/>` +
      `<rect x="${x + 9}" y="70" width="${w * 2 - 18}" height="34" rx="5" fill="#fff"/>` +
      `<rect x="${x + 17}" y="80" width="${w * 2 - 34}" height="5" rx="2" fill="${mix(0.55)}"/>` +
      `<rect x="${x + 17}" y="90" width="${w * 2 - 45}" height="4" rx="2" fill="${mix(0.55)}"/>` +
      `</svg>`,
  );
}

type Event =
  | { when: Date; kind: "opening" }
  | { when: Date; kind: "restock"; ref: string; supplier: string }
  | { when: Date; kind: "sale" }
  | { when: Date; kind: "damaged" | "out" | "adjust" | "return" | "archive" };

/** Adds the demo store. Only runs on an empty store; real data is never touched. */
export function loadDemo() {
  if (!storeIsEmpty()) throw new Error("The demo can only be added to an empty store.");
  seed = 20261004; // same demo every time

  // ---------- timeline ----------
  const now = new Date();
  const at = (daysAgo: number, hour: number, minute = int(0, 59)) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, int(0, 59), 0);
    return d;
  };

  const events: Event[] = [{ when: at(DAYS, 7, 30), kind: "opening" }];
  for (let d = DAYS - 1; d >= 0; d--) {
    const day = at(d, 12);
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const count = int(weekend ? 7 : 4, weekend ? 12 : 9);
    for (let i = 0; i < count; i++) {
      if (d === 0) {
        // Today: spread sales over the hours before now, so "Today's sales" always has data.
        const since = Math.min(now.getTime() - new Date(now).setHours(0, 0, 0, 0), 10 * 3600_000);
        events.push({ when: new Date(now.getTime() - 5 * 60_000 - rand() * Math.max(since - 5 * 60_000, 0)), kind: "sale" });
      } else {
        events.push({ when: at(d, int(8, 20)), kind: "sale" });
      }
    }
    if (d % 7 === 2 && d < DAYS - 1) {
      events.push({ when: at(d, 7, 15), kind: "restock", ref: `DR-${1040 + (DAYS - d)}`, supplier: pick(SUPPLIERS) });
    }
  }
  for (const d of [26, 19, 12, 5, 1]) events.push({ when: at(d, int(9, 18)), kind: "damaged" });
  for (const d of [22, 15, 8, 2]) events.push({ when: at(d, int(9, 18)), kind: "return" });
  for (const d of [20, 6]) events.push({ when: at(d, 21, 0), kind: "adjust" });
  for (const d of [17, 4]) events.push({ when: at(d, int(9, 18)), kind: "out" });
  events.push({ when: at(18, 21, 30), kind: "archive" });
  events.sort((a, b) => a.when.getTime() - b.when.getTime());

  // ---------- write everything ----------
  const PAYMENT = ["Cash", "Cash", "Cash", "Cash", "Cash", "Cash", "E-wallet", "E-wallet", "Card", "Bank transfer"];
  const year = now.getFullYear();
  let invoiceSeq = 0;

  db.transaction((tx) => {
    tx.update(settings)
      .set({
        businessName: DEMO_BUSINESS,
        address: "12 Rizal St., Brgy. San Isidro\nQuezon City, Metro Manila",
        phone: "0917 555 0000",
        email: "hello@mendozaminimart.example",
        taxId: "123-456-789-00000",
        vatRegistered: true,
        currencySymbol: "₱",
        invoiceFooter: "Salamat po! Please keep this invoice for returns within 7 days.",
      })
      .where(eq(settings.id, 1))
      .run();

    const startIso = at(DAYS, 7, 0).toISOString();
    const custRows = CUSTOMERS.map(({ regular, senior, bulk, ...c }, i) => ({
      ...tx.insert(customers).values({ ...c, createdAt: at(DAYS - Math.min(i, 20), 9).toISOString() }).returning().get(),
      regular,
      senior,
      bulk,
    }));
    const seniorUsed = new Map<string, number>(); // "<id>|<week start>" -> eligible purchases

    const stock = new Map<number, number>();
    const items = CATALOGUE.map((p, i) => {
      const image = `demo-${p.sku.toLowerCase()}.svg`;
      putFile({ name: image, type: "image/svg+xml", data: tile(COLOURS[p.category], i) });
      const row = tx
        .insert(products)
        .values({
          sku: p.sku,
          barcode: `480${String(1000000000 + i * 7919).slice(0, 10)}`,
          name: p.name,
          description: p.description ?? "",
          category: p.category,
          brand: p.brand,
          costPrice: p.cost,
          sellingPrice: p.price,
          quantity: 0,
          minStock: p.min,
          vatExempt: VAT_EXEMPT.has(p.sku),
          seniorEligible: SENIOR_ELIGIBLE.has(p.sku),
          imagePath: image,
          createdAt: startIso,
          updatedAt: startIso,
        })
        .returning()
        .get();
      stock.set(row.id, 0);
      return { ...p, id: row.id, active: true, lastChange: startIso };
    });
    const byId = new Map(items.map((i) => [i.id, i]));

    function move(id: number, type: MovementType, change: number, when: Date, note: string, saleId?: number) {
      const after = stock.get(id)! + change;
      if (after < 0) throw new Error(`demo bug: negative stock for ${id}`);
      stock.set(id, after);
      byId.get(id)!.lastChange = when.toISOString();
      tx.insert(inventoryMovements)
        .values({ productId: id, type, quantityChange: change, quantityAfter: after, note, saleId, createdAt: when.toISOString() })
        .run();
    }

    const pastSales: { id: number; invoice: string; lines: { productId: number; quantity: number }[] }[] = [];

    for (const e of events) {
      if (e.kind === "opening") {
        for (const p of items) move(p.id, "in", p.opening, e.when, "Opening stock");
      } else if (e.kind === "restock") {
        // Top up anything below twice its minimum (except the ones left to run out).
        for (const p of items) {
          if (!p.active || p.noRestock) continue;
          if (stock.get(p.id)! < p.min * 2) move(p.id, "in", p.opening - stock.get(p.id)!, e.when, `${e.ref} from ${e.supplier}`);
        }
      } else if (e.kind === "sale") {
        const customer = rand() < 0.4 ? weighted(custRows, (c) => c.regular) : null;
        const available = items.filter((p) => p.active && stock.get(p.id)! > 0);
        const lines: { p: (typeof items)[number]; quantity: number }[] = [];
        for (let n = int(1, 4) + (customer?.bulk ? 2 : 0); n > 0 && available.length; n--) {
          const p = weighted(available, (x) => x.popularity);
          available.splice(available.indexOf(p), 1);
          let want = p.category === "Beverages" || p.sku.startsWith("RCE-00") ? int(1, 6) : int(1, 3);
          if (customer?.bulk) want *= 4; // resellers and carinderias buy in bulk
          lines.push({ p, quantity: Math.min(want, stock.get(p.id)!) });
        }
        if (!lines.length) continue;

        // Senior / PWD customers usually present their ID; the weekly cap is tracked per ID.
        const senior = customer?.senior && rand() < 0.8 ? customer.senior : null;
        const capKey = senior ? `${senior.id}|${startOfWeek(e.when).toISOString()}` : "";
        const r = rand();
        const t = computeSale({
          lines: lines.map((l) => ({
            price: l.p.price,
            quantity: l.quantity,
            vatExempt: VAT_EXEMPT.has(l.p.sku),
            seniorEligible: SENIOR_ELIGIBLE.has(l.p.sku),
          })),
          vatRegistered: true,
          discountType: r < 0.06 ? "percent" : "amount",
          discountValue: r < 0.06 ? 5 : r < 0.1 ? 20 : 0,
          senior: !!senior,
          seniorUsedThisWeek: seniorUsed.get(capKey) ?? 0,
        });
        const useSenior = !!senior && t.seniorEligible > 0;
        if (useSenior) seniorUsed.set(capKey, (seniorUsed.get(capKey) ?? 0) + t.seniorEligible);
        const total = t.total;
        const method = customer?.name === "Grace Tan" ? "Card" : pick(PAYMENT);
        // Cash customers hand over a round amount: next 20, 50, 100 or 500.
        const note = pick([20, 50, 100, 100, 500]);
        const paid = method === "Cash" ? Math.ceil(total / note) * note : total;
        const amountPaid = Math.max(round2(paid), total);
        const invoice = `INV-${year}-${String(++invoiceSeq).padStart(6, "0")}`;

        const sale = tx
          .insert(sales)
          .values({
            invoiceNumber: invoice, customerId: customer?.id ?? null, subtotal: t.subtotal, discount: t.discount,
            taxMode: "vat", taxRate: VAT_RATE, tax: t.vat, vatableSales: t.vatableSales, vatExemptSales: t.vatExemptSales,
            seniorDiscount: useSenior ? t.seniorDiscount : 0, seniorEligible: useSenior ? t.seniorEligible : 0,
            seniorType: useSenior ? senior!.type : null, seniorName: useSenior ? customer!.name : "",
            seniorIdNumber: useSenior ? senior!.id : "",
            buyerName: customer?.name ?? "", buyerAddress: customer?.address ?? "", buyerTin: customer?.tin ?? "",
            total, paymentMethod: method, amountPaid, change: round2(amountPaid - total), createdAt: e.when.toISOString(),
          })
          .returning({ id: sales.id })
          .get();
        for (const l of lines) {
          tx.insert(saleItems)
            .values({
              saleId: sale.id, productId: l.p.id, name: l.p.name, sku: l.p.sku, quantity: l.quantity,
              unitPrice: l.p.price, lineTotal: round2(l.p.price * l.quantity),
            })
            .run();
          move(l.p.id, "sale", -l.quantity, e.when, invoice, sale.id);
        }
        pastSales.push({ id: sale.id, invoice, lines: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity })) });
      } else if (e.kind === "damaged") {
        const p = weighted(items.filter((x) => x.active && stock.get(x.id)! > 2), (x) => x.popularity);
        const reason = p.category === "Canned Goods" ? "Dented cans" : p.category === "Beverages" ? "Broken/leaking bottles" : "Torn packaging";
        move(p.id, "damaged", -int(1, 2), e.when, reason);
      } else if (e.kind === "return") {
        // A recent invoice's item comes back (only products still sold).
        const candidates = pastSales
          .slice(-25)
          .flatMap((s) => s.lines.filter((l) => byId.get(l.productId)!.active).map((l) => ({ s, l })));
        if (!candidates.length) continue;
        const { s, l } = pick(candidates);
        const reason = pick(["wrong variant", "changed mind", "duplicate purchase"]);
        move(l.productId, "return", 1, e.when, `Customer return, ${s.invoice}: ${reason}`);
      } else if (e.kind === "adjust") {
        const p = pick(items.filter((x) => x.active && stock.get(x.id)! > 5));
        move(p.id, "adjustment", pick([-2, -1, 1]), e.when, "Monthly cycle count");
      } else if (e.kind === "out") {
        const p = pick(items.filter((x) => x.active && x.category === "Household" && stock.get(x.id)! > 3));
        move(p.id, "out", -1, e.when, "Store use (cleaning)");
      } else if (e.kind === "archive") {
        for (const p of items.filter((x) => x.archived)) {
          if (stock.get(p.id)! > 0) move(p.id, "out", -stock.get(p.id)!, e.when, "Returned to supplier (discontinued)");
          p.active = false;
        }
      }
    }

    for (const p of items) {
      tx.update(products)
        .set({ quantity: stock.get(p.id)!, archived: !!p.archived, updatedAt: p.lastChange })
        .where(eq(products.id, p.id))
        .run();
    }
  });
}
