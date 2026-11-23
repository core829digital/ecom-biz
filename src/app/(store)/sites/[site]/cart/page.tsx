import Link from "next/link";
import { loadStorefront } from "@/server/storefront";
import { getCart, maxPurchasable } from "@/server/cart";
import { removeCartLineAction, updateCartLineAction, updateCartNoteAction } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const { t } = await loadStorefront((await params).site);
  return { title: t("sf.cart"), robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params;
  const sf = await loadStorefront(site);
  const { t } = sf;
  const cart = await getCart(sf.store.id);
  const lines = cart?.lines ?? [];

  if (!lines.length) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{t("sf.cart")}</h1>
        <p className="mt-3 text-muted">{t("sf.cart.empty")}</p>
        <Link href={sf.href("/collections/all")} className="mt-8 inline-flex h-12 items-center rounded-full bg-brand px-7 font-medium text-brand-contrast">{t("sf.continueShopping")}</Link>
      </div>
    );
  }

  let subtotal = 0;
  let hasProblem = false;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t("sf.cart")}</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="divide-y divide-border border-y border-border">
          {lines.map((l) => {
            const v = l.variant;
            const max = maxPurchasable(v);
            const unavailable = v.product.status !== "ACTIVE" || max === 0;
            const overStock = !unavailable && l.quantity > max;
            if (unavailable || overStock) hasProblem = true;
            if (!unavailable) subtotal += v.priceCents * Math.min(l.quantity, max);
            return (
              <li key={l.id} className="flex gap-4 py-5">
                <Link href={sf.href(`/products/${v.product.handle}?variant=${v.id}`)} className="size-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                  {v.product.images[0] && <img src={v.product.images[0].url} alt="" className="size-full object-cover" />}
                </Link>
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-between">
                  <div>
                    <Link href={sf.href(`/products/${v.product.handle}?variant=${v.id}`)} className="font-medium hover:underline">{v.product.title}</Link>
                    {v.title !== "Default" && <p className="text-sm text-muted">{v.title}</p>}
                    <p className="mt-1 text-sm tabular-nums">{sf.money(v.priceCents)}</p>
                    {unavailable && <p className="mt-1 text-sm text-danger">{t("sf.cart.unavailableItem")}</p>}
                    {overStock && <p className="mt-1 text-sm text-danger">{t("sf.cart.onlyAvailable", { count: max })}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {!unavailable && (
                      <form action={updateCartLineAction.bind(null, site, l.id)} className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`q-${l.id}`}>{t("sf.quantity")}</label>
                        <input id={`q-${l.id}`} name="quantity" type="number" min={0} max={max} defaultValue={l.quantity} className="h-10 w-20 rounded-md border border-border bg-bg px-2 text-center tabular-nums" />
                        <button className="text-sm underline">{t("sf.cart.update")}</button>
                      </form>
                    )}
                    <form action={removeCartLineAction.bind(null, site, l.id)}>
                      <button className="text-sm text-muted underline hover:text-text">{t("sf.cart.remove")}</button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <aside className="h-fit rounded-xl bg-surface-2 p-6">
          <div className="flex justify-between text-lg font-medium">
            <span>{t("sf.subtotal")}</span>
            <span className="tabular-nums" data-testid="cart-subtotal">{sf.money(subtotal)}</span>
          </div>
          <p className="mt-2 text-sm text-muted">{t("sf.cart.shippingAtCheckout")}</p>
          <form action={updateCartNoteAction.bind(null, site)} className="mt-6">
            <label htmlFor="note" className="mb-1 block text-sm font-medium">{t("sf.cart.note")}</label>
            <textarea id="note" name="note" rows={3} maxLength={1000} defaultValue={cart?.note ?? ""} className="w-full rounded-md border border-border bg-bg p-2 text-sm" />
            <button className="mt-1 text-sm underline">{t("common.save")}</button>
          </form>
          {hasProblem && <p className="mt-4 text-sm text-danger">{t("sf.cart.fixProblems")}</p>}
          <Link
            href={sf.href("/checkout")}
            aria-disabled={hasProblem || subtotal === 0}
            className={`mt-6 flex h-12 items-center justify-center rounded-full bg-brand font-medium text-brand-contrast hover:opacity-90 ${hasProblem || subtotal === 0 ? "pointer-events-none opacity-50" : ""}`}
          >
            {t("sf.checkout")}
          </Link>
        </aside>
      </div>
    </div>
  );
}
