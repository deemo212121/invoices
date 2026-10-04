import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { isRemoteRequest, isValidSession, SESSION_COOKIE } from "@/lib/session";

// Sign-in is optional until a store password is set (Settings → Store password):
// - no password: open on this computer and the shop network; the online address stays locked
// - password set: every page, download, API route and server action needs a signed-in session
export function proxy(request: NextRequest) {
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const hasPassword = !!db.select({ h: settings.ownerPasswordHash }).from(settings).where(eq(settings.id, 1)).get()?.h;
  const remote = isRemoteRequest(request.headers);
  if (!hasPassword && !remote) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  // APIs and downloads get a plain 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/") || pathname.endsWith("/pdf")) {
    return new NextResponse("Sign in required", { status: 401 });
  }
  // Online with no password yet: explain how to turn on online access.
  if (!hasPassword) return NextResponse.redirect(new URL("/setup", request.url));
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|setup|_next/static|_next/image|favicon.ico).*)"],
};
