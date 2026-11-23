import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { centsToInput } from "@/lib/money";
import { toZonedInput } from "@/lib/dates";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { DiscountForm } from "../form";
import { deleteDiscountAction, saveDiscountAction } from "../actions";

export default async function EditDiscount({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const d = await db.discount.findFirst({ where: { id, storeId: store.id } });
  if (!d) notFound();
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/discounts`} label={t("nav.discounts")} />}
        title={<span className="font-mono">{d.code}</span>}
        subtitle={t("discounts.usedTimes", { count: d.usageCount })}
        actions={<form action={deleteDiscountAction.bind(null, slug, d.id)}><ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>}
      />
      <DiscountForm
        action={saveDiscountAction.bind(null, slug, d.id)}
        currency={store.currency}
        initial={{
          code: d.code,
          type: d.type,
          value: d.type === "PERCENTAGE" ? String(d.value / 100) : d.type === "FIXED_AMOUNT" ? centsToInput(d.value) : "",
          minSubtotal: d.minSubtotalCents ? centsToInput(d.minSubtotalCents) : "",
          usageLimit: d.usageLimit ? String(d.usageLimit) : "",
          oncePerCustomer: d.oncePerCustomer,
          startsAt: toZonedInput(d.startsAt, store.timezone),
          endsAt: toZonedInput(d.endsAt, store.timezone),
          active: d.active,
        }}
      />
    </>
  );
}
