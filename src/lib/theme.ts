import { z } from "zod";
import { parseSections, type Section } from "./theme-sections";
import { contrastRatio } from "./palette";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const safeUrl = z.string().max(2000).refine((u) => u === "" || u.startsWith("https://") || u.startsWith("/files/"));

export const FONTS = {
  system: { label: "System", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  inter: { label: "Inter", stack: '"Inter Variable", ui-sans-serif, system-ui, sans-serif' },
  manrope: { label: "Manrope", stack: '"Manrope Variable", ui-sans-serif, system-ui, sans-serif' },
  dmsans: { label: "DM Sans", stack: '"DM Sans Variable", ui-sans-serif, system-ui, sans-serif' },
  playfair: { label: "Playfair Display", stack: '"Playfair Display Variable", Georgia, serif' },
  lora: { label: "Lora", stack: '"Lora Variable", Georgia, serif' },
  spacegrotesk: { label: "Space Grotesk", stack: '"Space Grotesk Variable", ui-sans-serif, sans-serif' },
} as const;
export type FontKey = keyof typeof FONTS;

export const themeSchema = z.object({
  primaryColor: hex.catch("#111827"),
  backgroundColor: hex.catch("#ffffff"),
  textColor: hex.catch("#111111"),
  /** Secondary color: sale prices, badges, highlights. */
  accentColor: hex.catch("#b91c1c"),
  font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]).catch("system"),
  headingFont: z.enum(["same", ...Object.keys(FONTS)] as ["same", ...FontKey[]]).catch("same"),
  buttonShape: z.enum(["pill", "rounded", "square"]).catch("pill"),
  cornerStyle: z.enum(["sharp", "soft", "round"]).catch("soft"),
  logoUrl: safeUrl.catch(""),
  logoHeight: z.number().int().min(16).max(120).catch(32),
  faviconUrl: safeUrl.catch(""),
  announcement: z.string().max(200).catch(""),
  heroTitle: z.string().max(120).catch(""),
  heroSubtitle: z.string().max(300).catch(""),
  heroImageUrl: safeUrl.catch(""),
  heroCtaLabel: z.string().max(40).catch(""),
  heroCtaUrl: z.string().max(500).catch("/collections/all"),
  featuredCollectionId: z.string().max(40).catch(""),
  featuredTitle: z.string().max(80).catch(""),
  footerText: z.string().max(500).catch(""),
  social: z
    .object({ instagram: z.string().max(200).catch(""), facebook: z.string().max(200).catch(""), tiktok: z.string().max(200).catch(""), youtube: z.string().max(200).catch("") })
    .catch({ instagram: "", facebook: "", tiktok: "", youtube: "" }),
  /** Homepage layout. Absent on themes saved before the site editor: derived from the legacy fields. */
  sections: z.unknown().optional(),
});

export type Theme = Omit<z.infer<typeof themeSchema>, "sections"> & { sections: Section[] };

/** The homepage older themes rendered (banner, featured products, collections). */
function legacySections(t: z.infer<typeof themeSchema>): Section[] {
  return parseSections([
    { id: "hero0001", type: "hero", title: t.heroTitle, subtitle: t.heroSubtitle, imageUrl: t.heroImageUrl, ctaLabel: t.heroCtaLabel, ctaUrl: t.heroCtaUrl, height: "large", style: { background: "muted" } },
    { id: "feat0001", type: "featured-products", title: t.featuredTitle, collectionId: t.featuredCollectionId },
    { id: "coll0001", type: "collections" },
  ]) ?? [];
}

/** Parse stored theme JSON; any invalid field falls back to its default. Ignores the unpublished draft. */
export function parseTheme(json: unknown): Theme {
  const raw = themeSchema.parse(json && typeof json === "object" ? json : {});
  return { ...raw, sections: parseSections(raw.sections) ?? legacySections(raw) };
}

/** The store's theme JSON keeps unpublished editor changes under `draft` until "Publish". */
export function themeDraft(json: unknown): Theme | null {
  const d = json && typeof json === "object" ? (json as { draft?: unknown }).draft : undefined;
  return d && typeof d === "object" ? parseTheme(d) : null;
}

/** Contrast problems a merchant should fix before publishing (WCAG AA). */
export function themeContrastIssues(t: Theme): ("text" | "button" | "accent")[] {
  const issues: ("text" | "button" | "accent")[] = [];
  if (contrastRatio(t.textColor, t.backgroundColor) < 4.5) issues.push("text");
  if (contrastRatio(contrastText(t.primaryColor), t.primaryColor) < 4.5) issues.push("button");
  if (contrastRatio(t.accentColor, t.backgroundColor) < 3) issues.push("accent");
  return issues;
}

/** WCAG relative luminance → pick black or white text for a background. */
export function contrastText(hexColor: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hexColor.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? "#ffffff" : "#111111";
}

