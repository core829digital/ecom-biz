"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AutomationTrigger, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/server/audit";
import { CampaignError, messageSchema, sendCampaignTest, startCampaign, stepsSchema } from "@/server/marketing";

const base = (slug: string) => `/admin/${slug}/marketing`;

function readMessage(fd: FormData) {
  return messageSchema.safeParse({
    subject: String(fd.get("subject") ?? ""),
    preheader: String(fd.get("preheader") ?? ""),
    heading: String(fd.get("heading") ?? ""),
    body: String(fd.get("body") ?? ""),
    ctaLabel: String(fd.get("ctaLabel") ?? ""),
    ctaUrl: String(fd.get("ctaUrl") ?? ""),
  });
}

export async function createCampaignAction(slug: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const c = await db.emailCampaign.create({ data: { storeId: store.id, subject: t("campaigns.untitled") } });
  redirect(`${base(slug)}/campaigns/${c.id}`);
}

async function editableCampaign(storeId: string, id: string) {
  const c = await db.emailCampaign.findFirst({ where: { id, storeId } });
  return c && (c.status === "DRAFT" || c.status === "SCHEDULED") ? c : null;
}

export async function saveCampaignAction(slug: string, id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  if (!(await editableCampaign(store.id, id))) return fail(t("campaigns.error.not_draft"));
  const parsed = readMessage(fd);
  if (!parsed.success) return fail(t("validation.fixErrors"), { subject: t("validation.required") });
  await db.emailCampaign.update({ where: { id }, data: parsed.data });
  revalidatePath(`${base(slug)}/campaigns`);
  return ok(t("common.saved"));
}

export async function sendTestCampaignAction(slug: string, id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  if (!(await rateLimit(`campaign-test:${user.id}`, 10, 3600))) return fail(t("auth.error.rateLimited"));
  const parsed = readMessage(fd);
  if (parsed.success && (await editableCampaign(store.id, id))) await db.emailCampaign.update({ where: { id }, data: parsed.data });
  const sent = await sendCampaignTest(id, store.id, user.email);
  return sent ? ok(t("campaigns.testSent", { email: user.email })) : fail(t("campaigns.error.email_disabled"));
}

/** Sends now, or schedules when `at` (ISO date from the browser) is in the future. */
export async function sendCampaignAction(slug: string, id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  if (!(await editableCampaign(store.id, id))) return fail(t("campaigns.error.not_draft"));
  const parsed = readMessage(fd);
  if (!parsed.success) return fail(t("validation.fixErrors"), { subject: t("validation.required") });
  await db.emailCampaign.update({ where: { id }, data: parsed.data });
  const rawAt = String(fd.get("at") ?? "");
  const at = rawAt ? new Date(rawAt) : undefined;
  if (at && (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000 || at.getTime() > Date.now() + 365 * 86400_000)) return fail(t("campaigns.error.when"));
  try {
    const res = await startCampaign(id, store.id, at);
    await audit({ userId: user.id, storeId: store.id, action: res.scheduled ? "campaign.schedule" : "campaign.send", target: id, meta: { recipients: res.recipients } });
    revalidatePath(`${base(slug)}/campaigns`);
    return ok(t(res.scheduled ? "campaigns.scheduled" : "campaigns.started"));
  } catch (e) {
    if (e instanceof CampaignError) return fail(t(`campaigns.error.${e.code}`));
    throw e;
  }
}

export async function cancelScheduleAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.emailCampaign.updateMany({ where: { id, storeId: store.id, status: "SCHEDULED" }, data: { status: "DRAFT", scheduledAt: null } });
  revalidatePath(`${base(slug)}/campaigns/${id}`);
}

export async function duplicateCampaignAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const c = await db.emailCampaign.findFirstOrThrow({ where: { id, storeId: store.id } });
  const copy = await db.emailCampaign.create({ data: { storeId: store.id, subject: c.subject, preheader: c.preheader, heading: c.heading, body: c.body, ctaLabel: c.ctaLabel, ctaUrl: c.ctaUrl } });
  redirect(`${base(slug)}/campaigns/${copy.id}`);
}

export async function deleteCampaignAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.emailCampaign.deleteMany({ where: { id, storeId: store.id, status: { in: ["DRAFT", "CANCELLED"] } } });
  redirect(`${base(slug)}/campaigns`);
}

export async function saveAutomationAction(slug: string, trigger: AutomationTrigger, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  let steps: unknown;
  try {
    steps = JSON.parse(String(fd.get("steps") ?? "[]"));
  } catch {
    return fail(t("validation.fixErrors"));
  }
  const parsed = stepsSchema.safeParse(steps);
  if (!parsed.success) return fail(t("validation.fixErrors"));
  const enabled = fd.get("enabled") === "on" && parsed.data.length > 0;
  const data = { enabled, steps: parsed.data as unknown as Prisma.InputJsonValue };
  await db.emailAutomation.upsert({ where: { storeId_trigger: { storeId: store.id, trigger } }, create: { storeId: store.id, trigger, ...data }, update: data });
  await audit({ userId: user.id, storeId: store.id, action: "automation.update", target: trigger, meta: { enabled, steps: parsed.data.length } });
  revalidatePath(`${base(slug)}/automations`);
  return ok(t("automations.saved"));
}

/** One form, several buttons: the clicked button's `intent` decides (save, test, send, schedule). */
export async function campaignFormAction(slug: string, id: string, state: ActionState, fd: FormData): Promise<ActionState> {
  const intent = String(fd.get("intent") ?? "save");
  if (intent === "test") return sendTestCampaignAction(slug, id, state, fd);
  if (intent === "send") { fd.delete("at"); return sendCampaignAction(slug, id, state, fd); }
  if (intent === "schedule") return sendCampaignAction(slug, id, state, fd);
  return saveCampaignAction(slug, id, state, fd);
}
