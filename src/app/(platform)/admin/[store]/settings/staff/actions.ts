"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hasRole, requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { getTranslator } from "@/lib/i18n";
import { randomToken, sha256 } from "@/lib/crypto";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import type { Role } from "@prisma/client";
import { assertCanAddStaff, PlanLimitError } from "@/server/plans";
import { audit } from "@/server/audit";

export async function inviteStaffAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user, role } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const inviteRole = String(fd.get("role")) as Role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(t("validation.fixErrors"), { email: t("validation.email") });
  if (!["ADMIN", "STAFF"].includes(inviteRole) || (inviteRole === "ADMIN" && !hasRole(role, "OWNER") && role !== "ADMIN")) return fail(t("products.error.invalid"));
  if (!(await rateLimit(`invite:${store.id}`, 30, 86400))) return fail(t("auth.error.rateLimited"));
  const existing = await db.membership.findFirst({ where: { storeId: store.id, user: { email } } });
  if (existing) return fail(t("validation.fixErrors"), { email: t("staff.alreadyMember") });

  try {
    await assertCanAddStaff(store.id);
  } catch (e) {
    if (e instanceof PlanLimitError) return fail(t("usage.limitStaffDetail", { count: e.limit ?? 0 }));
    throw e;
  }
  const token = randomToken();
  await audit({ userId: user.id, storeId: store.id, action: "staff.invite", target: email, meta: { role: inviteRole } });
  await db.staffInvite.deleteMany({ where: { storeId: store.id, email, acceptedAt: null } });
  await db.staffInvite.create({ data: { storeId: store.id, email, role: inviteRole, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86400_000) } });
  const url = `${env.appUrl}/invite/${token}`;
  const ti = getTranslator(store.locale);
  await sendEmail({
    to: email,
    subject: ti("email.invite.subject", { store: store.name }),
    text: `${ti("email.invite.body", { name: user.name, store: store.name })}\n\n${url}`,
    html: emailLayout({
      heading: ti("email.invite.subject", { store: store.name }),
      bodyHtml: `<p>${escapeHtml(ti("email.invite.body", { name: user.name, store: store.name }))}</p>${emailButton(url, ti("email.invite.cta"))}<p style="color:#71717a;font-size:13px">${escapeHtml(ti("email.invite.expiry"))}</p>`,
    }),
  });
  revalidatePath(`/admin/${slug}/settings/staff`);
  return ok(t("staff.invited", { email }));
}

export async function revokeInviteAction(slug: string, inviteId: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.staffInvite.deleteMany({ where: { id: inviteId, storeId: store.id } });
  revalidatePath(`/admin/${slug}/settings/staff`);
}

export async function changeRoleAction(slug: string, membershipId: string, fd: FormData) {
  const { store } = await requireStoreAccess(slug, "OWNER");
  const role = String(fd.get("role")) as Role;
  if (!["ADMIN", "STAFF"].includes(role)) return;
  await db.membership.updateMany({ where: { id: membershipId, storeId: store.id, role: { not: "OWNER" } }, data: { role } });
  revalidatePath(`/admin/${slug}/settings/staff`);
}

export async function removeMemberAction(slug: string, membershipId: string) {
  const { store, role, user } = await requireStoreAccess(slug, "ADMIN");
  const m = await db.membership.findFirst({ where: { id: membershipId, storeId: store.id } });
  // Owners can't be removed; admins can only remove staff; nobody removes themselves here.
  if (!m || m.role === "OWNER" || m.userId === user.id || (m.role === "ADMIN" && role !== "OWNER")) return;
  await db.membership.delete({ where: { id: m.id } });
  await audit({ userId: user.id, storeId: store.id, action: "staff.remove", target: m.userId });
  revalidatePath(`/admin/${slug}/settings/staff`);
}
