import "server-only";
import type { Store } from "@prisma/client";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Refresh a store's Stripe Connect status from Stripe. Internal helper (not a Server
 * Action): it only ever reads the account already linked to the store.
 */
export async function refreshStripeStatus(store: Pick<Store, "id" | "stripeAccountId">) {
  const stripe = getStripe();
  if (!stripe || !store.stripeAccountId) return;
  const account = await stripe.accounts.retrieve(store.stripeAccountId);
  await db.store.update({ where: { id: store.id }, data: { stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled } });
}
