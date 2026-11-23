import "server-only";
import { z } from "zod";
import type { Plan, Store } from "@prisma/client";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

const manualSchema = z.object({
  cod: z.object({ enabled: z.boolean().catch(false), instructions: z.string().max(2000).catch("") }).catch({ enabled: false, instructions: "" }),
  bankTransfer: z.object({ enabled: z.boolean().catch(false), instructions: z.string().max(2000).catch("") }).catch({ enabled: false, instructions: "" }),
});
export type ManualPayments = z.infer<typeof manualSchema>;

export function parseManualPayments(json: unknown): ManualPayments {
  return manualSchema.parse(json && typeof json === "object" ? json : {});
}

export type PaymentMethod = "stripe" | "cod" | "bank_transfer" | "test";

/** Methods a customer may choose at checkout for this store. */
export function availablePaymentMethods(store: Store): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (getStripe() && store.stripeAccountId && store.stripeChargesEnabled) methods.push("stripe");
  const manual = parseManualPayments(store.manualPayments);
  if (manual.cod.enabled) methods.push("cod");
  if (manual.bankTransfer.enabled) methods.push("bank_transfer");
  if (env.testGatewayEnabled && !env.isProduction) methods.push("test");
  return methods;
}

/** Platform fee in bps: store override → plan → deployment default. */
export function feeBpsFor(store: Store & { plan?: Plan | null }): number {
  if (store.platformFeeBps !== null && store.platformFeeBps !== undefined) return store.platformFeeBps;
  if (store.plan) return store.plan.transactionFeeBps;
  return env.platformFeeBps;
}
