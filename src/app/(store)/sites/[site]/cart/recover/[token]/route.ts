import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveStore } from "@/lib/tenant";
import { cartCookieName } from "@/server/cart";
import { env } from "@/lib/env";

/**
 * Link from the recovery email: restore the cart on this browser and continue to checkout.
 * The redirect is relative on purpose: `req.url` is the internal rewritten URL, while the
 * browser resolves a relative Location against the public host (subdomain or custom domain).
 */
export async function GET(req: Request, { params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const store = await resolveStore(site);
  if (!store) return new Response("Not found", { status: 404 });
  const base = req.headers.get("x-store-base") ?? `/sites/${site}`;
  const cart = token.length <= 64 ? await db.cart.findUnique({ where: { token } }) : null;
  const valid = !!cart && cart.storeId === store.id && !cart.completedAt;
  const res = new NextResponse(null, { status: 303, headers: { Location: `${base}/${valid ? "checkout" : "cart"}`, "Cache-Control": "no-store" } });
  if (valid) {
    res.cookies.set(cartCookieName(store.id), cart.token, {
      httpOnly: true, secure: env.secureStoreCookies, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
