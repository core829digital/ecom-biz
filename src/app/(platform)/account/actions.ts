"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, STAFF_COOKIE } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/server/audit";
import { BillingError, createBillingPortal, createSubscriptionCheckout } from "@/server/billing";
import { sendVerificationEmail } from "@/server/email-verification";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { clientIp } from "@/lib/http";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  const schema = z.object({
    name: z.string().trim().min(1, t("validation.required")).max(100),
    email: z.string().trim().toLowerCase().email(t("validation.email")),
    locale: z.enum(["en", "it"]),
  });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail(t("validation.fixErrors"), Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
  const { name, email, locale } = parsed.data;
  if (email !== user.email) {
    // Changing the login email requires the current password.
    if (!(await verifyPassword(String(fd.get("currentPassword") ?? ""), user.passwordHash))) {
      return fail(t("validation.fixErrors"), { currentPassword: t("account.error.password") });
    }
    if (await db.user.findUnique({ where: { email } })) return fail(t("validation.fixErrors"), { email: t("auth.error.emailTaken") });
  }
  const emailChanged = email !== user.email;
  // A new address must be verified again (it unlocks trials and billing).
  const updated = await db.user.update({ where: { id: user.id }, data: { name, email, locale, ...(emailChanged ? { emailVerifiedAt: null } : {}) } });
  if (emailChanged) {
    await sendVerificationEmail(updated);
    // Warn the previous address: if someone else changed it, the owner finds out immediately.
    const tOld = (await import("@/lib/i18n")).getTranslator(user.locale);
    await sendEmail({
      to: user.email,
      subject: tOld("email.emailChanged.subject"),
      text: tOld("email.emailChanged.body", { email }),
      html: emailLayout({ heading: tOld("email.emailChanged.subject"), bodyHtml: `<p>${escapeHtml(tOld("email.emailChanged.body", { email }))}</p>` }),
    });
  }
  (await cookies()).set("locale", locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  if (email !== user.email) await audit({ userId: user.id, action: "account.email_change", meta: { from: user.email, to: email } });
  revalidatePath("/", "layout");
  return ok(t("common.saved"));
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  if (!(await rateLimit(`pwchange:${user.id}`, 10, 3600))) return fail(t("auth.error.rateLimited"));
  const current = String(fd.get("currentPassword") ?? "");
  const next = String(fd.get("newPassword") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) return fail(t("validation.fixErrors"), { currentPassword: t("account.error.password") });
  const issue = passwordIssue(next, { email: user.email, name: user.name });
  if (issue) return fail(t("validation.fixErrors"), { newPassword: t(`validation.password.${issue}`) });
  const token = (await cookies()).get(STAFF_COOKIE)?.value ?? "";
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } }),
    // Keep this session, sign out every other device.
    db.session.deleteMany({ where: { userId: user.id, NOT: { tokenHash: sha256(token) } } }),
  ]);
  await audit({ userId: user.id, action: "account.password_change" });
  return ok(t("account.passwordChanged"));
}

export async function choosePlanAction(planId: string) {
  const user = await requireUser();
  const plan = await db.plan.findFirst({ where: { id: planId, active: true } });
  if (!plan) redirect("/account/billing");
  let url: string;
  try {
    // An existing subscription is changed in the billing portal: never create a second one.
    const live = user.stripeSubscriptionId && ["TRIALING", "ACTIVE", "PAST_DUE"].includes(user.subscriptionStatus);
    url = live && plan.priceCents > 0
      ? await createBillingPortal(user)
      : (await createSubscriptionCheckout(user, plan, { ip: await clientIp() })).url;
  } catch (e) {
    if (!(e instanceof BillingError)) console.error("[billing]", e);
    redirect(`/account/billing?error=${e instanceof BillingError ? e.code : "unknown"}`);
  }
  await audit({ userId: user.id, action: "billing.plan_checkout", target: plan.name });
  redirect(url);
}

export async function billingPortalAction() {
  const user = await requireUser();
  let url: string;
  try {
    url = await createBillingPortal(user);
  } catch {
    redirect("/account/billing?error=1");
  }
  redirect(url);
}
