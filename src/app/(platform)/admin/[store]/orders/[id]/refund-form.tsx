"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/fields";
import { useT } from "@/components/i18n-provider";
import { suggestRefund, type RefundableLine } from "@/lib/refunds";
import { centsToInput, parseMoney } from "@/lib/money";
import type { ActionState } from "@/lib/action";

export function RefundForm({
  action,
  lines,
  taxesIncluded,
  remainingCents,
  shippingCents,
  currency,
  canRefundMoney,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  lines: (RefundableLine & { title: string; variantTitle: string | null })[];
  taxesIncluded: boolean;
  remainingCents: number;
  shippingCents: number;
  currency: string;
  canRefundMoney: boolean;
}) {
  const t = useT();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [shipping, setShipping] = useState("");
  const [amount, setAmount] = useState<string | null>(null);
  const suggested = useMemo(
    () => suggestRefund(lines, Object.entries(qty).map(([lineId, quantity]) => ({ lineId, quantity })), parseMoney(shipping) ?? 0, taxesIncluded, remainingCents),
    [lines, qty, shipping, taxesIncluded, remainingCents],
  );
  return (
    <ActionForm action={action} className="space-y-4">
      <ul className="divide-y divide-border">
        {lines.map((l) => {
          const max = l.quantity - l.refundedQty;
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{l.title}{l.variantTitle && <span className="text-muted"> · {l.variantTitle}</span>}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number" min={0} max={max} name={`qty:${l.id}`} disabled={max === 0}
                  aria-label={`${l.title} ${t("sf.quantity")}`}
                  className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right tabular-nums"
                  value={qty[l.id] ?? 0}
                  onChange={(e) => { setQty((q) => ({ ...q, [l.id]: Math.max(0, Math.min(max, parseInt(e.target.value || "0", 10) || 0)) })); setAmount(null); }}
                />
                <span className="text-muted">/ {max}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {canRefundMoney && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={`${t("orders.refund.shipping")} (${currency})`} hint={t("orders.refund.shippingHint", { amount: centsToInput(shippingCents) })} inputMode="decimal" value={shipping} onChange={(e) => { setShipping(e.target.value); setAmount(null); }} />
          <Input name="amount" label={`${t("orders.refund.amount")} (${currency})`} hint={t("orders.refund.available", { amount: centsToInput(remainingCents) })} inputMode="decimal" value={amount ?? centsToInput(suggested)} onChange={(e) => setAmount(e.target.value)} />
        </div>
      )}
      {!canRefundMoney && <input type="hidden" name="amount" value="0" />}
      <Input name="reason" label={t("orders.refund.reason")} maxLength={300} />
      <div className="space-y-2">
        <Checkbox name="restock" label={t("orders.refund.restock")} defaultChecked />
        <Checkbox name="notify" label={t("orders.notifyCustomer")} defaultChecked />
      </div>
      <SubmitButton variant="danger" pendingLabel={t("checkout.processing")}>{t("orders.refund.submit")}</SubmitButton>
    </ActionForm>
  );
}
