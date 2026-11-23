import Link from "next/link";
import { getPlatformT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getPlatformT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="text-7xl font-semibold tracking-tighter text-surface-3">404</p>
      <h1 className="mt-4 text-xl font-semibold">{t("errors.notFoundTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("errors.notFoundBody")}</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast">{t("errors.home")}</Link>
    </main>
  );
}
