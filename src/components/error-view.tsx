"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTranslator } from "@/lib/i18n";

/**
 * Generic error screen for boundaries outside the admin's i18n provider. The language comes from
 * <html lang>, set by each layout. Only the opaque digest is shown, never error details.
 */
export function ErrorView({ error, reset, variant = "platform" }: { error: Error & { digest?: string }; reset: () => void; variant?: "platform" | "store" }) {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    setLang(document.documentElement.lang || "en");
    console.error(error);
  }, [error]);
  const t = getTranslator(lang);
  const button = variant === "store" ? "h-11 rounded-full bg-brand px-6 font-medium text-brand-contrast" : "h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast";
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{t("errors.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("errors.body")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">ref: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className={button}>{t("errors.retry")}</button>
        <Link href="/" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-text">{t("errors.home")}</Link>
      </div>
    </div>
  );
}
