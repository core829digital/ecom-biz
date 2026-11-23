"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseForm, formObject, type ActionState } from "@/lib/action";
import { hashPassword, isAcceptablePassword, verifyPassword } from "@/lib/auth/password";
import { createStaffSession, destroyStaffSession } from "@/lib/auth/staff";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { getPlatformT } from "@/lib/i18n/server";
import { randomToken, sha256 } from "@/lib/crypto";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { audit } from "@/server/audit";
import { sendVerificationEmail, verifyEmailToken } from "@/server/email-verification";
import { getCurrentUser } from "@/lib/auth/staff";

/** Only allow same-origin relative redirects to avoid open-redirects. */
function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getPlatformT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 20, 900)) || !(await rateLimit(`login:email:${email}`, 8, 900))) {
    return fail(t("auth.error.rateLimited"));
  }
  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt to keep timing uniform whether or not the user exists.
  const valid = await verifyPassword(password, user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !valid) {
    if (user) await audit({ userId: user.id, action: "auth.login_failed" });
    return fail(t("auth.error.invalidCredentials"));
  }
  const next = safeNext(String(fd.get("next") ?? ""));
  if (user.totpEnabledAt) {
    await createStaffSession(user.id, { verified: false });
    redirect(`/login/verify?next=${encodeURIComponent(next)}`);
  }
  await createStaffSession(user.id);
  await audit({ userId: user.id, action: "auth.login" });
  redirect(next);
}

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t, locale } = await getPlatformT();
  const schema = z.object({
    name: z.string().trim().min(1, t("validation.required")).max(100),
    email: z.string().trim().toLowerCase().email(t("validation.email")),
    password: z.string().refine(isAcceptablePassword, t("validation.passwordLength")),
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  const ip = await clientIp();
  if (!(await rateLimit(`signup:ip:${ip}`, 10, 3600))) return fail(t("auth.error.rateLimited"));

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return fail(t("validation.fixErrors"), { email: t("auth.error.emailTaken") });

  const entryPlan = await db.plan.findFirst({ where: { active: true }, orderBy: { position: "asc" } });
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      locale,
      // The plan is a preselection: nothing is active until the merchant starts a subscription
      // (or a card-backed free trial) from Billing. See server/billing.ts.
      planId: entryPlan?.id,
      subscriptionStatus: "NONE",
    },
  });
  await sendVerificationEmail(user);
  await audit({ userId: user.id, action: "auth.signup" });
  await createStaffSession(user.id);
  const next = safeNext(String(fd.get("next") ?? ""));
  redirect(next === "/admin" ? "/admin/new" : next);
}

export async function logoutAction() {
  await destroyStaffSession();
  redirect("/login");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getPlatformT();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const ip = await clientIp();
  if (!(await rateLimit(`forgot:ip:${ip}`, 10, 3600))) return fail(t("auth.error.rateLimited"));
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = randomToken();
    await db.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
    });
    const url = `${env.appUrl}/reset-password/${token}`;
    const tu = (await import("@/lib/i18n")).getTranslator(user.locale);
    await sendEmail({
      to: user.email,
      subject: tu("email.reset.subject"),
      text: `${tu("email.reset.body")}\n\n${url}`,
      html: emailLayout({
        heading: tu("email.reset.subject"),
        bodyHtml: `<p>${escapeHtml(tu("email.reset.body"))}</p>${emailButton(url, tu("email.reset.cta"))}`,
      }),
    });
  }
  // Same response either way: never reveal which emails have accounts.
  return ok(t("auth.forgot.sent"));
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getPlatformT();
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (!isAcceptablePassword(password)) return fail(t("validation.fixErrors"), { password: t("validation.passwordLength") });
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return fail(t("auth.error.resetInvalid"));
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: reset.userId } }), // sign out everywhere
  ]);
  await createStaffSession(reset.userId);
  redirect("/admin");
}

export async function verifyTwoFactorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { t } = await getPlatformT();
  const { getPendingTwoFactorSession } = await import("@/lib/auth/staff");
  const { verifyTotp } = await import("@/lib/totp");
  const { open } = await import("@/lib/secret-box");
  const session = await getPendingTwoFactorSession();
  if (!session) redirect("/login");
  if (!(await rateLimit(`2fa:${session.userId}`, 10, 900))) return fail(t("auth.error.rateLimited"));
  const code = String(fd.get("code") ?? "").trim().toLowerCase();
  const user = session.user;
  let ok2 = false;
  if (/^\d{6}$/.test(code.replace(/\s/g, "")) && user.totpSecret) {
    ok2 = verifyTotp(open(user.totpSecret), code);
  } else if (/^[a-z0-9]{4}-?[a-z0-9]{4}$/.test(code)) {
    const normalized = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
    const hash = sha256(normalized);
    if (user.recoveryCodes.includes(hash)) {
      // Recovery codes are single-use.
      await db.user.update({ where: { id: user.id }, data: { recoveryCodes: user.recoveryCodes.filter((h) => h !== hash) } });
      await audit({ userId: user.id, action: "auth.recovery_code_used" });
      ok2 = true;
    }
  }
  if (!ok2) {
    await audit({ userId: user.id, action: "auth.2fa_failed" });
    return fail(t("security.error.code"));
  }
  await db.session.update({ where: { id: session.id }, data: { verified: true } });
  await audit({ userId: user.id, action: "auth.login", meta: { twoFactor: true } });
  redirect(safeNext(String(fd.get("next") ?? "")));
}

export async function confirmEmailAction(token: string, _: ActionState): Promise<ActionState> {
  const { t } = await getPlatformT();
  const ip = await clientIp();
  if (!(await rateLimit(`verify:ip:${ip}`, 30, 3600))) return fail(t("auth.error.rateLimited"));
  if ((await verifyEmailToken(token)) !== "ok") return fail(t("auth.verify.invalid"));
  const user = await getCurrentUser();
  redirect(user ? "/account/billing?verified=1" : "/login?verified=1");
}

export async function resendVerificationAction(_: ActionState): Promise<ActionState> {
  const { t } = await getPlatformT();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) return ok(t("auth.verify.already"));
  if (!(await rateLimit(`verify-resend:${user.id}`, 3, 3600))) return fail(t("auth.error.rateLimited"));
  await sendVerificationEmail(user);
  return ok(t("auth.verify.sent", { email: user.email }));
}
