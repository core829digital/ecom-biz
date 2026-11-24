import { requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n-provider";
import { SettingsShell } from "./settings-shell";
import { logoutAction } from "../(auth)/actions";

export const metadata = { title: "Account" };

/** Full-screen account settings (Discord-style): categories on the left, Esc to leave. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, locale } = await getPlatformT();
  return (
    <I18nProvider locale={locale}>
      <SettingsShell
        userName={user.name}
        logoutAction={logoutAction}
        groups={[
          {
            title: t("account.group.user"),
            items: [
              { href: "/account", label: t("account.profile"), icon: "user" },
              { href: "/account/security", label: t("account.security"), icon: "shield" },
            ],
          },
          {
            title: t("account.group.app"),
            items: [
              { href: "/account/notifications", label: t("notify.title"), icon: "bell" },
              { href: "/account/appearance", label: t("account.appearance"), icon: "palette" },
              { href: "/account/billing", label: t("nav.billing"), icon: "card" },
            ],
          },
        ]}
        labels={{ close: t("account.close"), logout: t("auth.logout") }}
      >
        {children}
      </SettingsShell>
    </I18nProvider>
  );
}
