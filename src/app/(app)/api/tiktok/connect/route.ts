import { randomUUID } from "node:crypto";
import { authUrlProblem, getConnection, sellerAuthorizeUrl, updateConnection } from "@/lib/tiktok/client";

// "Log in with TikTok": sends the browser to TikTok Shop's seller login/authorize page, with a
// one-time state value that is checked when TikTok sends the seller back to /api/tiktok/callback.
export async function GET(req: Request) {
  const back = (msg: string) => Response.redirect(new URL(`/settings/marketplaces?error=${encodeURIComponent(msg)}`, req.url));
  const c = getConnection();
  if (!c.appKey || !c.appSecret) return back("Save the App Key and App Secret first (Developer settings).");

  // A link copied from Partner Center wins; otherwise build TikTok's standard seller login link.
  const link = c.authUrl || sellerAuthorizeUrl(c.appKey);
  const problem = authUrlProblem(link);
  if (problem) return back(problem);
  const url = new URL(link);
  const state = randomUUID();
  updateConnection({ oauthState: state });
  url.searchParams.set("state", state);
  return Response.redirect(url.toString());
}
