import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { resolveStore } from "@/lib/tenant";
import { cartCookieName } from "@/server/cart";
import { env } from "@/lib/env";

/** Link from the recovery email: restore the cart on this browser and continue to checkout. */
export async function GET(req: Request, { params }: { params: Promise<{ site: string; token: string }> }) {
  const { site, token } = await params;
  const store = await resolveStore(site);
  if (!store) return new Response("Not found", { status: 404 });
  const base = req.headers.get("x-store-base") !== null ? "" : `/sites/${site}`;
  const cart = await db.cart.findUnique({ where: { token } });
  const target = new URL(`${base}/checkout`, req.url);
  if (!cart || cart.storeId !== store.id || cart.completedAt) {
    target.pathname = `${base}/cart`;
    return Response.redirect(target, 303);
  }
  (await cookies()).set(cartCookieName(store.id), cart.token, {
    httpOnly: true, secure: env.secureStoreCookies, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return Response.redirect(target, 303);
}
