import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { defaultSteps, emailDeliveryDisabled, parseSteps } from "@/server/marketing";
import { MarketingTabs } from "../tabs";
import { saveAutomationAction } from "../campaigns/actions";
import { AutomationEditor } from "./editor";

const TRIGGERS = ["WELCOME", "POST_PURCHASE"] as const;

export default async function AutomationsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const rows = await db.emailAutomation.findMany({ where: { storeId: store.id }, include: { _count: { select: { runs: { where: { doneAt: null } } } } } });
  return (
    <>
      <PageHeader title={t("nav.marketing")} subtitle={t("automations.subtitle")} />
      <MarketingTabs slug={slug} active="automations" t={t} />
      {emailDeliveryDisabled() && <p role="status" className="mb-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">{t("automations.emailOff")}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        {TRIGGERS.map((trigger) => {
          const row = rows.find((r) => r.trigger === trigger);
          const steps = row ? parseSteps(row.steps) : defaultSteps(trigger, store.locale, store.name);
          return (
            <Card key={trigger} title={t(`automations.${trigger}`)} actions={row?.enabled ? <Badge tone="success">{t("automations.enabled")}</Badge> : undefined}>
              <p className="-mt-1 mb-4 text-sm text-muted">{t(`automations.${trigger}Hint`)}{row && row._count.runs > 0 && ` · ${t("automations.inFlight", { count: row._count.runs })}`}</p>
              <AutomationEditor initialSteps={steps} enabled={!!row?.enabled} action={saveAutomationAction.bind(null, slug, trigger)} defaults={{ ...defaultSteps(trigger, store.locale, store.name)[0], delayHours: 0 }} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
