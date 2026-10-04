// Fills an EMPTY database with a month of connected demo data: npm run seed
// Rebuild the demo:  npm run seed -- --reset   (only works while the store is still the demo store)
//
// Everything is generated in time order so it all agrees: opening stock, weekly supplier
// deliveries, daily sales with invoices (some for customers), damaged stock, customer returns
// linked to invoices, cycle-count adjustments, and a few products left low or out of stock.
// With --with-tiktok it also adds sample TikTok Shop activity (listings and orders in every state).
// To remove the demo later: stop the app and delete the data/ folder.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, UPLOAD_DIR } from "../src/db";
import {
  customers,
  inventoryMovements,
  marketplaceListings,
  marketplaceOrders,
  products,
  saleItems,
  sales,
  settings,
  type MovementType,
} from "../src/db/schema";
import { round2 } from "../src/lib/format";
import { computeSale, startOfWeek, VAT_RATE } from "../src/lib/tax";

const WITH_TIKTOK = process.argv.includes("--with-tiktok");

const count = () =>
  ["products", "customers", "sales"].map((t) => (db.get(sql.raw(`select count(*) as n from ${t}`)) as { n: number }).n);

if (process.argv.includes("--reset") && count().some((n) => n > 0)) {
  const { businessName } = db.select().from(settings).where(eq(settings.id, 1)).get()!;
  if (!businessName.includes("(Demo)")) {
    console.log(`Refusing to reset: the store is "${businessName}", not the demo store. Real data is never wiped.`);
    process.exit(1);
  }
  db.transaction((tx) => {
    for (const t of ["marketplace_orders", "marketplace_listings", "inventory_movements", "sale_items", "sales", "products", "customers"]) {
      tx.run(sql.raw(`delete from ${t}`));
      tx.run(sql.raw(`delete from sqlite_sequence where name = '${t}'`));
    }
  });
  for (const file of fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []) {
    if (file.startsWith("demo-")) fs.rmSync(path.join(UPLOAD_DIR, file));
  }
  console.log("Old demo data removed.");
}

