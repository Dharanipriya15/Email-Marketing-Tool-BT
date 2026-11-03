import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login"];

// Reachable without a session. Each protects itself: unsubscribe routes
// verify a signed token, /api/cron requires the CRON_SECRET bearer token, and
// /api/webhooks verifies SNS message signatures, and /api/t (open/click
// tracking) only acts on HMAC-signed links.
const PUBLIC_PREFIXES = ["/unsubscribe", "/api/unsubscribe", "/api/cron", "/api/webhooks", "/api/t"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
