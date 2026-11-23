import { Laptop, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { currentSessionId, requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/primitives";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input } from "@/components/ui/fields";
import { Download, Trash2 } from "lucide-react";
import { TwoFactor } from "./two-factor";
import { deleteAccountAction, revokeOtherSessionsAction, revokeSessionAction } from "./actions";

function describeAgent(ua: string | null) {
  if (!ua) return { device: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return { device: [browser, os].filter(Boolean).join(" · "), mobile: /Mobile|Android|iPhone/.test(ua) };
}

export default async function SecurityPage() {
  const user = await requireUser();
  const { t, locale } = await getPlatformT();
  const [sessions, current] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, verified: true, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    currentSessionId(),
  ]);
  const owned = await db.membership.findMany({ where: { userId: user.id, role: "OWNER" }, include: { store: { select: { name: true } } } });
  const date = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("account.security")}</h1>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-1 font-semibold">{t("security.twoFactor")}</h2>
        <TwoFactor enabled={!!user.totpEnabledAt} remaining={user.recoveryCodes.length} />
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t("security.sessions")}</h2>
          {sessions.length > 1 && (
            <form action={revokeOtherSessionsAction}><ConfirmSubmit variant="danger" confirmMessage={t("security.revokeAllConfirm")}>{t("security.revokeAll")}</ConfirmSubmit></form>
          )}
        </div>
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const { device, mobile } = describeAgent(s.userAgent);
            const Icon = mobile ? Smartphone : Laptop;
            return (
              <li key={s.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2"><Icon className="size-4" aria-hidden /></span>
                <span className="flex-1">
                  <span className="block font-medium">{device} {s.id === current && <Badge tone="success">{t("security.thisDevice")}</Badge>}</span>
                  <span className="text-xs text-muted">{s.ip ?? "—"} · {t("security.lastActive", { date: date.format(s.lastSeenAt) })}</span>
                </span>
                {s.id !== current && <form action={revokeSessionAction.bind(null, s.id)}><ConfirmSubmit variant="ghost" className="text-danger">{t("security.revoke")}</ConfirmSubmit></form>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">{t("privacy.data.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("privacy.data.body")}</p>
        <a href="/account/export" className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-surface-2" download>
          <Download className="size-4" aria-hidden />{t("privacy.data.download")}
        </a>
      </section>

      <section className="rounded-2xl border border-danger/30 bg-surface p-5">
        <h2 className="flex items-center gap-2 font-semibold text-danger"><Trash2 className="size-4" aria-hidden />{t("privacy.delete.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("privacy.delete.body")}</p>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-danger">{t("privacy.delete.open")}</summary>
          <ActionForm action={deleteAccountAction} className="mt-4 max-w-md space-y-4">
            {owned.length > 0 && (
              <div className="rounded-lg bg-danger-bg p-3 text-sm text-danger">
                <p className="font-medium">{t("privacy.delete.storesWarning", { count: owned.length })}</p>
                <ul className="mt-1 list-inside list-disc">{owned.map((m) => <li key={m.id}>{m.store.name}</li>)}</ul>
                <div className="mt-3"><Checkbox name="deleteStores" label={t("privacy.delete.storesConfirm")} /></div>
              </div>
            )}
            <Input name="password" type="password" autoComplete="current-password" label={t("account.currentPassword")} required />
            <Input name="confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} label={t("privacy.delete.phraseLabel", { phrase: t("privacy.delete.phrase") })} required />
            <SubmitButton variant="danger">{t("privacy.delete.submit")}</SubmitButton>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}
