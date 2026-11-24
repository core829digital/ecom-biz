/**
 * Color math for the theme editor: WCAG contrast, HSL conversions and palette generation.
 * Pure functions (no DOM), shared by the editor UI and the tests.
 */

export type Hsl = { h: number; s: number; l: number };
export type Palette = { id: string; primaryColor: string; accentColor: string; backgroundColor: string; textColor: string };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function isHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("");
}

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100, ll = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + hh / 30) % 12;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** "AAA" ≥ 7, "AA" ≥ 4.5 (normal text), "AA-large" ≥ 3, otherwise "fail". */
export function contrastGrade(ratio: number): "AAA" | "AA" | "AA-large" | "fail" {
  return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-large" : "fail";
}

/**
 * Smallest lightness change that makes `fg` readable on `bg` (default 4.5:1), keeping its hue.
 * Returns `fg` unchanged when it already passes.
 */
export function fixContrast(fg: string, bg: string, target = 4.5): string {
  if (contrastRatio(fg, bg) >= target) return fg;
  const hsl = hexToHsl(fg);
  const darker = luminance(bg) > 0.18;
  for (let step = 1; step <= 100; step++) {
    const candidate = hslToHex({ ...hsl, l: hsl.l + (darker ? -step : step) });
    if (contrastRatio(candidate, bg) >= target) return candidate;
  }
  return darker ? "#000000" : "#ffffff";
}

/**
 * Five ready-to-use palettes built around one brand color: light, warm paper, tinted,
 * dark, and complementary accent. Every result passes AA for body text.
 */
export function generatePalettes(brand: string): Palette[] {
  const { h, s } = hexToHsl(brand);
  const sat = clamp(s, 25, 85);
  const comp = hslToHex({ h: h + 180, s: clamp(sat, 45, 80), l: 45 });
  const analog = hslToHex({ h: h + 30, s: clamp(sat, 45, 80), l: 45 });
  const make = (id: string, p: Omit<Palette, "id">): Palette => ({
    id,
    ...p,
    textColor: fixContrast(p.textColor, p.backgroundColor, 7),
    primaryColor: fixContrast(p.primaryColor, p.backgroundColor, 3),
    accentColor: fixContrast(p.accentColor, p.backgroundColor, 3),
  });
  return [
    make("clean", { primaryColor: brand, accentColor: analog, backgroundColor: "#ffffff", textColor: hslToHex({ h, s: 15, l: 10 }) }),
    make("paper", { primaryColor: brand, accentColor: comp, backgroundColor: hslToHex({ h: 40, s: 30, l: 96 }), textColor: hslToHex({ h: 30, s: 20, l: 12 }) }),
    make("tint", { primaryColor: hslToHex({ h, s: sat, l: 32 }), accentColor: analog, backgroundColor: hslToHex({ h, s: clamp(sat, 20, 45), l: 96 }), textColor: hslToHex({ h, s: 30, l: 12 }) }),
    make("dark", { primaryColor: hslToHex({ h, s: sat, l: 62 }), accentColor: hslToHex({ h: h + 30, s: sat, l: 65 }), backgroundColor: hslToHex({ h, s: 12, l: 7 }), textColor: hslToHex({ h, s: 10, l: 95 }) }),
    make("bold", { primaryColor: comp, accentColor: brand, backgroundColor: "#ffffff", textColor: "#111111" }),
  ];
}

/**
 * Dominant, reasonably saturated colors from raw RGBA pixels (e.g. a logo drawn on a canvas).
 * Ignores transparent and near-white/near-black pixels, buckets the rest.
 */
export function dominantColors(pixels: Uint8ClampedArray | number[], max = 3): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    if (a < 128) continue;
    const { s, l } = hexToHsl(rgbToHex(r, g, b));
    if (l > 92 || l < 8 || s < 12) continue;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += r; bk.g += g; bk.b += b;
    buckets.set(key, bk);
  }
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((bk) => rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n));
}
