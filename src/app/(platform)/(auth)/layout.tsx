import Link from "next/link";
import { env } from "@/lib/env";
import { getPlatformT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getPlatformT();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-semibold tracking-wide text-muted">{env.platformName}</p>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">{children}</div>
        <nav aria-label="Legal" className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <Link href="/legal/terms" className="hover:text-text">{t("legal.terms")}</Link>
          <Link href="/legal/privacy" className="hover:text-text">{t("legal.privacy")}</Link>
          <Link href="/legal/cookies" className="hover:text-text">{t("legal.cookies")}</Link>
        </nav>
      </div>
    </main>
  );
}