export function mixWithBackground(fg: string, bg: string, amount: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const ch = (i: number) => Math.round(p(fg, i) * amount + p(bg, i) * (1 - amount)).toString(16).padStart(2, "0");
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

export function isDark(hexColor: string) {
  return contrastText(hexColor) === "#ffffff";
}

/** Ready-made looks merchants can start from (then fine-tune). */
export type ThemePreset = { id: string; name: string; primaryColor: string; accentColor: string; backgroundColor: string; textColor: string; font: FontKey; headingFont: Theme["headingFont"]; buttonShape: Theme["buttonShape"]; cornerStyle: Theme["cornerStyle"] };
export const THEME_PRESETS: ThemePreset[] = [
  { id: "minimal", name: "Minimal", primaryColor: "#111111", accentColor: "#b91c1c", backgroundColor: "#ffffff", textColor: "#111111", font: "inter", headingFont: "same", buttonShape: "pill", cornerStyle: "soft" },
  { id: "midnight", name: "Midnight", primaryColor: "#fafafa", accentColor: "#f87171", backgroundColor: "#0a0a0b", textColor: "#f4f4f5", font: "inter", headingFont: "same", buttonShape: "pill", cornerStyle: "soft" },
  { id: "sand", name: "Sand", primaryColor: "#7c5a3a", accentColor: "#9a3412", backgroundColor: "#f7f3ec", textColor: "#2b2118", font: "lora", headingFont: "same", buttonShape: "rounded", cornerStyle: "soft" },
  { id: "ocean", name: "Ocean", primaryColor: "#1f4e79", accentColor: "#c2410c", backgroundColor: "#ffffff", textColor: "#0f1b2a", font: "dmsans", headingFont: "same", buttonShape: "rounded", cornerStyle: "soft" },
  { id: "forest", name: "Forest", primaryColor: "#2f5d46", accentColor: "#a16207", backgroundColor: "#f6f7f2", textColor: "#16231c", font: "manrope", headingFont: "lora", buttonShape: "pill", cornerStyle: "round" },
  { id: "rose", name: "Rosé", primaryColor: "#b4436c", accentColor: "#9f1239", backgroundColor: "#fff7f8", textColor: "#2a1218", font: "dmsans", headingFont: "playfair", buttonShape: "pill", cornerStyle: "round" },
  { id: "editorial", name: "Editorial", primaryColor: "#1a1a1a", accentColor: "#b91c1c", backgroundColor: "#f5f2ea", textColor: "#1a1a1a", font: "inter", headingFont: "playfair", buttonShape: "square", cornerStyle: "sharp" },
  { id: "neon", name: "Studio", primaryColor: "#c6f432", accentColor: "#f472b6", backgroundColor: "#111214", textColor: "#f4f4f5", font: "spacegrotesk", headingFont: "same", buttonShape: "square", cornerStyle: "sharp" },
  { id: "terracotta", name: "Terracotta", primaryColor: "#b4532a", accentColor: "#7c2d12", backgroundColor: "#fbf6f1", textColor: "#2a1a12", font: "manrope", headingFont: "lora", buttonShape: "rounded", cornerStyle: "soft" },
  { id: "nordic", name: "Nordic", primaryColor: "#334155", accentColor: "#0f766e", backgroundColor: "#f8fafc", textColor: "#0f172a", font: "inter", headingFont: "same", buttonShape: "rounded", cornerStyle: "soft" },
  { id: "lavender", name: "Lavender", primaryColor: "#6d28d9", accentColor: "#be185d", backgroundColor: "#faf8ff", textColor: "#1e1433", font: "dmsans", headingFont: "same", buttonShape: "pill", cornerStyle: "round" },
  { id: "noir", name: "Noir & Gold", primaryColor: "#d4af37", accentColor: "#e5c76b", backgroundColor: "#0c0c0c", textColor: "#f5f1e6", font: "manrope", headingFont: "playfair", buttonShape: "square", cornerStyle: "sharp" },
];

const RADIUS = { pill: "9999px", rounded: "0.625rem", square: "0px" } as const;
const CORNERS = { sharp: "0px", soft: "0.5rem", round: "1.25rem" } as const;

/** CSS custom properties applied on the storefront root. */
export function themeCssVars(theme: Theme): Record<string, string> {
  return {
    "color-scheme": isDark(theme.backgroundColor) ? "dark" : "light",
    "--brand": theme.primaryColor,
    "--brand-contrast": contrastText(theme.primaryColor),
    "--bg": theme.backgroundColor,
    "--surface": theme.backgroundColor,
    "--surface-2": mixWithBackground(theme.textColor, theme.backgroundColor, 0.05),
    "--border": mixWithBackground(theme.textColor, theme.backgroundColor, 0.12),
    "--text": theme.textColor,
    "--muted": mixWithBackground(theme.textColor, theme.backgroundColor, 0.6),
    "--store-font": FONTS[theme.font].stack,
    "--store-heading-font": FONTS[theme.headingFont === "same" ? theme.font : theme.headingFont].stack,
    "--sf-accent": theme.accentColor,
    "--sf-accent-contrast": contrastText(theme.accentColor),
    "--btn-radius": RADIUS[theme.buttonShape],
    "--card-radius": CORNERS[theme.cornerStyle],
  };
}
