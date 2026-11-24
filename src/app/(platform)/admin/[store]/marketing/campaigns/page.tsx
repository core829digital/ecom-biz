import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { emailDeliveryDisabled } from "@/server/marketing";
import { MarketingTabs } from "../tabs";
import { createCampaignAction } from "./actions";

const TONE = { DRAFT: "neutral", SCHEDULED: "info", SENDING: "warning", SENT: "success", CANCELLED: "neutral" } as const;

export default async function CampaignsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t, locale } = await getPlatformT();
  const campaigns = await db.emailCampaign.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  const create = <form action={createCampaignAction.bind(null, slug)}><SubmitButton>{t("campaigns.new")}</SubmitButton></form>;
  return (
    <>
      <PageHeader title={t("nav.marketing")} subtitle={t("campaigns.subtitle")} actions={create} />
      <MarketingTabs slug={slug} active="campaigns" t={t} />
      {emailDeliveryDisabled() && <p role="status" className="mb-4 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">{t("campaigns.error.email_disabled")}</p>}
      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface"><EmptyState title={t("campaigns.title")} description={t("campaigns.empty")} action={create} /></div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {campaigns.map((c) => {
            const when = c.finishedAt ?? c.scheduledAt ?? c.startedAt ?? c.updatedAt;
            const pct = c.recipientCount ? Math.round(((c.sentCount + c.failedCount) / c.recipientCount) * 100) : 0;
            return (
              <li key={c.id}>
                <Link href={`/admin/${slug}/marketing/campaigns/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.subject}</span>
                    <span className="text-xs text-muted">{date.format(when)}{c.createdByAi && ` · ${t("campaigns.byAi")}`}</span>
                  </span>
                  {c.status === "SENDING" && (
                    <span className="flex w-28 items-center gap-2" aria-label={`${pct}%`}>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} /></span>
                      <span className="text-xs tabular-nums text-muted">{pct}%</span>
                    </span>
                  )}
                  {c.status === "SENT" && <span className="text-sm tabular-nums text-muted">{c.sentCount}/{c.recipientCount}</span>}
                  <Badge tone={TONE[c.status]}>{t(`campaigns.status.${c.status}`)}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
