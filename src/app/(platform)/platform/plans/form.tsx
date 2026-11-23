import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import { CURRENCIES } from "@/lib/geo";
import { centsToInput } from "@/lib/money";
import type { Translator } from "@/lib/i18n";
import type { ActionState } from "@/lib/action";
import type { Plan } from "@prisma/client";

export function PlanForm({ action, plan, t }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; plan?: Plan; t: Translator }) {
  return (
    <ActionForm action={action}>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="name" label={t("common.name")} defaultValue={plan?.name} required />
          <Input name="position" type="number" label={t("platform.position")} defaultValue={String(plan?.position ?? 0)} />
          <Input name="price" label={t("products.field.price")} inputMode="decimal" defaultValue={plan ? centsToInput(plan.priceCents) : ""} required />
          <div className="grid grid-cols-2 gap-3">
            <Select name="currency" label={t("field.currency")} defaultValue={plan?.currency ?? "EUR"}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
            <Select name="interval" label={t("platform.interval")} defaultValue={plan?.interval ?? "month"}>
              <option value="month">{t("platform.interval.month")}</option>
              <option value="year">{t("platform.interval.year")}</option>
            </Select>
          </div>
          <Input name="feePct" label={t("platform.transactionFee")} inputMode="decimal" defaultValue={plan ? String(plan.transactionFeeBps / 100) : "0"} hint={t("platform.transactionFeeHint")} />
          <Input name="trialDays" type="number" min={0} max={365} label={t("platform.trialDays")} defaultValue={String(plan?.trialDays ?? 14)} />
          <Textarea name="features" label={t("platform.features")} hint={t("platform.featuresHint")} rows={5} defaultValue={plan?.features.join("\n")} wrapperClassName="sm:col-span-2" />
          <Checkbox name="active" label={t("platform.planActive")} defaultChecked={plan?.active ?? true} className="sm:col-span-2" />
        </div>
        {plan?.stripePriceId && <p className="mt-4 text-xs text-muted">Stripe price: <code>{plan.stripePriceId}</code></p>}
        <div className="mt-4 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
