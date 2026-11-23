import "server-only";
import { cookies } from "next/headers";
import { ACCENT_COOKIE, THEME_COOKIE, normalizeAccent, normalizeTheme, type AccentPref, type ThemePref } from "./appearance";
import { env } from "./env";

export async function getAppearance(): Promise<{ theme: ThemePref; accent: AccentPref }> {
  const jar = await cookies();
  return { theme: normalizeTheme(jar.get(THEME_COOKIE)?.value), accent: normalizeAccent(jar.get(ACCENT_COOKIE)?.value) };
}

/** Appearance lives in cookies (no flash on first paint) and on the user (follows them across devices). */
export async function writeAppearanceCookies(theme: ThemePref, accent: AccentPref) {
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, secure: env.secureAppCookies, httpOnly: false };
  jar.set(THEME_COOKIE, theme, opts);
  jar.set(ACCENT_COOKIE, accent, opts);
}
