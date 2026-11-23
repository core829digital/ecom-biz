import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-based multi-tenancy.
 *  - APP_URL host            → merchant admin, platform admin, API (no rewrite)
 *  - <slug>.<root domain>    → storefront of that store
 *  - any other host          → storefront for a verified custom domain
 * Storefront requests are rewritten to /sites/<site-key>/<path>.
 */
/**
 * Content-Security-Policy with a per-request nonce. Next.js reads the nonce from
 * the request's CSP header and applies it to its own scripts; only nonced scripts
 * (plus Stripe.js) can run, which blocks injected-script XSS.
 */
function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src 'self' https://api.stripe.com${dev ? " ws: wss:" : ""}`,
    "frame-src https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function withCsp(res: NextResponse, csp: string) {
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  const appHost = new URL(process.env.APP_URL || "http://localhost:3000").host.toLowerCase();
  const rootDomain = (process.env.STOREFRONT_ROOT_DOMAIN || "localhost:3000").toLowerCase();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete("x-store-base");
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.delete("x-original-path");

  if (host === appHost || host === rootDomain || host === `www.${rootDomain}`) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
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
  return withCsp(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), csp);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|api/|files/|favicon.ico).*)"],
};
