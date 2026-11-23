/** Admin/platform appearance preferences (not storefront themes). */
export const THEMES = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEMES)[number];
export const ACCENTS = ["neutral", "blue", "violet", "emerald", "rose", "amber"] as const;
export type AccentPref = (typeof ACCENTS)[number];

export const THEME_COOKIE = "theme";
export const ACCENT_COOKIE = "accent";

/** Swatch shown in pickers (light-mode accent value). */
export const ACCENT_SWATCH: Record<AccentPref, string> = {
  neutral: "#18181b",
  blue: "#2563eb",
  violet: "#7c3aed",
  emerald: "#047857",
  rose: "#e11d48",
  amber: "#b45309",
};

export function normalizeTheme(v: string | null | undefined): ThemePref {
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as ThemePref) : "system";
}
export function normalizeAccent(v: string | null | undefined): AccentPref {
  return (ACCENTS as readonly string[]).includes(v ?? "") ? (v as AccentPref) : "neutral";
}

/** Attributes for <html>; "system" leaves data-theme unset so the OS preference applies. */
export function htmlAppearanceAttrs(theme: ThemePref, accent: AccentPref) {
  return {
    "data-theme": theme === "system" ? undefined : theme,
    "data-accent": accent === "neutral" ? undefined : accent,
  };
}
