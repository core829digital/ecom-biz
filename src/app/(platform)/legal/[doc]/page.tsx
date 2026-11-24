import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { env } from "@/lib/env";
import { getPlatformT } from "@/lib/i18n/server";
import { RichText } from "@/lib/richtext";
import { LEGAL_DOCS, LEGAL_VERSION, legalDoc, type LegalDocSlug } from "@/lib/legal/platform-docs";

const isDoc = (s: string): s is LegalDocSlug => (LEGAL_DOCS as readonly string[]).includes(s);

function vars() {
  const l = env.legal;
  return { platform: env.platformName, company: l.company, address: l.address, vat: l.vat, email: l.email, dpo: l.dpoEmail, courts: l.courts, appUrl: env.appUrl };
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const { locale } = await getPlatformT();
  const d = legalDoc(doc, locale, vars());
  return { title: `${d.title} · ${env.platformName}`, description: d.summary };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isDoc(doc)) notFound();
  const { t, locale } = await getPlatformT();
  const d = legalDoc(doc, locale, vars());
  const updated = new Intl.DateTimeFormat(locale === "it" ? "it-IT" : "en-GB", { dateStyle: "long" }).format(new Date(LEGAL_VERSION));
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-semibold tracking-tight">{env.platformName}</Link>
          <Link href="/login" className="text-sm text-muted hover:text-text">{t("auth.login")}</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label={t("legal.documents")} className="text-sm lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("legal.documents")}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:block lg:space-y-1">
            {LEGAL_DOCS.map((s) => (
              <li key={s}>
                <Link href={`/legal/${s}`} aria-current={s === doc ? "page" : undefined} className={s === doc ? "font-medium text-text" : "text-muted hover:text-text"}>
                  {legalDoc(s, locale, vars()).title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="min-w-0">
          {!env.legal.configured && (
            <p role="note" className="mb-6 flex gap-2 rounded-lg border border-warning/30 bg-warning-bg p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{t("legal.draft")}
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight">{d.title}</h1>
          <p className="mt-2 text-muted">{d.summary}</p>
          <RichText text={d.body} className="legal-prose mt-8" />
          <p className="mt-10 border-t border-border pt-4 text-sm text-muted">{t("legal.updated", { date: updated })}</p>
        </article>
      </div>
    </div>
  );
}
