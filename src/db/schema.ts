import { sql } from "drizzle-orm";
import { blob, integer, real, sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

// Single-row table holding business info shown on invoices.
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  businessName: text("business_name").notNull().default("My Business"),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  taxId: text("tax_id").notNull().default(""), // TIN with branch code
  // VAT-registered businesses show VAT on invoices; non-VAT businesses do not.
  vatRegistered: integer("vat_registered", { mode: "boolean" }).notNull().default(false),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  invoiceFooter: text("invoice_footer").notNull().default("Thank you for your business!"),
  // Printing: invoice paper (a4 | 80mm | 58mm) and barcode label stock (see src/lib/labels.ts).
  invoicePaper: text("invoice_paper").notNull().default("a4"),
  labelFormat: text("label_format").notNull().default("a4-3x8"),
  // Unused since the app moved into the browser (kept so older backups still restore).
  ownerPasswordHash: text("owner_password_hash").notNull().default(""),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull().unique(),
    barcode: text("barcode"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    brand: text("brand").notNull().default(""),
    costPrice: real("cost_price").notNull().default(0),
    sellingPrice: real("selling_price").notNull().default(0),
    quantity: integer("quantity").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    vatExempt: integer("vat_exempt", { mode: "boolean" }).notNull().default(false),
    // Basic necessity / prime commodity: eligible for the senior citizen & PWD 5% discount.
    seniorEligible: integer("senior_eligible", { mode: "boolean" }).notNull().default(false),
    imagePath: text("image_path"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("products_name_idx").on(t.name), index("products_barcode_idx").on(t.barcode)],
);

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  tin: text("tin").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
});

export const TAX_MODES = ["added", "vat", "nonvat"] as const;
export type TaxMode = (typeof TAX_MODES)[number];

export const sales = sqliteTable(
  "sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    invoiceNumber: text("invoice_number").notNull().unique(),
    customerId: integer("customer_id").references(() => customers.id),
    subtotal: real("subtotal").notNull(),
    discount: real("discount").notNull().default(0),
    taxRate: real("tax_rate").notNull().default(0),
    tax: real("tax").notNull().default(0),
    total: real("total").notNull(),
    paymentMethod: text("payment_method").notNull(),
    // How tax was handled when the sale was made. "added" = tax added on top (sales made before VAT mode).
    taxMode: text("tax_mode", { enum: TAX_MODES }).notNull().default("added"),
    vatableSales: real("vatable_sales").notNull().default(0), // net of VAT
    vatExemptSales: real("vat_exempt_sales").notNull().default(0),
    seniorDiscount: real("senior_discount").notNull().default(0),
    seniorEligible: real("senior_eligible").notNull().default(0), // purchase amount counted toward the weekly cap
    seniorType: text("senior_type", { enum: ["senior", "pwd"] }),
    seniorName: text("senior_name").notNull().default(""),
    seniorIdNumber: text("senior_id_number").notNull().default(""),
    // Buyer details printed on the invoice (snapshot, so later customer edits don't change it).
    buyerName: text("buyer_name").notNull().default(""),
    buyerAddress: text("buyer_address").notNull().default(""),
    buyerTin: text("buyer_tin").notNull().default(""),
    // Where the sale came from, and the marketplace order number for marketplace sales.
    channel: text("channel", { enum: ["pos", "tiktok"] }).notNull().default("pos"),
    externalOrderId: text("external_order_id").notNull().default(""),
    // Set when a marketplace order is cancelled after import (stock is returned).
    cancelledAt: text("cancelled_at"),
    amountPaid: real("amount_paid").notNull(),
    change: real("change").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("sales_created_idx").on(t.createdAt), index("sales_senior_idx").on(t.seniorIdNumber)],
);

export const saleItems = sqliteTable("sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  // Snapshot of the product at the time of sale, so invoices never change.
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  lineTotal: real("line_total").notNull(),
});

export const MOVEMENT_TYPES = ["in", "out", "adjustment", "damaged", "return", "sale"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const inventoryMovements = sqliteTable(
  "inventory_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    type: text("type", { enum: MOVEMENT_TYPES }).notNull(),
    // Signed change: positive adds stock, negative removes it.
    quantityChange: integer("quantity_change").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    note: text("note").notNull().default(""),
    saleId: integer("sale_id").references(() => sales.id),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("movements_product_idx").on(t.productId), index("movements_created_idx").on(t.createdAt)],
);

// Product images (and any documents) live inside the database, so one file holds everything.
// Read and written with raw SQL in src/lib/files.ts (Drizzle would decode the bytes as text).
export const files = sqliteTable("files", {
  name: text("name").primaryKey(),
  type: text("type").notNull(),
  data: blob("data").notNull(),
  createdAt: text("created_at").notNull().default(now),
});

// ---------- marketplaces ----------

// One row per marketplace (currently TikTok Shop). Holds the app keys and the shop's tokens.
export const marketplaceConnections = sqliteTable("marketplace_connections", {
  channel: text("channel").primaryKey(),
  appKey: text("app_key").notNull().default(""),
  appSecret: text("app_secret").notNull().default(""),
  authUrl: text("auth_url").notNull().default(""), // authorization link copied from the developer portal
  oauthState: text("oauth_state").notNull().default(""),
  accessToken: text("access_token").notNull().default(""),
  refreshToken: text("refresh_token").notNull().default(""),
  accessExpiresAt: integer("access_expires_at").notNull().default(0), // unix seconds
  refreshExpiresAt: integer("refresh_expires_at").notNull().default(0),
  sellerName: text("seller_name").notNull().default(""),
  shopId: text("shop_id").notNull().default(""),
  shopName: text("shop_name").notNull().default(""),
  shopCipher: text("shop_cipher").notNull().default(""),
  shopRegion: text("shop_region").notNull().default(""),
  autoSync: integer("auto_sync", { mode: "boolean" }).notNull().default(false),
  ordersSyncedTo: integer("orders_synced_to").notNull().default(0), // unix seconds; next sync starts here
  lastSyncAt: text("last_sync_at"),
  lastSyncResult: text("last_sync_result").notNull().default(""),
});

// Marketplace SKUs and which of our products each one is linked to.
export const marketplaceListings = sqliteTable(
  "marketplace_listings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channel: text("channel").notNull(),
    externalProductId: text("external_product_id").notNull(),
    externalSkuId: text("external_sku_id").notNull(),
    sellerSku: text("seller_sku").notNull().default(""),
    title: text("title").notNull().default(""),
    status: text("status").notNull().default(""),
    externalQuantity: integer("external_quantity").notNull().default(0),
    warehouseId: text("warehouse_id").notNull().default(""),
    productId: integer("product_id").references(() => products.id),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("listings_channel_sku_idx").on(t.channel, t.externalSkuId)],
);

// Every marketplace order seen, whether it became a sale, and why not if it didn't.
export const marketplaceOrders = sqliteTable(
  "marketplace_orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channel: text("channel").notNull(),
    externalOrderId: text("external_order_id").notNull(),
    status: text("status").notNull().default(""),
    orderCreatedAt: text("order_created_at").notNull(),
    total: real("total").notNull().default(0),
    buyerName: text("buyer_name").notNull().default(""),
    saleId: integer("sale_id").references(() => sales.id),
    problem: text("problem").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [uniqueIndex("mp_orders_channel_order_idx").on(t.channel, t.externalOrderId)],
);

export type MarketplaceConnection = typeof marketplaceConnections.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Settings = typeof settings.$inferSelect;
