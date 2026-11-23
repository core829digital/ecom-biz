import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { storePublicUrl } from "@/lib/tenant";
import { env } from "@/lib/env";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { LinkButton } from "@/components/ui/button";
import { setStoreStatusAction, updateStoreBillingAction } from "../../actions";

export default async function PlatformStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getPlatformT();
  const store = await db.store.findUnique({ where: { id }, include: { plan: true, memberships: { include: { user: true } }, domains: true } });
  if (!store) notFound();
  const [plans, agg] = await Promise.all([
    db.plan.findMany({ orderBy: { position: "asc" } }),
    db.order.aggregate({ where: { storeId: id, status: { not: "CANCELLED" } }, _count: true, _sum: { totalCents: true, refundedCents: true, platformFeeCents: true } }),
  ]);
  const money = (c: number) => formatMoney(c, store.currency, locale);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium" });
  return (
    <>
      <PageHeader
        back={<BackLink href="/platform/stores" label={t("platform.stores")} />}
        title={<span className="flex items-center gap-2">{store.name} <Badge tone={store.status === "ACTIVE" ? "success" : "danger"}>{t(`platform.storeStatus.${store.status}`)}</Badge></span>}
        subtitle={<a href={await storePublicUrl(store)} className="underline" target="_blank" rel="noreferrer">{await storePublicUrl(store)}</a>}
        actions={
          <>
            <LinkButton href={`/admin/${store.slug}`} variant="secondary" size="sm">{t("platform.openAdmin")}</LinkButton>
            <form action={setStoreStatusAction.bind(null, store.id, store.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}>
              <ConfirmSubmit variant={store.status === "ACTIVE" ? "danger" : "primary"} confirmMessage={t("platform.statusConfirm")}>{store.status === "ACTIVE" ? t("platform.suspend") : t("platform.reactivate")}</ConfirmSubmit>
            </form>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t("nav.orders")} value={agg._count} />
        <Stat label={t("platform.gmv")} value={money((agg._sum.totalCents ?? 0) - (agg._sum.refundedCents ?? 0))} />
        <Stat label={t("platform.fees")} value={money(agg._sum.platformFeeCents ?? 0)} />
        <Stat label={t("nav.payments")} value={store.stripeChargesEnabled ? "Stripe ✓" : "—"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("platform.billing")}>
          <p className="mb-4 text-sm">
            {t(`platform.sub.${store.subscriptionStatus}`)}
            {store.trialEndsAt && <span className="text-muted"> · {t("platform.trialEnds", { date: date.format(store.trialEndsAt) })}</span>}
            {!env.billingEnforced && <span className="block text-xs text-muted">{t("platform.billingNotEnforced")}</span>}
          </p>
          <ActionForm action={updateStoreBillingAction.bind(null, store.id)} className="space-y-4">
            <Select name="planId" label={t("platform.plan")} defaultValue={store.planId ?? ""}>
              <option value="">—</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input name="feePct" label={t("platform.feeOverride")} hint={t("platform.feeOverrideHint")} inputMode="decimal" defaultValue={store.platformFeeBps !== null ? String(store.platformFeeBps / 100) : ""} />
            <Input name="extendTrialDays" type="number" min={0} max={365} label={t("platform.extendTrial")} defaultValue="0" />
            <SubmitButton>{t("common.save")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t("nav.staff")}>
          <ul className="space-y-2 text-sm">
            {store.memberships.map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.user.name} <span className="text-muted">{m.user.email}</span></span><Badge>{t(`role.${m.role}`)}</Badge></li>)}
          </ul>
          <dl className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">{t("field.contactEmail")}</dt><dd>{store.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t("field.country")}</dt><dd>{store.countryCode} · {store.currency}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t("nav.domains")}</dt><dd>{store.domains.map((d) => d.hostname).join(", ") || "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{t("platform.created")}</dt><dd>{date.format(store.createdAt)}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}
