"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { marketplaceListings, products } from "@/db/schema";
import type { FormState } from "@/lib/form-state";
import { authUrlProblem, CHANNEL, exchangeAuthCode, getConnection, updateConnection } from "@/lib/tiktok/client";
import { pushStock, runSync } from "@/lib/tiktok/sync";

const g = globalThis as unknown as { __ttSyncing?: boolean };

export async function saveTikTokSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const appKey = get("appKey");
  const secret = get("appSecret");
  const authUrl = get("authUrl");
  if (!appKey) return { error: "App Key is required" };
  if (!secret && !getConnection().appSecret) return { error: "App Secret is required" };
  if (authUrl) {
    const problem = authUrlProblem(authUrl);
    if (problem) return { error: problem };
  }
  // A blank secret field keeps the saved secret (it is never sent back to the browser).
  updateConnection({ appKey, ...(secret ? { appSecret: secret } : {}), authUrl });
  revalidatePath("/settings/marketplaces");
  return { ok: "TikTok settings saved" };
}

/** Fallback when the redirect can't reach this computer: paste the code from the redirect URL. */
export async function connectWithCode(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = String(fd.get("code") ?? "").trim();
  // Accept either the bare code or the whole redirect URL.
  let code = raw;
  if (/^https?:\/\//.test(raw) || raw.includes("/api/tiktok/callback")) {
    code = new URL(raw, "http://localhost").searchParams.get("code") ?? "";
    if (!code) {
      return { error: "That address has no code= in it. Paste the address TikTok sent you to after you clicked Authorize (it ends with ?code=…)." };
    }
  }
  if (!code) return { error: "Paste the authorization code" };
  try {
    const shop = await exchangeAuthCode(code);
    revalidatePath("/", "layout");
    return { ok: `Connected to ${shop.name}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncTikTok() {
  if (g.__ttSyncing) return { ok: false, summary: "A sync is already running" };
  g.__ttSyncing = true;
  try {
    const result = await runSync();
    revalidatePath("/", "layout");
    return result;
  } finally {
    g.__ttSyncing = false;
  }
}

export async function pushTikTokStock() {
  try {
    const r = await pushStock();
    revalidatePath("/settings/marketplaces");
    return { ok: r.errors.length === 0, summary: `${r.updated} stock level(s) sent${r.errors.length ? `. Errors: ${r.errors.join("; ")}` : ""}` };
  } catch (e) {
    return { ok: false, summary: e instanceof Error ? e.message : String(e) };
  }
}

export async function setTikTokAutoSync(on: boolean) {
  updateConnection({ autoSync: on });
  revalidatePath("/", "layout");
}

export async function linkListing(listingId: number, productId: number | null) {
  if (productId && !db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get()) {
    throw new Error("Product not found");
  }
  db.update(marketplaceListings)
    .set({ productId })
    .where(and(eq(marketplaceListings.id, listingId), eq(marketplaceListings.channel, CHANNEL)))
    .run();
  revalidatePath("/settings/marketplaces");
}

export async function disconnectTikTok() {
  updateConnection({
    accessToken: "",
    refreshToken: "",
    accessExpiresAt: 0,
    refreshExpiresAt: 0,
    shopId: "",
    shopName: "",
    shopCipher: "",
    shopRegion: "",
    sellerName: "",
    autoSync: false,
  });
  revalidatePath("/", "layout");
}
