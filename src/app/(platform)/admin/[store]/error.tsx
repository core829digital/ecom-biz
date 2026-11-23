"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/components/i18n-provider";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-bg text-danger"><AlertTriangle className="size-6" aria-hidden /></span>
      <h1 className="mt-4 text-lg font-semibold">{t("errors.title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("errors.body")}</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">ref: {error.digest}</p>}
      <button onClick={reset} className="mt-6 h-10 rounded-lg bg-accent px-4 text-sm font-medium text-accent-contrast">{t("errors.retry")}</button>
    </div>
  );
}
