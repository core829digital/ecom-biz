import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { billingPortalAction, choosePlanAction } from "./actions";

export default async function BillingPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ updated?: string; error?: string }> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store, role } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeZone: store.timezone });
  const stripe = !!getStripe();
  const owner = role === "OWNER";
  const trialLeft = store.subscriptionStatus === "TRIALING" && store.trialEndsAt ? Math.max(0, Math.ceil((store.trialEndsAt.getTime() - Date.now()) / 86400_000)) : null;
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.billing")} />
      {sp.updated && <p role="status" className="mb-5 rounded-lg bg-success-bg p-3 text-sm text-success">{t("billing.updated")}</p>}
      {sp.error && <p role="alert" className="mb-5 rounded-lg bg-danger-bg p-3 text-sm text-danger">{t("billing.error")}</p>}
      <Card className="mb-5" title={t("billing.current")}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold">{plans.find((p) => p.id === store.planId)?.name ?? t("billing.noPlan")}</span>
          <Badge tone={store.subscriptionStatus === "ACTIVE" ? "success" : store.subscriptionStatus === "TRIALING" ? "info" : "warning"}>{t(`platform.sub.${store.subscriptionStatus}`)}</Badge>
        </div>
        {trialLeft !== null && <p className="mt-2 text-sm text-muted">{t("billing.trialLeft", { days: trialLeft, date: date.format(store.trialEndsAt!) })}</p>}
        {owner && store.stripeCustomerId && stripe && (
          <form action={billingPortalAction.bind(null, slug)} className="mt-4"><ConfirmSubmit>{t("billing.manage")} ↗</ConfirmSubmit></form>
        )}
      </Card>
      {plans.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = p.id === store.planId && store.subscriptionStatus === "ACTIVE";
            return (
              <li key={p.id} className={`flex flex-col rounded-xl border bg-surface p-5 shadow-sm ${p.id === store.planId ? "border-accent" : "border-border"}`}>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(p.priceCents, p.currency, locale)}<span className="text-sm font-normal text-muted"> / {t(`platform.interval.${p.interval as "month"}`)}</span></p>
                <p className="mt-1 text-xs text-muted">{t("billing.fee", { fee: (p.transactionFeeBps / 100).toFixed(2) })}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                {owner && (
                  <form action={choosePlanAction.bind(null, slug, p.id)} className="mt-5">
                    <ConfirmSubmit variant={current ? "secondary" : "primary"} className="w-full">{current ? t("billing.currentPlan") : t("billing.choose")}</ConfirmSubmit>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!stripe && <p className="mt-5 text-xs text-muted">{t("billing.stripeMissing")}</p>}
      {!owner && <p className="mt-5 text-sm text-muted">{t("settings.payments.ownerOnly")}</p>}
    </>
  );
}
