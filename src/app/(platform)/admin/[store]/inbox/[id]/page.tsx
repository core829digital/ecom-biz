import { notFound } from "next/navigation";
import { Reply } from "lucide-react";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { deleteMessageAction, markUnreadAction } from "../actions";

export default async function MessagePage({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store } = await requireStoreAccess(slug);
  const { t, locale } = await getPlatformT();
  const m = await db.contactMessage.findFirst({ where: { id, storeId: store.id } });
  if (!m) notFound();
  if (!m.readAt) await db.contactMessage.update({ where: { id: m.id }, data: { readAt: new Date() } });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: store.timezone });
  const order = m.orderRef && /^\d+$/.test(m.orderRef) ? await db.order.findFirst({ where: { storeId: store.id, number: Number(m.orderRef) }, select: { id: true, number: true } }) : null;
  const reply = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject || store.name}`)}`;
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/inbox`} label={t("nav.inbox")} />}
        title={m.subject || t("email.contact.noSubject")}
        subtitle={`${m.name} · ${m.email} · ${date.format(m.createdAt)}`}
        actions={
          <>
            <a href={reply} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-contrast"><Reply className="size-4" aria-hidden />{t("inbox.reply")}</a>
            <form action={markUnreadAction.bind(null, slug, m.id)}><ConfirmSubmit>{t("inbox.markUnread")}</ConfirmSubmit></form>
            <form action={deleteMessageAction.bind(null, slug, m.id)}><ConfirmSubmit variant="ghost" className="text-danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>
          </>
        }
      />
      <Card>
        {order && <p className="mb-3 text-sm"><a href={`/admin/${slug}/orders/${order.id}`} className="underline">{t("orders.number", { number: order.number })}</a></p>}
        <p className="whitespace-pre-line text-sm leading-relaxed">{m.message}</p>
      </Card>
    </>
  );
}
