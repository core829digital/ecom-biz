import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const safeUrl = z.string().max(2000).refine((u) => u === "" || u.startsWith("https://") || u.startsWith("/files/"));

export const FONTS = {
  system: { label: "System", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', google: null },
  inter: { label: "Inter", stack: '"Inter", ui-sans-serif, system-ui, sans-serif', google: "Inter:wght@400;500;600;700" },
  manrope: { label: "Manrope", stack: '"Manrope", ui-sans-serif, system-ui, sans-serif', google: "Manrope:wght@400;500;600;700" },
  dmsans: { label: "DM Sans", stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif', google: "DM+Sans:wght@400;500;600;700" },
  playfair: { label: "Playfair Display", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:wght@400;500;600;700" },
  lora: { label: "Lora", stack: '"Lora", Georgia, serif', google: "Lora:wght@400;500;600;700" },
  spacegrotesk: { label: "Space Grotesk", stack: '"Space Grotesk", ui-sans-serif, sans-serif', google: "Space+Grotesk:wght@400;500;600;700" },
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

/** CSS custom properties applied on the storefront root. */
export function themeCssVars(theme: Theme): Record<string, string> {
  return {
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
