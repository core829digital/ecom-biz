import type { Prisma, SubscriberStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge, Card, EmptyState, PageHeader, Stat, Table, Td, Th } from "@/components/ui/primitives";
import { ActionForm, ConfirmSubmit, FieldError, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/fields";
import { FilterTabs, Pagination, SearchBox, parsePage } from "@/components/admin/list";
import { addSubscriberAction, removeSubscriberAction, saveNewsletterSettingsAction, unsubscribeSubscriberAction } from "./actions";

const PER_PAGE = 50;
const VIEWS: Record<string, SubscriberStatus> = { subscribed: "SUBSCRIBED", pending: "PENDING", unsubscribed: "UNSUBSCRIBED" };
const TONE = { SUBSCRIBED: "success", PENDING: "warning", UNSUBSCRIBED: "neutral" } as const;

export default async function MarketingPage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { store: slug } = await params;
  const sp = await searchParams;
  const { store, role } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const base = `/admin/${slug}/marketing`;
  const page = parsePage(sp.page);
  const q = sp.q?.trim().toLowerCase();
  const status = sp.view ? VIEWS[sp.view] : undefined;
  const where: Prisma.NewsletterSubscriberWhereInput = { storeId: store.id, ...(status ? { status } : {}), ...(q ? { email: { contains: q } } : {}) };
  const [total, subs, counts] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.newsletterSubscriber.groupBy({ by: ["status"], where: { storeId: store.id }, _count: true }),
  ]);
  const count = (s: SubscriberStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeZone: store.timezone });
  const admin = hasRole(role, "ADMIN");
  return (
    <>
      <PageHeader
        title={t("nav.marketing")}
        subtitle={t("newsletter.subtitle")}
        actions={admin && count("SUBSCRIBED") > 0 ? <a href={`${base}/export`} download className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("newsletter.export")}</a> : null}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label={t("newsletter.status.SUBSCRIBED")} value={count("SUBSCRIBED")} hint={t("newsletter.subscribedHint")} />
        <Stat label={t("newsletter.status.PENDING")} value={count("PENDING")} hint={t("newsletter.pendingHint")} />
        <Stat label={t("newsletter.status.UNSUBSCRIBED")} value={count("UNSUBSCRIBED")} />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <FilterTabs basePath={base} params={sp} name="view" options={[
            { value: null, label: t("common.all") },
            { value: "subscribed", label: t("newsletter.status.SUBSCRIBED") },
            { value: "pending", label: t("newsletter.status.PENDING") },
            { value: "unsubscribed", label: t("newsletter.status.UNSUBSCRIBED") },
          ]} />
          <SearchBox basePath={base} params={sp} placeholder={t("newsletter.search")} />
          {subs.length === 0 ? (q ? <p className="px-4 py-10 text-center text-sm text-muted">{t("products.noResults")}</p> : <EmptyState title={t("newsletter.empty.title")} description={t("newsletter.empty.description")} />) : (
            <Table>
              <thead><tr><Th>{t("field.email")}</Th><Th>{t("common.status")}</Th><Th>{t("newsletter.source")}</Th><Th>{t("newsletter.consentAt")}</Th><Th className="text-right">{t("common.actions")}</Th></tr></thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium">{s.email}</Td>
                    <Td><Badge tone={TONE[s.status]}>{t(`newsletter.status.${s.status}`)}</Badge></Td>
                    <Td className="text-muted">{t(`newsletter.sourceType.${s.source as "form"}`)}</Td>
                    <Td className="text-muted">{s.consentAt ? date.format(s.consentAt) : "—"}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === "SUBSCRIBED" && <form action={unsubscribeSubscriberAction.bind(null, slug, s.id)}><ConfirmSubmit variant="ghost">{t("newsletter.unsubscribe")}</ConfirmSubmit></form>}
                        {admin && <form action={removeSubscriberAction.bind(null, slug, s.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("newsletter.removeConfirm")}>{t("common.delete")}</ConfirmSubmit></form>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination basePath={base} params={sp} page={page} pages={pages} labels={{ previous: t("common.previous"), next: t("common.next"), summary: t("common.page", { page, pages }) }} />
        </section>
        <div className="space-y-5">
          {admin && (
            <Card title={t("newsletter.settings")}>
              <ActionForm action={saveNewsletterSettingsAction.bind(null, slug)} className="space-y-4">
                <Checkbox name="newsletterEnabled" label={t("newsletter.enabled")} hint={t("newsletter.enabledHint")} defaultChecked={store.newsletterEnabled} />
                <SubmitButton>{t("common.save")}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {admin && (
            <Card title={t("newsletter.add")}>
              <ActionForm action={addSubscriberAction.bind(null, slug)} resetOnSuccess className="space-y-3">
                <Input name="email" type="email" autoComplete="off" label={t("field.email")} required />
                <div>
                  <Checkbox name="consent" label={t("newsletter.consentConfirm")} />
                  <FieldError name="consent" />
                </div>
                <SubmitButton variant="secondary">{t("newsletter.addCta")}</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card title={t("newsletter.sendingTitle")}>
            <p className="text-sm text-muted">{t("newsletter.sendingBody")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
