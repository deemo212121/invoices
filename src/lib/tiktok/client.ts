import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceConnections, type MarketplaceConnection } from "@/db/schema";

// TikTok Shop Open API client. Endpoints, signing and token handling follow TikTok's official
// Node.js SDK (vendor/tiktok-shop-sdk), reimplemented on fetch to avoid its deprecated `request` dependency.

const API_HOST = "https://open-api.tiktokglobalshop.com";
const AUTH_HOST = "https://auth.tiktok-shops.com";
export const CHANNEL = "tiktok";

/** TikTok Shop's seller login/authorize page for this app (rest-of-world sellers, incl. the Philippines). */
export function sellerAuthorizeUrl(appKey: string) {
  return `https://services.tiktokshop.com/open/authorize?app_key=${encodeURIComponent(appKey)}`;
}

/** The authorization link is TikTok's approval page, never this app's own callback address. */
export function authUrlProblem(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "The authorization link isn't a valid web address.";
  }
  if (["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname.includes("/api/tiktok/callback")) {
    return "That's this app's redirect (callback) URL, which belongs in TikTok Partner Center. The authorization link is TikTok's own approval page, on a TikTok website. Leave it blank and authorize from Development Shops if you don't have one.";
  }
  if (url.protocol !== "https:") return "The authorization link should start with https://";
  return "";
}

export class TikTokError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;
type Envelope<T> = { code: number; message: string; data?: T; request_id?: string };

/** HMAC-SHA256 over secret + path + sorted query (minus sign/access_token) + body + secret. */
export function sign(path: string, qs: Record<string, string | number>, body: string | undefined, secret: string) {
  const params = Object.keys(qs)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => `${k}${qs[k]}`)
    .join("");
  return crypto
    .createHmac("sha256", secret)
    .update(`${secret}${path}${params}${body ?? ""}${secret}`)
    .digest("hex");
}

export function getConnection(): MarketplaceConnection {
  const row = db.select().from(marketplaceConnections).where(eq(marketplaceConnections.channel, CHANNEL)).get();
  if (row) return row;
  db.insert(marketplaceConnections).values({ channel: CHANNEL }).onConflictDoNothing().run();
  return db.select().from(marketplaceConnections).where(eq(marketplaceConnections.channel, CHANNEL)).get()!;
}

export function updateConnection(values: Partial<MarketplaceConnection>) {
  getConnection();
  db.update(marketplaceConnections).set(values).where(eq(marketplaceConnections.channel, CHANNEL)).run();
}

async function readEnvelope<T>(res: Response): Promise<T> {
  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new TikTokError(`TikTok returned an unreadable response (HTTP ${res.status})`);
  }
  if (json.code !== 0) throw new TikTokError(`TikTok: ${json.message} (code ${json.code})`, json.code);
  return json.data as T;
}

// ---------- tokens ----------

type TokenData = {
  access_token: string;
  access_token_expire_in: number;
  refresh_token: string;
  refresh_token_expire_in: number;
  seller_name?: string;
};

async function tokenRequest(path: string, params: Record<string, string>) {
  const res = await fetch(`${AUTH_HOST}${path}?${new URLSearchParams(params)}`);
  return readEnvelope<TokenData>(res);
}

function saveTokens(t: TokenData) {
  updateConnection({
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    accessExpiresAt: t.access_token_expire_in,
    refreshExpiresAt: t.refresh_token_expire_in,
    ...(t.seller_name ? { sellerName: t.seller_name } : {}),
  });
}

/** Exchanges the authorization code from the redirect for tokens, then looks up the shop. */
export async function exchangeAuthCode(authCode: string) {
  const c = getConnection();
  if (!c.appKey || !c.appSecret) throw new TikTokError("Save the App Key and App Secret first.");
  saveTokens(
    await tokenRequest("/api/v2/token/get", {
      app_key: c.appKey,
      app_secret: c.appSecret,
      auth_code: authCode,
      grant_type: "authorized_code",
    }),
  );
  return loadShop();
}

