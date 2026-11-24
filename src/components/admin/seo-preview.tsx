"use client";

import { useT } from "@/components/i18n-provider";

const TITLE_MAX = 60;
const DESC_MAX = 160;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * How the page will look in Google results, updated as the merchant types.
 * Length guidance follows what search engines typically display (~60 / ~160 characters).
 */
export function SeoPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const t = useT();
  const shownUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/").join(" › ");
  return (
    <div className="rounded-lg border border-border bg-bg p-4" aria-label={t("seo.preview")}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t("seo.preview")}</p>
      <p className="truncate text-xs text-muted">{shownUrl}</p>
      <p className="mt-0.5 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{cut(title || t("seo.untitled"), TITLE_MAX)}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">{description ? cut(description, DESC_MAX) : t("seo.noDescription")}</p>
      {(title.length > TITLE_MAX || description.length > DESC_MAX) && <p className="mt-2 text-xs text-warning">{t("seo.tooLong")}</p>}
    </div>
  );
}
