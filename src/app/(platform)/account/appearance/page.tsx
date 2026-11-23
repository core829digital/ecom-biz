import { getPlatformT } from "@/lib/i18n/server";
import { getAppearance } from "@/lib/appearance-server";
import { ACCENTS } from "@/lib/appearance";
import { AppearanceForm } from "./form";

export default async function AppearancePage() {
  const { t } = await getPlatformT();
  const { theme, accent } = await getAppearance();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("account.appearance")}</h1>
      <AppearanceForm
        theme={theme}
        accent={accent}
        labels={{
          theme: t("appearance.theme"),
          themeHint: t("appearance.themeHint"),
          accent: t("appearance.accent"),
          accentHint: t("appearance.accentHint"),
          preview: t("theme.preview"),
          themes: { light: t("appearance.light"), dark: t("appearance.dark"), system: t("appearance.system") },
          accents: Object.fromEntries(ACCENTS.map((a) => [a, t(`appearance.accent.${a}`)])) as Record<(typeof ACCENTS)[number], string>,
        }}
      />
    </div>
  );
}
