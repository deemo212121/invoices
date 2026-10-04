import { revalidatePath } from "next/cache";
import { exchangeAuthCode, getConnection, updateConnection } from "@/lib/tiktok/client";

// TikTok redirects here after the seller approves the app: ?code=...&state=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const go = (params: string) => Response.redirect(new URL(`/settings/marketplaces?${params}`, req.url));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return go(`error=${encodeURIComponent("TikTok did not send an authorization code.")}`);

  // When we started the flow we stored a state value; it must match. (Authorizations started from
  // Partner Center itself arrive without one, which is fine.)
  const expected = getConnection().oauthState;
  if (state && expected && state !== expected) {
    return go(`error=${encodeURIComponent("Authorization check failed (state mismatch). Try connecting again.")}`);
  }

  try {
    const shop = await exchangeAuthCode(code);
    updateConnection({ oauthState: "" });
    revalidatePath("/", "layout");
    return go(`connected=${encodeURIComponent(shop.name)}`);
  } catch (e) {
    return go(`error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`);
  }
}
