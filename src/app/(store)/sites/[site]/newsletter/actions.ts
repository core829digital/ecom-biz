"use server";

import { z } from "zod";
import { loadStorefront } from "@/server/storefront";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { confirmSubscription, subscribe, unsubscribe } from "@/server/newsletter";

export type NewsletterState = { ok?: boolean; message?: string; error?: string; at?: number } | null;

export async function subscribeAction(site: string, _: NewsletterState, fd: FormData): Promise<NewsletterState> {
  const sf = await loadStorefront(site);
  const { t, store } = sf;
  if (!store.newsletterEnabled) return { error: t("sf.newsletter.disabled"), at: Date.now() };
  // Honeypot: real people never fill the hidden field.
  if (String(fd.get("website") ?? "")) return { ok: true, message: t("sf.newsletter.checkEmail"), at: Date.now() };
  if (!(await rateLimit(`newsletter:${store.id}:${await clientIp()}`, 5, 3600))) return { error: t("auth.error.rateLimited"), at: Date.now() };
  const email = z.string().trim().toLowerCase().email().max(200).safeParse(fd.get("email"));
  if (!email.success) return { error: t("validation.email"), at: Date.now() };
  const res = await subscribe(store, email.data, "form");
  // Same answer whether or not the address was already subscribed (no list enumeration).
  void res;
  return { ok: true, message: t("sf.newsletter.checkEmail"), at: Date.now() };
}

export async function confirmNewsletterAction(site: string, token: string, _: NewsletterState): Promise<NewsletterState> {
  const sf = await loadStorefront(site);
  return (await confirmSubscription(sf.store.id, token)) ? { ok: true, message: sf.t("sf.newsletter.confirmed"), at: Date.now() } : { error: sf.t("sf.newsletter.invalidLink"), at: Date.now() };
}

export async function unsubscribeNewsletterAction(site: string, token: string, _: NewsletterState): Promise<NewsletterState> {
  const sf = await loadStorefront(site);
  return (await unsubscribe(sf.store.id, token)) ? { ok: true, message: sf.t("sf.newsletter.unsubscribed"), at: Date.now() } : { error: sf.t("sf.newsletter.invalidLink"), at: Date.now() };
}
