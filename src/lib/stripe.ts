import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null = null;

/** Platform Stripe client, or null when Stripe is not configured for this deployment. */
export function getStripe(): Stripe | null {
  if (!env.stripeSecretKey) return null;
  client ??= new Stripe(env.stripeSecretKey, { appInfo: { name: "commerce-platform" }, maxNetworkRetries: 2 });
  return client;
}
