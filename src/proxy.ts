import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// Every page, download, API route and server action requires a signed-in session,
// except the login and first-time setup screens and static assets.
export function proxy(request: NextRequest) {
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  // APIs and downloads get a plain 401 instead of an HTML redirect.
  if (pathname.startsWith("/api/") || pathname.startsWith("/uploads/") || pathname.endsWith("/pdf")) {
    return new NextResponse("Sign in required", { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|setup|_next/static|_next/image|favicon.ico).*)"],
};
