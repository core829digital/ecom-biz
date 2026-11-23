import { z } from "zod";

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
  font: z.enum(Object.keys(FONTS) as [FontKey, ...FontKey[]]).catch("system"),
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
});

export type Theme = z.infer<typeof themeSchema>;

/** Parse stored theme JSON; any invalid field falls back to its default. */
export function parseTheme(json: unknown): Theme {
  return themeSchema.parse(json && typeof json === "object" ? json : {});
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
export const THEME_PRESETS: { id: string; name: string; primaryColor: string; backgroundColor: string; textColor: string; font: FontKey }[] = [
  { id: "minimal", name: "Minimal", primaryColor: "#111111", backgroundColor: "#ffffff", textColor: "#111111", font: "inter" },
  { id: "midnight", name: "Midnight", primaryColor: "#fafafa", backgroundColor: "#0a0a0b", textColor: "#f4f4f5", font: "inter" },
  { id: "sand", name: "Sand", primaryColor: "#7c5a3a", backgroundColor: "#f7f3ec", textColor: "#2b2118", font: "lora" },
  { id: "ocean", name: "Ocean", primaryColor: "#1f4e79", backgroundColor: "#ffffff", textColor: "#0f1b2a", font: "dmsans" },
  { id: "forest", name: "Forest", primaryColor: "#2f5d46", backgroundColor: "#f6f7f2", textColor: "#16231c", font: "manrope" },
  { id: "rose", name: "Rosé", primaryColor: "#b4436c", backgroundColor: "#fff7f8", textColor: "#2a1218", font: "playfair" },
  { id: "editorial", name: "Editorial", primaryColor: "#1a1a1a", backgroundColor: "#f5f2ea", textColor: "#1a1a1a", font: "playfair" },
  { id: "neon", name: "Studio", primaryColor: "#c6f432", backgroundColor: "#111214", textColor: "#f4f4f5", font: "spacegrotesk" },
];

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
  };
}
