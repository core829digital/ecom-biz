import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { emailAlways, NOTIFICATION_GROUPS, NOTIFICATION_TYPES, wantsEmail, type NotificationType } from "@/lib/notification-types";
import { renderNotification } from "@/server/notifications";
import { markAllReadAction, saveNotificationPrefsAction } from "@/components/notifications/actions";

export default async function NotificationsPage() {
  const user = await requireUser();
  const { t, locale } = await getPlatformT();
  const [items, prefs] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { store: { select: { name: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationPrefs: true } }),
  ]);
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const types = Object.keys(NOTIFICATION_TYPES) as NotificationType[];
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("notify.title")}</h1>

      <section className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="font-semibold">{t("notify.recent")}</h2>
          {items.some((n) => !n.readAt) && <form action={markAllReadAction}><ConfirmSubmit variant="ghost">{t("notify.markAll")}</ConfirmSubmit></form>}
        </div>
        {items.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">{t("notify.empty")}</p> : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const { title, body } = renderNotification(n, locale);
              const inner = (
                <>
                  <span className="flex items-center gap-2">
                    {!n.readAt && <span className="size-2 rounded-full bg-accent" aria-label={t("notify.unread")} />}
                    <span className={n.readAt ? "" : "font-semibold"}>{title}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{body}</span>
                  <span className="mt-1 block text-xs text-muted">{[n.store?.name, date.format(n.createdAt)].filter(Boolean).join(" · ")}</span>
                </>
              );
              return <li key={n.id} className="px-5 py-3 text-sm">{n.href ? <Link href={n.href} className="block hover:opacity-80">{inner}</Link> : inner}</li>;
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">{t("notify.prefs.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("notify.prefs.body")}</p>
        <ActionForm action={saveNotificationPrefsAction} className="mt-4 space-y-5">
          {NOTIFICATION_GROUPS.map((g) => (
            <fieldset key={g}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t(`notify.group.${g}`)}</legend>
              <div className="divide-y divide-border rounded-lg border border-border">
                {types.filter((ty) => NOTIFICATION_TYPES[ty].group === g).map((ty) => (
                  emailAlways(ty) ? (
                    <div key={ty} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span>{t(`notify.${ty}.label`)}</span>
                      <span className="text-xs text-muted">{t("notify.prefs.always")}</span>
                    </div>
                  ) : (
                    <label key={ty} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span>{t(`notify.${ty}.label`)}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {t("notify.prefs.email")}
                        <input type="checkbox" name={`email:${ty}`} defaultChecked={wantsEmail(prefs.notificationPrefs, ty)} className="size-4" />
                      </span>
                    </label>
                  )
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-xs text-muted">{t("notify.prefs.inAppNote")}</p>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
