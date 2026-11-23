import { Badge } from "@/components/ui/primitives";
import type { Translator } from "@/lib/i18n";
import type { FinancialStatus, FulfillmentStatus, OrderStatus } from "@prisma/client";

const FIN = { PENDING: "warning", PAID: "success", PARTIALLY_REFUNDED: "info", REFUNDED: "neutral", VOIDED: "neutral" } as const;
const FUL = { UNFULFILLED: "warning", PARTIALLY_FULFILLED: "info", FULFILLED: "success" } as const;

export function FinancialBadge({ status, t }: { status: FinancialStatus; t: Translator }) {
  return <Badge tone={FIN[status]}>{t(`orders.financial.${status}`)}</Badge>;
}
export function FulfillmentBadge({ status, t }: { status: FulfillmentStatus; t: Translator }) {
  return <Badge tone={FUL[status]}>{t(`orders.fulfillment.${status}`)}</Badge>;
}
export function OrderStatusBadge({ status, t }: { status: OrderStatus; t: Translator }) {
  if (status === "OPEN") return null;
  return <Badge tone={status === "CANCELLED" ? "danger" : "neutral"}>{t(`orders.status.${status}`)}</Badge>;
}
