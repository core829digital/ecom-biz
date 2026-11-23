import "server-only";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/staff";
import { getTranslator, normalizeLocale, type Locale } from "./index";

/** Locale for platform/admin UI: user preference → cookie → Accept-Language. */
export async function getPlatformLocale(): Promise<Locale> {
  const user = await getCurrentUser();
  if (user) return normalizeLocale(user.locale);
  const cookie = (await cookies()).get("locale")?.value;
  if (cookie) return normalizeLocale(cookie);
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("it") ? "it" : "en";
}

export async function getPlatformT() {
  const locale = await getPlatformLocale();
  return { locale, t: getTranslator(locale) };
}
