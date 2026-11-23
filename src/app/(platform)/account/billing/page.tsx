import { Check, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { limitsOf, ownedStoreCount } from "@/server/plans";
import { Badge } from "@/components/ui/primitives";
import { ConfirmSubmit } from "@/components/ui/form";
import { billingPortalAction, choosePlanAction } from "../actions";

export default async function AccountBillingPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const sp = await searchParams;
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { plan: true } });
  const { t, locale } = await getPlatformT();
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  const stores = await ownedStoreCount(user.id);
  const limits = limitsOf(user.plan);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long" });
  const trialLeft = user.subscriptionStatus === "TRIALING" && user.trialEndsAt ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / 86400_000)) : null;
  const tone = user.subscriptionStatus === "ACTIVE" ? "success" : user.subscriptionStatus === "TRIALING" ? "info" : "warning";
  const unlimited = t("billing.unlimited");
  const limitText = (n: number | null) => (n === null ? unlimited : String(n));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("nav.billing")}</h1>
      {sp.updated && <p role="status" className="rounded-lg bg-success-bg p-3 text-sm text-success">{t("billing.updated")}</p>}
      {sp.error && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">{t("billing.error")}</p>}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-semibold">{user.plan?.name ?? t("billing.noPlan")}</p>
          <Badge tone={tone}>{t(`platform.sub.${user.subscriptionStatus}`)}</Badge>
        </div>
        {trialLeft !== null && user.trialEndsAt && <p className="mt-1 text-sm text-muted">{t("billing.trialLeft", { days: trialLeft, date: date.format(user.trialEndsAt) })}</p>}
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            [t("usage.stores"), `${stores} / ${limits.stores}`],
            [t("usage.products"), t("billing.perStore", { value: limitText(limits.products) })],
            [t("usage.staff"), t("billing.perStore", { value: limitText(limits.staff) })],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 p-3">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {user.stripeCustomerId && getStripe() && (
          <form action={billingPortalAction} className="mt-4"><ConfirmSubmit>{t("billing.manage")} ↗</ConfirmSubmit></form>
        )}
      </section>

      <ul className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = p.id === user.planId;
          const l = limitsOf(p);
          const feats: [string, boolean][] = [
            [t("billing.feature.stores", { count: l.stores }), true],
            [l.products === null ? t("billing.feature.unlimitedProducts") : t("billing.feature.products", { count: l.products }), true],
            [l.staff === null ? t("billing.feature.unlimitedStaff") : t("billing.feature.staff", { count: l.staff }), true],
            [t("billing.feature.customDomain"), l.customDomain],
            [t("billing.feature.api"), l.api],
          ];
          return (
            <li key={p.id} className={`relative flex flex-col rounded-2xl border bg-surface p-5 transition-shadow hover:shadow-elevated ${current ? "border-accent ring-1 ring-accent" : "border-border"}`}>
              {current && <span className="absolute -top-2.5 left-5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-contrast">{t("billing.currentPlan")}</span>}
              <p className="font-semibold">{p.name}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
                {formatMoney(p.priceCents, p.currency, locale)}<span className="text-sm font-normal text-muted"> / {t(`platform.interval.${p.interval as "month"}`)}</span>
              </p>
              <p className="mt-1 text-xs text-muted">{t("billing.fee", { fee: (p.transactionFeeBps / 100).toFixed(2) })}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {feats.map(([label, ok]) => (
                  <li key={label} className={`flex items-start gap-2 ${ok ? "" : "text-muted line-through"}`}>
                    {ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0" aria-hidden />}
                    {label}
                  </li>
                ))}
                {p.features.map((f) => <li key={f} className="flex items-start gap-2 text-muted"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{f}</li>)}
              </ul>
              {stores > l.stores && !current && <p className="mt-3 text-xs text-warning">{t("billing.tooManyStores", { count: stores })}</p>}
              <form action={choosePlanAction.bind(null, p.id)} className="mt-5">
                <ConfirmSubmit variant={current ? "secondary" : "primary"} className="w-full">{current && user.subscriptionStatus === "ACTIVE" ? t("billing.currentPlan") : t("billing.choose")}</ConfirmSubmit>
              </form>
            </li>
          );
        })}
      </ul>
      {!getStripe() && <p className="text-xs text-muted">{t("billing.stripeMissing")}</p>}
      {!env.billingEnforced && <p className="text-xs text-muted">{t("platform.billingNotEnforced")}</p>}
    </div>
  );
}
