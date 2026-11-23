import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/fields";
import { updateUserBillingAction } from "../../actions";

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
          <ActionForm action={updateUserBillingAction.bind(null, user.id)} className="space-y-4">
            <Select name="planId" label={t("platform.plan")} defaultValue={user.planId ?? ""}>
              <option value="">—</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {t("billing.feature.stores", { count: p.maxStores })}</option>)}
            </Select>
            <Select name="status" label={t("common.status")} defaultValue={user.subscriptionStatus}>
              {(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "NONE"] as const).map((s) => <option key={s} value={s}>{t(`platform.sub.${s}`)}</option>)}
            </Select>
            <Input name="extendTrialDays" type="number" min={0} max={365} label={t("platform.extendTrial")} defaultValue="0" />
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
