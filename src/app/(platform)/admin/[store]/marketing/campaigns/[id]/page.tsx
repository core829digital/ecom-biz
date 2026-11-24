import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { parseTheme } from "@/lib/theme";
import { Badge, Card, PageHeader, Stat } from "@/components/ui/primitives";
import { ConfirmSubmit } from "@/components/ui/form";
import { BackLink } from "@/components/admin/back-link";
import { bodyToHtml } from "@/lib/marketing-render";
import { emailDeliveryDisabled } from "@/server/marketing";
import { CampaignEditor } from "./editor";
import { cancelScheduleAction, campaignFormAction, deleteCampaignAction, duplicateCampaignAction } from "../actions";

export default async function CampaignPage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const c = await db.emailCampaign.findFirst({ where: { id, storeId: store.id } });
  if (!c) notFound();
  const audience = await db.newsletterSubscriber.count({ where: { storeId: store.id, status: "SUBSCRIBED" } });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  const editable = c.status === "DRAFT";
  const back = <BackLink href={`/admin/${slug}/marketing/campaigns`} label={t("campaigns.title")} />;
  const actions = (
    <div className="flex gap-2">
      <form action={duplicateCampaignAction.bind(null, slug, c.id)}><ConfirmSubmit variant="secondary">{t("campaigns.duplicate")}</ConfirmSubmit></form>
      {(c.status === "DRAFT" || c.status === "CANCELLED") && <form action={deleteCampaignAction.bind(null, slug, c.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("campaigns.delete")}>{t("campaigns.delete")}</ConfirmSubmit></form>}
    </div>
  );
  return (
    <>
      <PageHeader back={back} title={c.subject} subtitle={<Badge>{t(`campaigns.status.${c.status}`)}</Badge>} actions={actions} />
      {emailDeliveryDisabled() && editable && <p role="status" className="mb-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">{t("campaigns.error.email_disabled")}</p>}
      {c.status === "SCHEDULED" && c.scheduledAt && (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{t("campaigns.status.SCHEDULED")}: <strong>{date.format(c.scheduledAt)}</strong></p>
            <form action={cancelScheduleAction.bind(null, slug, c.id)}><ConfirmSubmit variant="secondary">{t("campaigns.cancelSchedule")}</ConfirmSubmit></form>
          </div>
        </Card>
      )}
      {editable ? (
        <CampaignEditor
          initial={{ subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl }}
          action={campaignFormAction.bind(null, slug, c.id)}
          audience={audience}
          brandColor={parseTheme(store.theme).primaryColor}
          storeName={store.name}
          disabledSend={emailDeliveryDisabled()}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={t("campaigns.stats.recipients")} value={c.recipientCount} />
            <Stat label={t("campaigns.stats.sent")} value={c.sentCount} hint={c.finishedAt ? date.format(c.finishedAt) : undefined} />
            <Stat label={t("campaigns.stats.failed")} value={c.failedCount} />
          </div>
          <Card title={t("campaigns.preview")}>
            <h2 className="mb-3 text-lg font-semibold">{c.heading || c.subject}</h2>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: bodyToHtml(c.body) }} />
          </Card>
        </div>
      )}
    </>
  );
}
