import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";

export const MAX_LINE_QTY = 999;
export const MAX_CART_LINES = 100;

export function cartCookieName(storeId: string) {
  return `cart_${storeId}`;
}

export const cartInclude = {
  lines: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          product: { select: { id: true, title: true, handle: true, status: true, storeId: true, images: { orderBy: { position: "asc" as const }, take: 1 } } },
        },
      },
    },
  },
};

export async function getCart(storeId: string) {
  const token = (await cookies()).get(cartCookieName(storeId))?.value;
  if (!token) return null;
  const cart = await db.cart.findUnique({ where: { token }, include: cartInclude });
  if (!cart || cart.storeId !== storeId || cart.completedAt) return null;
  return cart;
}

export type CartWithLines = NonNullable<Awaited<ReturnType<typeof getCart>>>;

export async function getOrCreateCart(storeId: string) {
  const existing = await getCart(storeId);
  if (existing) return existing;
  const token = randomToken(24);
  const cart = await db.cart.create({ data: { storeId, token }, include: cartInclude });
  (await cookies()).set(cartCookieName(storeId), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return cart;
}

/** How many units of a variant can be put in the cart right now. */
export function maxPurchasable(v: { trackInventory: boolean; allowBackorder: boolean; inventoryQty: number }): number {
  if (!v.trackInventory || v.allowBackorder) return MAX_LINE_QTY;
  return Math.max(0, Math.min(v.inventoryQty, MAX_LINE_QTY));
}

/** Lines that can still be bought: product active, variant in this store, stock available. */
export function sellableLines(cart: CartWithLines) {
  return cart.lines.filter((l) => l.variant.product.status === "ACTIVE" && l.variant.product.storeId === cart.storeId && maxPurchasable(l.variant) > 0);
}

export function cartItemCount(cart: CartWithLines | null) {
  return cart ? cart.lines.reduce((n, l) => n + l.quantity, 0) : 0;
}