if (count().some((n) => n > 0)) {
  console.log("The database already has data, so the demo was not added (it only fills an empty database).");
  console.log("To rebuild the demo: npm run seed -- --reset");
  process.exit(0);
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

// Products also listed on TikTok Shop, and TikTok buyers (names + cities only, as TikTok provides).
const TIKTOK_SKUS = new Set([
  "BEV-003", "BEV-004", "BEV-005", "BEV-006", "SNK-001", "SNK-002", "SNK-003", "CAN-001", "CAN-003",
  "RCE-003", "HSE-002", "HSE-003", "PRS-001", "PRS-002", "PRS-003", "PRS-004",
]);
const TT_BUYERS = [
  "Kristine M.", "Joshua D.", "Angelica R.", "Mark Anthony P.", "Bea S.", "Jerome C.", "Patricia L.", "Ralph V.",
  "Nicole T.", "Kevin B.", "Camille G.", "Paolo F.", "Janine A.", "Christian O.", "Rica E.", "Miguel N.",
];
const TT_CITIES = ["Quezon City", "Makati City", "Pasig City", "Caloocan City", "Cebu City", "Davao City", "Taguig City", "Antipolo City"];

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

// ---------- simple product images (solid PNG tiles, one colour per category) ----------
const COLOURS: Record<string, [number, number, number]> = {
  Beverages: [37, 99, 235], Snacks: [234, 88, 12], "Canned Goods": [220, 38, 38], "Rice & Grains": [202, 138, 4],
  Condiments: [101, 163, 13], Household: [8, 145, 178], "Personal Care": [192, 38, 211],
};
// A soft pastel tile with a simple product "box" in the category colour.
function png(rgb: [number, number, number], variant: number) {
  const size = 160;
  const mix = (t: number) => rgb.map((v) => Math.round(v + (255 - v) * t));
  const bg = mix(0.9);
  const shadow = mix(0.78);
  const box = rgb;
  const lid = rgb.map((v) => Math.round(v * 0.82));
  const label = [255, 255, 255];
  const stripe = mix(0.55);
  // Rounded-rectangle hit test.
  const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  };
  const w = 30 + (variant % 3) * 6; // slightly different box widths per product
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let c = bg;
      if (((x - 80) / (w + 8)) ** 2 + ((y - 132) / 7) ** 2 <= 1) c = shadow;
      if (inRect(x, y, 80 - w, 34, 80 + w, 130, 10)) c = box;
      if (inRect(x, y, 80 - w, 34, 80 + w, 50, 10) && y <= 50) c = lid;
      if (inRect(x, y, 80 - w + 9, 70, 80 + w - 9, 104, 5)) c = label;
      if (inRect(x, y, 80 - w + 17, 80, 80 + w - 17, 85, 2) || inRect(x, y, 80 - w + 17, 90, 80 + w - 28, 94, 2)) c = stripe;
      raw.set(c, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- timeline ----------
const now = new Date();
function at(daysAgo: number, hour: number, minute = int(0, 59)) {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, int(0, 59), 0);
  return d;
}

type Event =
  | { when: Date; kind: "opening" }
  | { when: Date; kind: "restock"; ref: string; supplier: string }
  | { when: Date; kind: "sale" }
  | { when: Date; kind: "tiktok"; problem?: boolean }
  | { when: Date; kind: "damaged" | "out" | "adjust" | "return" | "archive" };

const events: Event[] = [{ when: at(DAYS, 7, 30), kind: "opening" }];
for (let d = DAYS - 1; d >= 0; d--) {
  const day = at(d, 12);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  const count = int(weekend ? 7 : 4, weekend ? 12 : 9);
  for (let i = 0; i < count; i++) {
    if (d === 0) {
      // Today: spread sales over the hours before now (whatever time the seed runs),
      // so the dashboard's "Today's sales" always has data.
      const since = Math.min(now.getTime() - new Date(now).setHours(0, 0, 0, 0), 10 * 3600_000);
      events.push({ when: new Date(now.getTime() - 5 * 60_000 - rand() * Math.max(since - 5 * 60_000, 0)), kind: "sale" });
    } else {
      events.push({ when: at(d, int(8, 20)), kind: "sale" });
    }
  }
  // TikTok orders arrive around the clock: a few a day, more on weekends.
  for (let i = WITH_TIKTOK ? int(weekend ? 2 : 1, weekend ? 6 : 4) : 0; i > 0; i--) {
    const when = d === 0 ? new Date(now.getTime() - rand() * (now.getTime() - new Date(now).setHours(0, 0, 0, 0))) : at(d, int(0, 23));
    events.push({ when, kind: "tiktok" });
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
if (WITH_TIKTOK) events.push({ when: at(1, 14), kind: "tiktok", problem: true }); // a TikTok-only bundle nobody linked yet
events.sort((a, b) => a.when.getTime() - b.when.getTime());

// ---------- write everything ----------
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const PAYMENT = ["Cash", "Cash", "Cash", "Cash", "Cash", "Cash", "E-wallet", "E-wallet", "Card", "Bank transfer"];
const year = now.getFullYear();
let invoiceSeq = 0;
const stats = { sales: 0, movements: 0, revenue: 0, tiktok: 0 };

db.transaction((tx) => {
  tx.update(settings)
    .set({
      businessName: "Mendoza Mini Mart (Demo)",
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
    // Content hash in the name: images are served with long-lived caching.
    const data = png(COLOURS[p.category], i);
    const image = `demo-${p.sku.toLowerCase()}-${createHash("sha1").update(data).digest("hex").slice(0, 8)}.png`;
    fs.writeFileSync(path.join(UPLOAD_DIR, image), data);
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

  // TikTok listings: each linked to our product by SKU, plus one TikTok-only bundle left unlinked.
  const ttItems = WITH_TIKTOK ? items.filter((p) => TIKTOK_SKUS.has(p.sku)) : [];
  ttItems.forEach((p, i) => {
    tx.insert(marketplaceListings)
      .values({
        channel: "tiktok", externalProductId: `17299${String(830000000000 + i * 7331)}`,
        externalSkuId: `17299${String(840000000000 + i * 7331)}`, sellerSku: p.sku, title: p.name, status: "ACTIVATE",
        warehouseId: "7298011203412345678", productId: p.id,
      })
      .run();
  });
  if (WITH_TIKTOK) tx.insert(marketplaceListings)
    .values({
      channel: "tiktok", externalProductId: "1729983999999999999", externalSkuId: "1729984999999999999",
      sellerSku: "TT-BUNDLE-01", title: "Merienda Bundle (TikTok exclusive)", status: "ACTIVATE",
    })
    .run();
  let ttSeq = 0;

  function move(id: number, type: MovementType, change: number, when: Date, note: string, saleId?: number) {
    const after = stock.get(id)! + change;
    if (after < 0) throw new Error(`demo bug: negative stock for ${id}`);
    stock.set(id, after);
    byId.get(id)!.lastChange = when.toISOString();
    tx.insert(inventoryMovements)
      .values({ productId: id, type, quantityChange: change, quantityAfter: after, note, saleId, createdAt: when.toISOString() })
      .run();
    stats.movements++;
  }

  const pastSales: { id: number; invoice: string; lines: { productId: number; quantity: number }[] }[] = [];

  for (const e of events) {
    if (e.kind === "opening") {
      for (const p of items) move(p.id, "in", p.opening, e.when, "Opening stock");
    } else if (e.kind === "restock") {
      // Top up anything below twice its minimum (except the ones left to run out).
      for (const p of items) {
        if (!p.active || p.noRestock) continue;
        const target = p.opening;
        if (stock.get(p.id)! < p.min * 2) move(p.id, "in", target - stock.get(p.id)!, e.when, `${e.ref} from ${e.supplier}`);
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
      stats.sales++;
      stats.revenue += total;
    } else if (e.kind === "tiktok") {
      const orderId = `5781${String(20000000000000 + ++ttSeq * 7919113).slice(0, 14)}`;
      const buyer = pick(TT_BUYERS);
      const record = (status: string, total: number, extra: { saleId?: number; problem?: string } = {}) =>
        tx.insert(marketplaceOrders)
          .values({
            channel: "tiktok", externalOrderId: orderId, status, orderCreatedAt: new Date(e.when.getTime() - 4 * 60_000).toISOString(),
            total, buyerName: buyer, saleId: extra.saleId ?? null, problem: extra.problem ?? "", updatedAt: e.when.toISOString(),
          })
          .run();
      if (e.problem) {
        record("AWAITING_SHIPMENT", 199, { problem: "Not linked to a product: Merienda Bundle (TikTok exclusive) (SKU TT-BUNDLE-01)" });
        continue;
      }
      const available = ttItems.filter((p) => p.active && stock.get(p.id)! > 0);
      const lines: { p: (typeof items)[number]; quantity: number; price: number }[] = [];
      for (let n = int(1, 3); n > 0 && available.length; n--) {
        const p = weighted(available, (x) => x.popularity);
        available.splice(available.indexOf(p), 1);
        // TikTok vouchers: some items sell a little below the shelf price.
        const price = round2(rand() < 0.3 ? p.price * pick([0.9, 0.95]) : p.price);
        lines.push({ p, quantity: Math.min(int(1, 2), stock.get(p.id)!), price });
      }
      if (!lines.length) continue;
      const orderTotal = round2(lines.reduce((t, l) => t + l.price * l.quantity, 0));

      // Status follows the order's age, like a real shop.
      const age = (now.getTime() - e.when.getTime()) / 86_400_000;
      const r = rand();
      const cancelled = r < 0.06;
      if (!cancelled && age < 0.5 && r < 0.2) {
        record("UNPAID", orderTotal);
        continue;
      }
      if (cancelled && r < 0.03) {
        record("CANCELLED", orderTotal); // cancelled before payment: never became a sale
        continue;
      }
      const status = cancelled ? "CANCELLED"
        : age >= 7 ? "COMPLETED" : age >= 3 ? "DELIVERED" : age >= 1 ? "IN_TRANSIT"
        : r < 0.6 ? "AWAITING_SHIPMENT" : "AWAITING_COLLECTION";

      const t = computeSale({
        lines: lines.map((l) => ({ price: l.price, quantity: l.quantity, vatExempt: VAT_EXEMPT.has(l.p.sku), seniorEligible: false })),
        vatRegistered: true, discountType: "amount", discountValue: 0, senior: false, seniorUsedThisWeek: 0,
      });
      const invoice = `INV-${year}-${String(++invoiceSeq).padStart(6, "0")}`;
      const sale = tx
        .insert(sales)
        .values({
          invoiceNumber: invoice, customerId: null, subtotal: t.subtotal, discount: 0, taxMode: "vat", taxRate: VAT_RATE,
          tax: t.vat, vatableSales: t.vatableSales, vatExemptSales: t.vatExemptSales, total: t.total,
          paymentMethod: "TikTok Shop", amountPaid: t.total, change: 0, buyerName: buyer, buyerAddress: pick(TT_CITIES),
          channel: "tiktok", externalOrderId: orderId, createdAt: e.when.toISOString(),
          cancelledAt: cancelled ? new Date(e.when.getTime() + 3 * 3600_000).toISOString() : null,
        })
        .returning({ id: sales.id })
        .get();
      for (const l of lines) {
        tx.insert(saleItems)
          .values({
            saleId: sale.id, productId: l.p.id, name: l.p.name, sku: l.p.sku, quantity: l.quantity,
            unitPrice: l.price, lineTotal: round2(l.price * l.quantity),
          })
          .run();
        move(l.p.id, "sale", -l.quantity, e.when, `${invoice} · TikTok ${orderId}`, sale.id);
        if (cancelled) {
          move(l.p.id, "return", l.quantity, new Date(e.when.getTime() + 3 * 3600_000), `TikTok order ${orderId} cancelled (${invoice})`, sale.id);
        }
      }
      record(status, orderTotal, { saleId: sale.id });
      if (!cancelled) {
        stats.tiktok++;
        stats.revenue += t.total;
      }
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

  for (const p of ttItems) {
    tx.update(marketplaceListings).set({ externalQuantity: stock.get(p.id)! }).where(eq(marketplaceListings.productId, p.id)).run();
  }
  for (const p of items) {
    tx.update(products)
      .set({ quantity: stock.get(p.id)!, archived: !!p.archived, updatedAt: p.lastChange })
      .where(eq(products.id, p.id))
      .run();
  }
});

const low = db.all(sql`select name, quantity, min_stock from products where archived = 0 and quantity <= min_stock`) as {
  name: string; quantity: number; min_stock: number;
}[];
console.log(`Demo data added:
  ${CATALOGUE.length} products (1 archived) with images, ${CUSTOMERS.length} customers
  ${stats.sales} in-store sales + ${stats.tiktok} TikTok orders over ${DAYS} days, revenue ₱${stats.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
  ${stats.movements} inventory movements
  Low/out of stock now: ${low.map((l) => `${l.name} (${l.quantity})`).join(", ") || "none"}`);
