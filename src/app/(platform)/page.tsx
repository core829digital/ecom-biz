import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { LinkButton } from "@/components/ui/button";
import { env } from "@/lib/env";

export default async function LandingPage() {
  if (await getCurrentUser()) redirect("/admin");
  const { t } = await getPlatformT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="mb-3 text-sm font-medium text-muted">{env.platformName}</p>
      <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{t("landing.title")}</h1>
      <p className="mt-4 max-w-xl text-pretty text-muted">{t("landing.subtitle")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/signup">{t("landing.cta")}</LinkButton>
        <LinkButton href="/login" variant="secondary">{t("auth.login")}</LinkButton>
      </div>
    </main>
  );
}
