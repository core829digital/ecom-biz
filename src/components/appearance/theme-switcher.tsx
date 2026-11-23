"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { ACCENTS, ACCENT_SWATCH, type AccentPref, type ThemePref } from "@/lib/appearance";
import { cn } from "@/lib/cn";
import { setAppearanceAction } from "./actions";

/** Apply instantly on <html> (with a short cross-fade), then persist in the background. */
export function applyAppearance(theme: ThemePref, accent: AccentPref) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (accent === "neutral") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
  window.setTimeout(() => root.classList.remove("theme-transition"), 260);
}

function currentFromDom(): { theme: ThemePref; accent: AccentPref } {
  const root = document.documentElement;
  return {
    theme: (root.getAttribute("data-theme") as ThemePref) ?? "system",
    accent: (root.getAttribute("data-accent") as AccentPref) ?? "neutral",
  };
}

export function ThemeSwitcher({
  theme,
  onChange,
  labels,
  layoutId = "theme-pill",
  compact,
}: {
  theme: ThemePref;
  onChange: (t: ThemePref) => void;
  labels: Record<ThemePref, string>;
  layoutId?: string;
  compact?: boolean;
}) {
  const [, start] = useTransition();
  const items: { value: ThemePref; icon: typeof Sun }[] = [
    { value: "light", icon: Sun },
    { value: "dark", icon: Moon },
    { value: "system", icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {items.map(({ value, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={labels[value]}
            onClick={() => {
              const { accent } = currentFromDom();
              applyAppearance(value, accent);
              onChange(value);
              start(() => setAppearanceAction(value, accent));
            }}
            className={cn("relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors", active ? "text-text" : "text-muted hover:text-text")}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-surface shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            <Icon className="relative size-3.5" aria-hidden />
            {!compact && <span className="relative">{labels[value]}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AccentPicker({ accent, onChange, labels }: { accent: AccentPref; onChange: (a: AccentPref) => void; labels: Record<AccentPref, string> }) {
  const [, start] = useTransition();
  return (
    <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
      {ACCENTS.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={accent === a}
          title={labels[a]}
          onClick={() => {
            const { theme } = currentFromDom();
            applyAppearance(theme, a);
            onChange(a);
            start(() => setAppearanceAction(theme, a));
          }}
          className={cn("relative size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110", accent === a && "ring-2 ring-text")}
          style={{ background: a === "neutral" ? "linear-gradient(135deg,#18181b 50%,#fafafa 50%)" : ACCENT_SWATCH[a] }}
        >
          <span className="sr-only">{labels[a]}</span>
        </button>
      ))}
    </div>
  );
}
