"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { BillingError, createBillingPortal, createSubscriptionCheckout } from "@/server/billing";

export async function choosePlanAction(slug: string, planId: string) {
  const { store, user } = await requireStoreAccess(slug, "OWNER");
  const plan = await db.plan.findFirst({ where: { id: planId, active: true } });
  if (!plan) redirect(`/admin/${slug}/settings/billing`);
  let url: string;
  try {
    // An existing subscription is changed in the billing portal: never create a second one (double charge).
    url = store.stripeSubscriptionId && store.subscriptionStatus !== "CANCELED" && plan.priceCents > 0
      ? await createBillingPortal(store)
      : await createSubscriptionCheckout(store, plan, user.email);
  } catch (e) {
    if (!(e instanceof BillingError)) console.error("[billing]", e);
    redirect(`/admin/${slug}/settings/billing?error=1`);
  }
  redirect(url);
}

export async function billingPortalAction(slug: string) {
  const { store } = await requireStoreAccess(slug, "OWNER");
  let url: string;
  try {
    url = await createBillingPortal(store);
  } catch {
    redirect(`/admin/${slug}/settings/billing?error=1`);
  }
  redirect(url);
}
