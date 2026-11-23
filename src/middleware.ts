import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based multi-tenancy.
 *  - APP_URL host            → merchant admin, platform admin, API (no rewrite)
 *  - <slug>.<root domain>    → storefront of that store
 *  - any other host          → storefront for a verified custom domain
 * Storefront requests are rewritten to /sites/<site-key>/<path>.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const appHost = new URL(process.env.APP_URL || "http://localhost:3000").host.toLowerCase();
  const rootDomain = (process.env.STOREFRONT_ROOT_DOMAIN || "localhost:3000").toLowerCase();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-store-base");
  requestHeaders.delete("x-original-path");

  if (host === appHost || host === rootDomain || host === `www.${rootDomain}`) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let siteKey = host;
  if (host.endsWith(`.${rootDomain}`)) {
    siteKey = host.slice(0, -(rootDomain.length + 1));
    if (siteKey.includes(".")) return new NextResponse("Not found", { status: 404 });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(siteKey)}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
  // Storefront links on a real host are root-relative.
  requestHeaders.set("x-store-base", "");
  requestHeaders.set("x-original-path", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|api/|files/|favicon.ico).*)"],
};
