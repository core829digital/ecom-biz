import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { parseManualPayments } from "@/server/payments";
import { feeBpsForStore } from "@/server/plans";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Checkbox, Textarea } from "@/components/ui/fields";
import { connectStripeAction, saveManualPaymentsAction, stripeDashboardAction } from "../actions";
import { refreshStripeStatus } from "@/server/stripe-connect";

export default async function PaymentsSettings({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<{ stripe?: string; error?: string }> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store: initial, role } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  if (sp.stripe === "return" && initial.stripeAccountId) await refreshStripeStatus(initial).catch(() => undefined);
  const store = await db.store.findUniqueOrThrow({ where: { id: initial.id } });
  const stripeReady = !!getStripe();
  const manual = parseManualPayments(store.manualPayments);
  const feePct = ((await feeBpsForStore(store)) / 100).toFixed(2);

  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/settings`} label={t("nav.settings")} />} title={t("nav.payments")} />
      <div className="space-y-5">
        <Card title={t("settings.payments.cards")} actions={store.stripeChargesEnabled ? <Badge tone="success">{t("settings.payments.active")}</Badge> : store.stripeAccountId ? <Badge tone="warning">{t("settings.payments.pending")}</Badge> : <Badge>{t("settings.payments.inactive")}</Badge>}>
          <p className="text-sm text-muted">{t("settings.payments.cardsDesc")}</p>
          {!stripeReady ? (
            <p className="mt-4 rounded-lg bg-warning-bg p-3 text-sm text-warning">{t("settings.payments.notConfigured")}</p>
          ) : role !== "OWNER" ? (
            <p className="mt-4 text-sm text-muted">{t("settings.payments.ownerOnly")}</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!store.stripeChargesEnabled && (
                <form action={connectStripeAction.bind(null, slug)}>
                  <ConfirmSubmit variant="primary">{store.stripeAccountId ? t("settings.payments.continue") : t("settings.payments.connect")}</ConfirmSubmit>
                </form>
              )}
              {store.stripeAccountId && store.stripeChargesEnabled && (
                <form action={stripeDashboardAction.bind(null, slug)}>
                  <ConfirmSubmit>{t("settings.payments.dashboard")} ↗</ConfirmSubmit>
                </form>
              )}
              {store.stripeChargesEnabled && !store.stripePayoutsEnabled && <span className="text-sm text-warning">{t("settings.payments.payoutsPending")}</span>}
            </div>
          )}
          {sp.error === "stripe" && <p className="mt-3 text-sm text-danger">{t("settings.payments.notConfigured")}</p>}
          {stripeReady && <p className="mt-4 text-xs text-muted">{t("settings.payments.fee", { fee: feePct })}</p>}
        </Card>

        <ActionForm action={saveManualPaymentsAction.bind(null, slug)}>
          <Card title={t("settings.payments.manual")}>
            <p className="mb-4 text-sm text-muted">{t("settings.payments.manualDesc")}</p>
            <div className="space-y-6">
              <div className="space-y-3">
                <Checkbox name="codEnabled" label={t("checkout.method.cod")} defaultChecked={manual.cod.enabled} />
                <Textarea name="codInstructions" label={t("settings.payments.instructions")} rows={2} defaultValue={manual.cod.instructions} hint={t("settings.payments.codHint")} />
              </div>
              <div className="space-y-3 border-t border-border pt-5">
                <Checkbox name="bankEnabled" label={t("checkout.method.bank_transfer")} defaultChecked={manual.bankTransfer.enabled} />
                <Textarea name="bankInstructions" label={t("settings.payments.instructions")} rows={3} defaultValue={manual.bankTransfer.instructions} hint={t("settings.payments.bankHint")} />
              </div>
            </div>
            <div className="mt-5 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
          </Card>
        </ActionForm>
        {env.testGatewayEnabled && !env.isProduction && <p className="text-xs text-muted">{t("settings.payments.testGateway")}</p>}
      </div>
    </>
  );
}
