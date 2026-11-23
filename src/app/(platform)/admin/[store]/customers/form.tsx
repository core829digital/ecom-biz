import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import type { Translator } from "@/lib/i18n";
import type { ActionState } from "@/lib/action";
import type { Customer } from "@prisma/client";

export function CustomerForm({ action, customer, t }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; customer?: Customer; t: Translator }) {
  return (
    <ActionForm action={action}>
      <Card title={t("customers.overview")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="firstName" label={t("checkout.firstName")} defaultValue={customer?.firstName ?? ""} />
          <Input name="lastName" label={t("checkout.lastName")} defaultValue={customer?.lastName ?? ""} />
          <Input name="email" type="email" label={t("field.email")} defaultValue={customer?.email ?? ""} required />
          <Input name="phone" label={t("checkout.phone")} defaultValue={customer?.phone ?? ""} />
          <Input name="tags" label={t("products.field.tags")} hint={t("products.field.tagsHint")} defaultValue={customer?.tags.join(", ") ?? ""} wrapperClassName="sm:col-span-2" />
          <Textarea name="note" label={t("orders.notes")} rows={3} defaultValue={customer?.note ?? ""} wrapperClassName="sm:col-span-2" />
          <Checkbox name="acceptsMarketing" label={t("customers.marketing")} defaultChecked={customer?.acceptsMarketing ?? false} className="sm:col-span-2" />
        </div>
        <div className="mt-4 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
      </Card>
    </ActionForm>
  );
}
