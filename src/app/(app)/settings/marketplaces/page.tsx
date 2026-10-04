import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceListings, marketplaceOrders, products, sales } from "@/db/schema";
import { CHANNEL, getConnection } from "@/lib/tiktok/client";
import { getSettings } from "@/lib/data";
import { TikTokPanel } from "@/components/TikTokPanel";

export default async function MarketplacesPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const c = getConnection();
  const listings = db
    .select({
      id: marketplaceListings.id,
      title: marketplaceListings.title,
      sellerSku: marketplaceListings.sellerSku,
      status: marketplaceListings.status,
      externalQuantity: marketplaceListings.externalQuantity,
      productId: marketplaceListings.productId,
      ourQuantity: products.quantity,
    })
    .from(marketplaceListings)
    .leftJoin(products, eq(products.id, marketplaceListings.productId))
    .where(eq(marketplaceListings.channel, CHANNEL))
    .orderBy(sql`${marketplaceListings.productId} is not null`, marketplaceListings.title)
    .all();
  const orders = db
    .select({
      id: marketplaceOrders.id,
      externalOrderId: marketplaceOrders.externalOrderId,
      status: marketplaceOrders.status,
      orderCreatedAt: marketplaceOrders.orderCreatedAt,
      total: marketplaceOrders.total,
      buyerName: marketplaceOrders.buyerName,
      problem: marketplaceOrders.problem,
      saleId: marketplaceOrders.saleId,
      invoiceNumber: sales.invoiceNumber,
      cancelledAt: sales.cancelledAt,
    })
    .from(marketplaceOrders)
    .leftJoin(sales, eq(sales.id, marketplaceOrders.saleId))
    .where(eq(marketplaceOrders.channel, CHANNEL))
    .orderBy(sql`${marketplaceOrders.problem} = ''`, desc(marketplaceOrders.orderCreatedAt))
    .limit(100)
    .all();
  const productOptions = db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(eq(products.archived, false))
    .orderBy(products.name)
    .all();

  return (
    <TikTokPanel
      connection={{
        appKey: c.appKey,
        hasSecret: !!c.appSecret,
        authUrl: c.authUrl,
        connected: !!c.accessToken && !!c.shopCipher,
        shopName: c.shopName,
        shopRegion: c.shopRegion,
        sellerName: c.sellerName,
        refreshExpiresAt: c.refreshExpiresAt,
        autoSync: c.autoSync,
        lastSyncAt: c.lastSyncAt,
        lastSyncResult: c.lastSyncResult,
      }}
      listings={listings}
      orders={orders}
      products={productOptions}
      currency={getSettings().currencySymbol}
      flash={{ connected, error }}
    />
  );
}