/** Refreshes the access token when it expires within a day. */
async function freshConnection() {
  const c = getConnection();
  if (!c.accessToken) throw new TikTokError("TikTok Shop is not connected.");
  const now = Math.floor(Date.now() / 1000);
  if (c.accessExpiresAt - now > 24 * 3600) return c;
  if (c.refreshExpiresAt && c.refreshExpiresAt < now) {
    throw new TikTokError("The TikTok connection has expired. Connect the shop again.");
  }
  saveTokens(
    await tokenRequest("/api/v2/token/refresh", {
      app_key: c.appKey,
      app_secret: c.appSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  );
  return getConnection();
}

// ---------- signed API calls ----------

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST"; qs?: Record<string, string | number | undefined>; body?: Json; shop?: boolean } = {},
): Promise<T> {
  const c = await freshConnection();
  const qs: Record<string, string | number> = { app_key: c.appKey, timestamp: Math.floor(Date.now() / 1000) };
  for (const [k, v] of Object.entries(opts.qs ?? {})) if (v !== undefined && v !== "") qs[k] = v;
  if (opts.shop !== false) {
    if (!c.shopCipher) throw new TikTokError("No shop is linked to this connection.");
    qs.shop_cipher = c.shopCipher;
  }
  // The exact string that is signed is the exact string that is sent.
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  qs.sign = sign(path, qs, body, c.appSecret);
  const url = `${API_HOST}${path}?${new URLSearchParams(Object.entries(qs).map(([k, v]) => [k, String(v)]))}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    body,
    headers: { "Content-Type": "application/json", "x-tts-access-token": c.accessToken },
  });
  return readEnvelope<T>(res);
}

// ---------- endpoints ----------

type Shop = { cipher: string; id: string; name: string; region: string; code?: string };

/** Picks the authorized shop (prefers a Philippine one) and stores its cipher. */
export async function loadShop() {
  const data = await call<{ shops?: Shop[] }>("/authorization/202309/shops", { shop: false });
  const shops = data.shops ?? [];
  if (!shops.length) throw new TikTokError("No TikTok shop is authorized for this app yet.");
  const shop = shops.find((s) => s.region === "PH") ?? shops[0];
  updateConnection({ shopId: shop.id, shopName: shop.name, shopCipher: shop.cipher, shopRegion: shop.region });
  return shop;
}

export type TtLineItem = {
  id: string;
  sku_id: string;
  seller_sku?: string;
  product_name?: string;
  sku_name?: string;
  sale_price?: string;
  original_price?: string;
  display_status?: string;
  currency?: string;
};

export type TtOrder = {
  id: string;
  status: string;
  create_time: number;
  paid_time?: number;
  update_time: number;
  line_items?: TtLineItem[];
  payment?: { total_amount?: string; sub_total?: string; currency?: string };
  recipient_address?: { name?: string; full_address?: string };
};

export async function searchOrders(filter: { update_time_ge: number }, pageToken?: string) {
  return call<{ orders?: TtOrder[]; next_page_token?: string; total_count?: number }>("/order/202309/orders/search", {
    method: "POST",
    qs: { page_size: 50, sort_field: "update_time", sort_order: "ASC", page_token: pageToken },
    body: filter,
  });
}

export type TtProduct = {
  id: string;
  title: string;
  status: string;
  skus?: { id: string; seller_sku?: string; inventory?: { quantity?: number; warehouse_id?: string }[] }[];
};

export async function searchProducts(pageToken?: string) {
  return call<{ products?: TtProduct[]; next_page_token?: string }>("/product/202309/products/search", {
    method: "POST",
    qs: { page_size: 100, page_token: pageToken },
    body: {},
  });
}

export async function updateInventory(
  productId: string,
  skus: { id: string; inventory: { quantity: number; warehouse_id?: string }[] }[],
) {
  return call<{ errors?: { code?: number; message?: string; detail?: { sku_id?: string } }[] }>(
    `/product/202309/products/${encodeURIComponent(productId)}/inventory/update`,
    { method: "POST", body: { skus } },
  );
}
