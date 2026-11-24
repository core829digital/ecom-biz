import Link from "next/link";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/fields";
import { saveContactSettingsAction } from "./actions";

export default async function InboxPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const messages = await db.contactMessage.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: store.timezone });
  const url = `${await storePublicUrl(store)}/contact`;
  return (
    <>
      <PageHeader title={t("nav.inbox")} subtitle={t("inbox.subtitle")} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_18rem]">
        <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          {messages.length === 0 ? <EmptyState title={t("inbox.empty.title")} description={t("inbox.empty.description")} /> : (
            <ul className="divide-y divide-border">
              {messages.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/${slug}/inbox/${m.id}`} className="flex gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${m.readAt ? "bg-transparent" : "bg-accent"}`} aria-label={m.readAt ? undefined : t("notify.unread")} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate text-sm ${m.readAt ? "" : "font-semibold"}`}>{m.name}</span>
                        <span className="shrink-0 text-xs text-muted">{date.format(m.createdAt)}</span>
                      </span>
                      <span className="block truncate text-sm">{m.subject || t("email.contact.noSubject")}</span>
                      <span className="block truncate text-xs text-muted">{m.message}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <Card title={t("inbox.settings")}>
          <ActionForm action={saveContactSettingsAction.bind(null, slug)} className="space-y-4">
            <Checkbox name="contactEnabled" label={t("inbox.enabled")} hint={t("inbox.enabledHint")} defaultChecked={store.contactEnabled} />
            <SubmitButton>{t("common.save")}</SubmitButton>
          </ActionForm>
          <a href={url} target="_blank" rel="noreferrer" className="mt-4 block truncate text-sm underline">{url}</a>
        </Card>
      </div>
    </>
  );
}
