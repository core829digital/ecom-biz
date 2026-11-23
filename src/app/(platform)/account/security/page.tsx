import { Laptop, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { currentSessionId, requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/primitives";
import { ConfirmSubmit } from "@/components/ui/form";
import { TwoFactor } from "./two-factor";
import { revokeOtherSessionsAction, revokeSessionAction } from "./actions";

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
    </div>
  );
}
