"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { ask, AssistantError, loadConversation, testConnection, usageToday, type AssistantMessage } from "@/server/ai/assistant";

export type AskResult = { ok: true; conversationId: string; message: AssistantMessage; usage: { used: number; limit: number } } | { ok: false; error: string };

/** Sends one message to the assistant. Store admins only: the assistant can change the catalog and design. */
export async function askAssistantAction(slug: string, conversationId: string | null, text: string): Promise<AskResult> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const clean = String(text ?? "").trim().slice(0, 4000);
  if (!clean) return { ok: false, error: t("validation.required") };
  try {
    const res = await ask(store, user.id, conversationId, clean, `/admin/${slug}`);
    revalidatePath(`/admin/${slug}`, "layout");
    return { ok: true, ...res, usage: await usageToday(store.id) };
  } catch (e) {
    // Platform admins get the provider's own message, so configuration problems are visible at once.
    if (e instanceof AssistantError) return { ok: false, error: t(`ai.error.${e.code}`) + (user.isPlatformAdmin && e.detail ? ` (${e.detail})` : "") };
    console.error("[ai] ask failed", e);
    return { ok: false, error: t("ai.error.provider") };
  }
}

export async function listConversationsAction(slug: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const rows = await db.aiConversation.findMany({ where: { storeId: store.id, userId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true } });
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() }));
}

export async function loadConversationAction(slug: string, id: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  return loadConversation(store.id, user.id, id);
}

export async function deleteConversationAction(slug: string, id: string) {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  await db.aiConversation.deleteMany({ where: { id, storeId: store.id, userId: user.id } });
}

/** Business memory edited by the merchant (what the assistant knows about the store). */
export async function saveMemoryAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const profile = String(fd.get("profile") ?? "").trim().slice(0, 2000);
  const facts = String(fd.get("facts") ?? "").split("\n").map((f) => f.trim().slice(0, 300)).filter(Boolean).slice(0, 40);
  await db.aiMemory.upsert({ where: { storeId: store.id }, create: { storeId: store.id, profile, facts }, update: { profile, facts } });
  revalidatePath(`/admin/${slug}/assistant`);
  return ok(t("common.saved"));
}

export async function clearMemoryAction(slug: string): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  await db.aiMemory.deleteMany({ where: { storeId: store.id } });
  revalidatePath(`/admin/${slug}/assistant`);
  return ok(t("common.saved"));
}

/** Platform admins only: checks key, model and tool definitions against the provider. */
export async function testAiConnectionAction(slug: string): Promise<ActionState> {
  const { user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  if (!user.isPlatformAdmin) return fail(t("ai.error.provider"));
  const res = await testConnection();
  return res.ok ? ok(t("ai.test.ok", { provider: res.provider, model: res.model })) : fail(`${t(`ai.error.${res.code}` as "ai.error.provider")}${res.detail ? ` (${res.detail})` : ""}`);
}
