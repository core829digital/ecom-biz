"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { getCart, getOrCreateCart, maxPurchasable, MAX_CART_LINES } from "@/server/cart";

export type AddToCartResult = { ok: boolean; error?: string; count?: number };

export async function addToCartAction(site: string, variantId: string, quantity: number): Promise<AddToCartResult> {
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  if (!sf.operational) return { ok: false, error: t("sf.unavailable") };
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1 || qty > 999) return { ok: false, error: t("sf.cart.invalidQty") };
  const variant = await db.productVariant.findFirst({
    where: { id: variantId, product: { storeId: store.id, status: "ACTIVE" } },
  });
  if (!variant) return { ok: false, error: t("sf.cart.unavailableItem") };
  const cart = await getOrCreateCart(store.id);
  const existing = cart.lines.find((l) => l.variantId === variant.id);
  const max = maxPurchasable(variant);
  if (max === 0) return { ok: false, error: t("sf.soldOut") };
  const wanted = (existing?.quantity ?? 0) + qty;
  if (wanted > max) return { ok: false, error: t("sf.cart.onlyAvailable", { count: max }) };
  if (!existing && cart.lines.length >= MAX_CART_LINES) return { ok: false, error: t("sf.cart.full") };
  await db.cartLine.upsert({
    where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
    create: { cartId: cart.id, variantId: variant.id, quantity: qty },
    update: { quantity: wanted },
  });
  revalidatePath("/", "layout");
  const count = cart.lines.reduce((n, l) => n + (l.variantId === variant.id ? 0 : l.quantity), 0) + wanted;
  return { ok: true, count };
}

export async function updateCartLineAction(site: string, lineId: string, fd: FormData) {
  const { store } = await loadStorefront(site);
  const cart = await getCart(store.id);
  const line = cart?.lines.find((l) => l.id === lineId);
  if (!cart || !line) return;
  const qty = Math.max(0, Math.min(Math.floor(Number(fd.get("quantity"))) || 0, maxPurchasable(line.variant)));
  if (qty === 0) await db.cartLine.delete({ where: { id: line.id } });
  else await db.cartLine.update({ where: { id: line.id }, data: { quantity: qty } });
  revalidatePath("/", "layout");
}

export async function removeCartLineAction(site: string, lineId: string) {
  const { store } = await loadStorefront(site);
  const cart = await getCart(store.id);
  if (cart?.lines.some((l) => l.id === lineId)) await db.cartLine.delete({ where: { id: lineId } });
  revalidatePath("/", "layout");
}

export async function updateCartNoteAction(site: string, fd: FormData) {
  const { store } = await loadStorefront(site);
  const cart = await getCart(store.id);
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { note: String(fd.get("note") ?? "").slice(0, 1000) || null } });
  revalidatePath("/", "layout");
}
