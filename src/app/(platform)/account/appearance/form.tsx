"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AccentPicker, ThemeSwitcher } from "@/components/appearance/theme-switcher";
import type { AccentPref, ThemePref } from "@/lib/appearance";

export function AppearanceForm({ theme, accent, labels }: {
  theme: ThemePref;
  accent: AccentPref;
  labels: { theme: string; themeHint: string; accent: string; accentHint: string; preview: string; themes: Record<ThemePref, string>; accents: Record<AccentPref, string> };
}) {
  const [th, setTh] = useState(theme);
  const [ac, setAc] = useState(accent);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">{labels.theme}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{labels.themeHint}</p>
        <ThemeSwitcher theme={th} onChange={setTh} labels={labels.themes} layoutId="appearance-theme" />
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">{labels.accent}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">{labels.accentHint} <span className="font-medium text-text">{labels.accents[ac]}</span></p>
        <AccentPicker accent={ac} onChange={setAc} labels={labels.accents} />
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5" aria-label={labels.preview}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{labels.preview}</p>
        <motion.div layout className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">Primary</span>
          <span className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium">Secondary</span>
          <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">Paid</span>
          <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning">Pending</span>
          <span className="h-2 w-32 overflow-hidden rounded-full bg-surface-3"><span className="block h-full w-2/3 rounded-full bg-accent" /></span>
        </motion.div>
      </section>
    </div>
  );
}
