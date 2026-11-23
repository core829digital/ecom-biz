import { AlertTriangle, Check, CreditCard, MailCheck, ShieldAlert, X } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { clientIp } from "@/lib/http";
import { graceEndsAt } from "@/lib/billing-rules";
import { limitsOf, ownedStoreCount } from "@/server/plans";
import { trialEligibility } from "@/server/trial";
import { Badge } from "@/components/ui/primitives";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { billingPortalAction, choosePlanAction } from "../actions";
import { resendVerificationAction } from "../../(auth)/actions";

const ERRORS = ["verify_email", "hold", "not_configured", "no_account"] as const;

function Notice({ tone, icon: Icon, title, children }: { tone: "warning" | "danger" | "info" | "success"; icon: typeof AlertTriangle; title: string; children?: React.ReactNode }) {
  const tones = { warning: "border-warning/30 bg-warning-bg text-warning", danger: "border-danger/30 bg-danger-bg text-danger", info: "border-info/30 bg-info-bg text-info", success: "border-success/30 bg-success-bg text-success" };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-3 rounded-xl border p-4 text-sm ${tones[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1"><p className="font-medium">{title}</p>{children && <div className="mt-1 text-text/80">{children}</div>}</div>
    </div>
  );
}

export default async function AccountBillingPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string; verified?: string }> }) {
  const sp = await searchParams;
  const sessionUser = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: sessionUser.id }, include: { plan: true } });
  const { t, locale } = await getPlatformT();
  const plans = await db.plan.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  const stores = await ownedStoreCount(user.id);
  const limits = limitsOf(user.plan);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long" });
  const ip = await clientIp();
  const status = user.subscriptionStatus;
  const live = !!user.stripeSubscriptionId && ["TRIALING", "ACTIVE", "PAST_DUE"].includes(status);
  const trialLeft = status === "TRIALING" && user.trialEndsAt ? Math.max(0, Math.ceil((user.trialEndsAt.getTime() - Date.now()) / 86400_000)) : null;
  const tone = status === "ACTIVE" ? "success" : status === "TRIALING" ? "info" : status === "NONE" ? "neutral" : "warning";
  const unlimited = t("billing.unlimited");
  const limitText = (n: number | null) => (n === null ? unlimited : String(n));
  // Trial offer per plan (same rules the checkout applies).
  const offers = new Map(await Promise.all(plans.map(async (p) => [p.id, live ? { trialDays: 0 } : await trialEligibility(user, p.trialDays, ip)] as const)));
  const anyTrial = [...offers.values()].some((o) => o.trialDays > 0);
  const trialUsed = !live && !anyTrial && !!user.trialUsedAt;
  const errorKey = ERRORS.find((e) => e === sp.error);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("nav.billing")}</h1>
      {sp.updated && <Notice tone="success" icon={Check} title={t("billing.updated")} />}
      {sp.verified && <Notice tone="success" icon={MailCheck} title={t("auth.verify.done")} />}
      {sp.error && <Notice tone="danger" icon={AlertTriangle} title={errorKey ? t(`billing.error.${errorKey}`) : t("billing.error")} />}

      {user.billingHold && (
        <Notice tone="danger" icon={ShieldAlert} title={t("billing.hold.title")}>{t("billing.hold.body")}</Notice>
      )}
      {!user.emailVerifiedAt && (
        <Notice tone="warning" icon={MailCheck} title={t("billing.verify.title")}>
          <p>{t("billing.verify.body", { email: user.email })}</p>
          <ActionForm action={resendVerificationAction} className="mt-3"><SubmitButton variant="secondary">{t("auth.verify.resend")}</SubmitButton></ActionForm>
        </Notice>
      )}

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-lg font-semibold">{status === "NONE" ? t("billing.noSubscription") : user.plan?.name ?? t("billing.noPlan")}</p>
          <Badge tone={tone}>{t(`platform.sub.${status}`)}</Badge>
        </div>
        <div className="mt-1 space-y-1 text-sm text-muted">
          {status === "TRIALING" && trialLeft !== null && user.trialEndsAt && (
            <>
              <p>{t("billing.trialLeft", { days: trialLeft, date: date.format(user.trialEndsAt) })}</p>
              {user.plan && <p>{t("billing.trialCharge", { amount: formatMoney(user.plan.priceCents, user.plan.currency, locale), date: date.format(user.trialEndsAt) })}</p>}
              <p>{t("billing.trialCancelNote")}</p>
            </>
          )}
          {status === "ACTIVE" && user.currentPeriodEnd && <p>{t(user.cancelAtPeriodEnd ? "billing.endsOn" : "billing.renewsOn", { date: date.format(user.currentPeriodEnd) })}</p>}
          {status === "NONE" && <p>{anyTrial ? t("billing.noneTrial") : t("billing.nonePay")}</p>}
          {status === "CANCELED" && <p>{t("billing.canceledBody")}</p>}
        </div>
        {status === "PAST_DUE" && user.pastDueSince && (
          <div className="mt-3"><Notice tone="warning" icon={CreditCard} title={t("billing.pastDue.title")}>{t("billing.pastDue.body", { date: date.format(graceEndsAt(user.pastDueSince)) })}</Notice></div>
        )}
        {env.billingEnforced && stores > limits.stores && (
          <div className="mt-3"><Notice tone="warning" icon={AlertTriangle} title={t("billing.overLimit.title", { count: stores - limits.stores })}>{t("billing.overLimit.body", { limit: limits.stores })}</Notice></div>
        )}
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
          <form action={billingPortalAction} className="mt-4"><ConfirmSubmit>{status === "PAST_DUE" ? t("billing.updateCard") : t("billing.manage")} ↗</ConfirmSubmit></form>
        )}
      </section>

      <ul className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const current = p.id === user.planId && live;
          const l = limitsOf(p);
          const offer = offers.get(p.id)!;
          const feats: [string, boolean][] = [
            [t("billing.feature.stores", { count: l.stores }), true],
            [l.products === null ? t("billing.feature.unlimitedProducts") : t("billing.feature.products", { count: l.products }), true],
            [l.staff === null ? t("billing.feature.unlimitedStaff") : t("billing.feature.staff", { count: l.staff }), true],
            [t("billing.feature.customDomain"), l.customDomain],
            [t("billing.feature.api"), l.api],
          ];
          const cta = current ? t("billing.currentPlan") : live ? t("billing.switch") : offer.trialDays > 0 && p.priceCents > 0 ? t("billing.startTrial", { days: offer.trialDays }) : t("billing.subscribe");
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
                <ConfirmSubmit variant={current ? "secondary" : "primary"} className="w-full">{cta}</ConfirmSubmit>
              </form>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1 text-xs text-muted">
        {!live && <p>{trialUsed ? t("billing.trialUsedNote") : t("billing.trialTerms")}</p>}
        {!getStripe() && <p>{t("billing.stripeMissing")}</p>}
        {!env.billingEnforced && <p>{t("platform.billingNotEnforced")}</p>}
      </div>
    </div>
  );
}
