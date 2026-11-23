"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { randomToken } from "@/lib/crypto";
import { isPublicHttpsUrl } from "@/lib/url-safety";
import { API_SCOPES, generateApiToken } from "@/server/api";
import { deliverWebhook, WEBHOOK_TOPICS } from "@/server/webhooks";
import { audit } from "@/server/audit";

export type SecretState = { error?: string; secret?: string; at?: number } | null;

export async function createTokenAction(slug: string, _: SecretState, fd: FormData): Promise<SecretState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const name = String(fd.get("name") ?? "").trim().slice(0, 60);
  const scopes = fd.getAll("scopes").map(String).filter((s) => (API_SCOPES as readonly string[]).includes(s));
  if (!name) return { error: t("developers.error.name"), at: Date.now() };
  if (!scopes.length) return { error: t("developers.error.scopes"), at: Date.now() };
  if ((await db.apiToken.count({ where: { storeId: store.id } })) >= 25) return { error: t("developers.error.tokenLimit"), at: Date.now() };
  const { token, prefix, hash } = generateApiToken();
  await db.apiToken.create({ data: { storeId: store.id, name, prefix, tokenHash: hash, scopes } });
  await audit({ userId: user.id, storeId: store.id, action: "api_token.create", target: name, meta: { scopes } });
  revalidatePath(`/admin/${slug}/settings/developers`);
  return { secret: token, at: Date.now() };
}

export async function revokeTokenAction(slug: string, id: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  await db.apiToken.deleteMany({ where: { id, storeId: store.id } });
  await audit({ userId: user.id, storeId: store.id, action: "api_token.revoke", target: id });
  revalidatePath(`/admin/${slug}/settings/developers`);
}

export async function createWebhookAction(slug: string, _: SecretState, fd: FormData): Promise<SecretState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const topic = String(fd.get("topic") ?? "");
  const url = String(fd.get("url") ?? "").trim();
  if (!(WEBHOOK_TOPICS as readonly string[]).includes(topic)) return { error: t("products.error.invalid"), at: Date.now() };
  if (url.length > 500 || !(await isPublicHttpsUrl(url))) return { error: t("developers.error.url"), at: Date.now() };
  if ((await db.webhookSubscription.count({ where: { storeId: store.id } })) >= 50) return { error: t("developers.error.webhookLimit"), at: Date.now() };
  const secret = `whsec_${randomToken(24)}`;
  await db.webhookSubscription.create({ data: { storeId: store.id, topic, url, secret } });
  await audit({ userId: user.id, storeId: store.id, action: "webhook.create", target: url, meta: { topic } });
  revalidatePath(`/admin/${slug}/settings/developers`);
  return { secret, at: Date.now() };
}

export async function deleteWebhookAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.webhookSubscription.deleteMany({ where: { id, storeId: store.id } });
  revalidatePath(`/admin/${slug}/settings/developers`);
}

export async function testWebhookAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const sub = await db.webhookSubscription.findFirst({ where: { id, storeId: store.id } });
  if (!sub) return;
  const d = await db.webhookDelivery.create({ data: { subscriptionId: sub.id, topic: sub.topic, payload: { test: true, store: store.slug }, nextAttemptAt: null } });
  await deliverWebhook(d.id);
  revalidatePath(`/admin/${slug}/settings/developers`);
}
