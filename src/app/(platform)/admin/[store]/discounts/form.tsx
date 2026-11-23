"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import type { ActionState } from "@/lib/action";

export type DiscountFormValues = {
  code: string; type: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING"; value: string; minSubtotal: string; usageLimit: string;
  oncePerCustomer: boolean; startsAt: string; endsAt: string; active: boolean;
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(10)), (n) => chars[n % chars.length]).join("");
}

export function DiscountForm({ action, initial, currency }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; initial: DiscountFormValues; currency: string }) {
  const t = useT();
  const [code, setCode] = useState(initial.code);
  const [type, setType] = useState(initial.type);
  return (
    <ActionForm action={action} className="space-y-5">
      <Card title={t("discounts.code")}>
        <div className="flex items-end gap-2">
          <Input name="code" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={40} label={t("discounts.code")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} wrapperClassName="flex-1" hint={t("discounts.codeHint")} required />
          <Button variant="secondary" className="mb-5" onClick={() => setCode(randomCode())}>{t("discounts.generate")}</Button>
        </div>
      </Card>
      <Card title={t("discounts.value")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select name="type" label={t("discounts.type")} value={type} onChange={(e) => setType(e.target.value as DiscountFormValues["type"])}>
            <option value="PERCENTAGE">{t("discounts.type.PERCENTAGE")}</option>
            <option value="FIXED_AMOUNT">{t("discounts.type.FIXED_AMOUNT")}</option>
            <option value="FREE_SHIPPING">{t("discounts.type.FREE_SHIPPING")}</option>
          </Select>
          {type !== "FREE_SHIPPING" && (
            <Input name="value" label={type === "PERCENTAGE" ? `${t("discounts.value")} (%)` : `${t("discounts.value")} (${currency})`} inputMode="decimal" defaultValue={initial.value} required />
          )}
          <Input name="minSubtotal" label={`${t("discounts.minSubtotal")} (${currency})`} inputMode="decimal" defaultValue={initial.minSubtotal} placeholder={t("common.optional")} />
        </div>
      </Card>
      <Card title={t("discounts.limits")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="usageLimit" type="number" min={1} label={t("discounts.usageLimit")} defaultValue={initial.usageLimit} placeholder={t("discounts.unlimited")} />
          <div className="flex items-end pb-2"><Checkbox name="oncePerCustomer" label={t("discounts.oncePerCustomer")} defaultChecked={initial.oncePerCustomer} /></div>
          <Input name="startsAt" type="datetime-local" label={t("discounts.startsAt")} defaultValue={initial.startsAt} />
          <Input name="endsAt" type="datetime-local" label={t("discounts.endsAt")} defaultValue={initial.endsAt} hint={t("common.optional")} />
        </div>
        <Checkbox name="active" className="mt-4" label={t("discounts.active")} defaultChecked={initial.active} />
      </Card>
      <div className="flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
    </ActionForm>
  );
}
