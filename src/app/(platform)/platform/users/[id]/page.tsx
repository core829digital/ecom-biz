import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/fields";
import { markEmailVerifiedAction, updateUserBillingAction } from "../../actions";

export default async function PlatformUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getPlatformT();
  const user = await db.user.findUnique({ where: { id }, include: { plan: true, memberships: { include: { store: true } } } });
  if (!user) notFound();
  const plans = await db.plan.findMany({ orderBy: { position: "asc" } });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium" });
  return (
    <>
      <PageHeader back={<BackLink href="/platform/users" label={t("platform.users")} />} title={user.name} subtitle={user.email} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("platform.billing")}>
          <p className="mb-4 text-sm">
            {user.plan?.name ?? "—"} · <Badge>{t(`platform.sub.${user.subscriptionStatus}`)}</Badge>
            {user.trialEndsAt && <span className="text-muted"> · {t("platform.trialEnds", { date: date.format(user.trialEndsAt) })}</span>}
          </p>
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">{t("platform.emailVerified")}</dt><dd>{user.emailVerifiedAt ? date.format(user.emailVerifiedAt) : (
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="warning">{t("common.no")}</Badge>
                <form action={markEmailVerifiedAction.bind(null, user.id)}><button className="text-xs underline">{t("platform.markVerified")}</button></form>
              </span>
            )}</dd>
            <dt className="text-muted">{t("platform.trialUsed")}</dt><dd>{user.trialUsedAt ? date.format(user.trialUsedAt) : t("common.no")}</dd>
            {user.currentPeriodEnd && <><dt className="text-muted">{t(user.cancelAtPeriodEnd ? "platform.endsOn" : "platform.renewsOn")}</dt><dd>{date.format(user.currentPeriodEnd)}</dd></>}
            {user.pastDueSince && <><dt className="text-muted">{t("platform.pastDueSince")}</dt><dd>{date.format(user.pastDueSince)}</dd></>}
            {user.stripeSubscriptionId && <><dt className="text-muted">Stripe</dt><dd className="truncate font-mono text-xs">{user.stripeSubscriptionId}</dd></>}
          </dl>
          {user.billingHold && <p role="alert" className="mb-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{t("platform.holdActive", { reason: user.billingHoldReason ?? "—" })}</p>}
          {user.stripeSubscriptionId && <p className="mb-4 text-xs text-muted">{t("platform.stripeSyncNote")}</p>}
          <ActionForm action={updateUserBillingAction.bind(null, user.id)} className="space-y-4">
            <Select name="planId" label={t("platform.plan")} defaultValue={user.planId ?? ""}>
              <option value="">—</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {t("billing.feature.stores", { count: p.maxStores })}</option>)}
            </Select>
            <Select name="status" label={t("common.status")} defaultValue={user.subscriptionStatus}>
              {(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "NONE"] as const).map((s) => <option key={s} value={s}>{t(`platform.sub.${s}`)}</option>)}
            </Select>
            <Input name="extendTrialDays" type="number" min={0} max={365} label={t("platform.extendTrial")} defaultValue="0" />
            <Checkbox name="billingHold" label={t("platform.hold")} hint={t("platform.holdHint")} defaultChecked={user.billingHold} />
            <SubmitButton>{t("common.save")}</SubmitButton>
          </ActionForm>
        </Card>
        <Card title={t("platform.stores")}>
          <ul className="space-y-2 text-sm">
            {user.memberships.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <Link href={`/platform/stores/${m.store.id}`} className="hover:underline">{m.store.name}</Link>
                <Badge>{t(`role.${m.role}`)}</Badge>
              </li>
            ))}
            {user.memberships.length === 0 && <li className="text-muted">—</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
