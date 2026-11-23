import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { loadStorefront } from "@/server/storefront";
import { completeCheckout } from "@/server/orders";
import { cartCookieName } from "@/server/cart";

export const metadata = { robots: { index: false } };

/**
 * Stripe redirects here after confirmPayment. We verify the PaymentIntent server-side
 * (never trusting query params) and complete the checkout idempotently.
 */
export default async function CheckoutComplete({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ checkout?: string; payment_intent?: string }> }) {
  const { site } = await params;
  const sp = await searchParams;
  const sf = await loadStorefront(site);
  const checkout = sp.checkout ? await db.checkout.findFirst({ where: { id: sp.checkout, storeId: sf.store.id } }) : null;
  const stripe = getStripe();
  if (!checkout || !checkout.paymentRef || !stripe || sp.payment_intent !== checkout.paymentRef) redirect(sf.href("/cart"));

  let orderToken: string | null = null;
  if (checkout.status === "COMPLETED" && checkout.orderId) {
    orderToken = (await db.order.findUnique({ where: { id: checkout.orderId }, select: { statusToken: true } }))?.statusToken ?? null;
  } else {
    const pi = await stripe.paymentIntents.retrieve(checkout.paymentRef);
    if (pi.status === "succeeded" && pi.amount_received === (checkout.pricing as { totalCents: number }).totalCents) {
      const { orderId } = await completeCheckout(checkout.id, { paid: true, enforceStock: false });
      orderToken = (await db.order.findUnique({ where: { id: orderId }, select: { statusToken: true } }))?.statusToken ?? null;
    } else if (pi.status === "processing") {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">{sf.t("checkout.processingTitle")}</h1>
          <p className="mt-3 text-muted">{sf.t("checkout.processingBody")}</p>
        </div>
      );
    } else {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold">{sf.t("checkout.paymentFailed")}</h1>
          <Link href={sf.href("/checkout")} className="mt-6 inline-block underline">{sf.t("checkout.tryAgain")}</Link>
        </div>
      );
    }
  }
  if (!orderToken) redirect(sf.href("/cart"));
  (await cookies()).delete(cartCookieName(sf.store.id));
  redirect(sf.href(`/orders/${orderToken}`));
}
