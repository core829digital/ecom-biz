import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { storePublicUrl } from "@/lib/tenant";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/fields";
import { LinkButton } from "@/components/ui/button";
import { setStoreStatusAction, updateStoreFeeAction } from "../../actions";

export default async function PlatformStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getPlatformT();
  const store = await db.store.findUnique({ where: { id }, include: { memberships: { include: { user: { include: { plan: true } } } }, domains: true } });
  if (!store) notFound();
  const agg = await db.order.aggregate({ where: { storeId: id, status: { not: "CANCELLED" } }, _count: true, _sum: { totalCents: true, refundedCents: true, platformFeeCents: true } });
  const owner = store.memberships.find((m) => m.role === "OWNER")?.user;
  const money = (c: number) => formatMoney(c, store.currency, locale);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium" });
  const url = await storePublicUrl(store);
  return (
    <>
      <PageHeader
        back={<BackLink href="/platform/stores" label={t("platform.stores")} />}
        title={<span className="flex items-center gap-2">{store.name} <Badge tone={store.status === "ACTIVE" ? "success" : "danger"}>{t(`platform.storeStatus.${store.status}`)}</Badge></span>}
        subtitle={<a href={url} className="underline" target="_blank" rel="noreferrer">{url}</a>}
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
        <Card title={t("platform.owner")}>
          {owner ? (
            <div className="space-y-1 text-sm">
              <Link href={`/platform/users/${owner.id}`} className="font-medium hover:underline">{owner.name}</Link>
              <p className="text-muted">{owner.email}</p>
              <p>{owner.plan?.name ?? "—"} · {t(`platform.sub.${owner.subscriptionStatus}`)}{owner.trialEndsAt && owner.subscriptionStatus === "TRIALING" && <span className="text-muted"> · {t("platform.trialEnds", { date: date.format(owner.trialEndsAt) })}</span>}</p>
            </div>
          ) : <p className="text-sm text-muted">—</p>}
          <ActionForm action={updateStoreFeeAction.bind(null, store.id)} className="mt-5 space-y-3 border-t border-border pt-4">
            <Input name="feePct" label={t("platform.feeOverride")} hint={t("platform.feeOverrideHint")} inputMode="decimal" defaultValue={store.platformFeeBps !== null ? String(store.platformFeeBps / 100) : ""} />
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
