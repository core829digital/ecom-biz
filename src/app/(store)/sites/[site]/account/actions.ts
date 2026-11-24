"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { fail, formObject, ok, parseForm, type ActionState } from "@/lib/action";
import { createCustomerSession, destroyCustomerSession, getCurrentCustomer } from "@/lib/auth/customer";
import { hashPassword, passwordIssue, verifyPassword } from "@/lib/auth/password";
import { randomToken, sha256 } from "@/lib/crypto";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { parseTheme } from "@/lib/theme";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http";
import { addressSchema } from "@/lib/address";

const DUMMY_HASH = "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";

export async function customerLoginAction(site: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`clogin:${sf.store.id}:${ip}`, 20, 900)) || !(await rateLimit(`clogin:${sf.store.id}:${email}`, 8, 900))) {
    return fail(sf.t("auth.error.rateLimited"));
  }
  const customer = await db.customer.findUnique({ where: { storeId_email: { storeId: sf.store.id, email } } });
  const valid = await verifyPassword(password, customer?.passwordHash ?? DUMMY_HASH);
  if (!customer?.passwordHash || !valid) return fail(sf.t("auth.error.invalidCredentials"));
  await createCustomerSession(sf.store.id, customer.id);
  redirect(sf.href("/account"));
}

/**
 * Emails a one-time link that proves the shopper owns the address: "verify" confirms a new account,
 * "reset" lets them choose a new password, "activate" turns a guest record into an account.
 */
async function sendPasswordLink(site: string, email: string, kind: "activate" | "reset" | "verify", names?: { firstName?: string; lastName?: string }) {
  const sf = await loadStorefront(site);
  let customer = await db.customer.findUnique({ where: { storeId_email: { storeId: sf.store.id, email } } });
  if (!customer && kind === "activate") {
    customer = await db.customer.create({ data: { storeId: sf.store.id, email, firstName: names?.firstName || null, lastName: names?.lastName || null } });
  }
  if (!customer) return;
  const token = randomToken();
  await db.customerPasswordReset.create({ data: { customerId: customer.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  const url = `${sf.publicUrl}/account/${kind === "verify" ? "verify" : "reset"}/${token}`;
  const theme = parseTheme(sf.store.theme);
  const subject = sf.t(kind === "activate" ? "sf.account.email.activateSubject" : kind === "verify" ? "sf.account.email.verifySubject" : "sf.account.email.resetSubject", { store: sf.store.name });
  const body = sf.t(kind === "activate" ? "sf.account.email.activateBody" : kind === "verify" ? "sf.account.email.verifyBody" : "sf.account.email.resetBody");
  const cta = sf.t(kind === "verify" ? "sf.account.verify.cta" : "sf.account.setPassword");
  await sendEmail({
    to: email,
    fromName: sf.store.name,
    replyTo: sf.store.email,
    subject,
    text: `${body}\n\n${url}`,
    html: emailLayout({ heading: subject, brandColor: theme.primaryColor, footer: sf.store.name, bodyHtml: `<p>${escapeHtml(body)}</p>${emailButton(url, cta, theme.primaryColor)}` }),
  });
}

/**
 * Creates the account and signs the shopper in at once (no waiting for an email). Until the
 * address is verified by the emailed link, order history, data export and self-service erasure
 * stay locked: guest orders are matched by email, so an unverified account must not reveal them.
 */
export async function customerRegisterAction(site: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const schema = z.object({
    email: z.string().trim().toLowerCase().email(sf.t("validation.email")).max(200),
    firstName: z.string().trim().max(80).default(""),
    lastName: z.string().trim().max(80).default(""),
    password: z.string().max(200),
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(sf.t("validation.fixErrors"), parsed.fieldErrors);
  const { email, firstName, lastName, password } = parsed.data;
  const issue = passwordIssue(password, { email, name: `${firstName} ${lastName}` });
  if (issue) return fail(sf.t("validation.fixErrors"), { password: sf.t(`validation.password.${issue}`) });
  if (!(await rateLimit(`creg:${sf.store.id}:${await clientIp()}`, 10, 3600))) return fail(sf.t("auth.error.rateLimited"));
  const existing = await db.customer.findUnique({ where: { storeId_email: { storeId: sf.store.id, email } } });
  if (existing?.passwordHash) return fail(sf.t("validation.fixErrors"), { email: sf.t("sf.account.exists") });
  const data = {
    passwordHash: await hashPassword(password),
    firstName: existing?.firstName || firstName || null,
    lastName: existing?.lastName || lastName || null,
    ...(fd.get("acceptsMarketing") === "on" ? { acceptsMarketing: true } : {}),
  };
  const customer = existing
    ? await db.customer.update({ where: { id: existing.id }, data })
    : await db.customer.create({ data: { storeId: sf.store.id, email, ...data } });
  await createCustomerSession(sf.store.id, customer.id);
  await sendPasswordLink(site, email, "verify").catch(() => undefined);
  redirect(sf.href("/account?welcome=1"));
}

/** Confirms the address from the emailed link (a POST, so mail scanners can't trigger it). */
export async function customerVerifyEmailAction(site: string, token: string): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const row = await db.customerPasswordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { customer: true } });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.customer.storeId !== sf.store.id) return fail(sf.t("auth.error.resetInvalid"));
  await db.$transaction([
    db.customer.update({ where: { id: row.customerId }, data: { emailVerifiedAt: row.customer.emailVerifiedAt ?? new Date() } }),
    db.customerPasswordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  await createCustomerSession(sf.store.id, row.customerId);
  redirect(sf.href("/account?verified=1"));
}

export async function resendCustomerVerificationAction(site: string): Promise<ActionState> {
  const { sf, customer } = await requireCustomer(site);
  if (customer.emailVerifiedAt) return ok(sf.t("sf.account.verify.done"));
  if (!(await rateLimit(`cverify:${customer.id}`, 3, 3600))) return fail(sf.t("auth.error.rateLimited"));
  await sendPasswordLink(site, customer.email, "verify");
  return ok(sf.t("sf.account.checkEmail"));
}

export async function customerForgotAction(site: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!(await rateLimit(`cforgot:${sf.store.id}:${await clientIp()}`, 10, 3600))) return fail(sf.t("auth.error.rateLimited"));
  await sendPasswordLink(site, email, "reset");
  return ok(sf.t("sf.account.checkEmail"));
}

export async function customerSetPasswordAction(site: string, token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const password = String(fd.get("password") ?? "");
  const issue = passwordIssue(password);
  if (issue) return fail(sf.t("validation.fixErrors"), { password: sf.t(`validation.password.${issue}`) });
  const reset = await db.customerPasswordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { customer: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || reset.customer.storeId !== sf.store.id) return fail(sf.t("auth.error.resetInvalid"));
  await db.$transaction([
    db.customer.update({ where: { id: reset.customerId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: reset.customer.emailVerifiedAt ?? new Date() } }),
    db.customerPasswordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    db.customerSession.deleteMany({ where: { customerId: reset.customerId } }),
  ]);
  await createCustomerSession(sf.store.id, reset.customerId);
  redirect(sf.href("/account"));
}

export async function customerLogoutAction(site: string) {
  const sf = await loadStorefront(site);
  await destroyCustomerSession(sf.store.id);
  redirect(sf.href("/"));
}

async function requireCustomer(site: string) {
  const sf = await loadStorefront(site);
  const customer = await getCurrentCustomer(sf.store.id);
  if (!customer) redirect(sf.href("/account/login"));
  return { sf, customer };
}

export async function saveAddressAction(site: string, addressId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { sf, customer } = await requireCustomer(site);
  const parsed = parseForm(addressSchema, formObject(fd));
  if (parsed.fieldErrors) return fail(sf.t("validation.fixErrors"), parsed.fieldErrors);
  const makeDefault = fd.get("isDefault") === "on";
  const count = await db.customerAddress.count({ where: { customerId: customer.id } });
  if (!addressId && count >= 20) return fail(sf.t("sf.account.tooManyAddresses"));
  await db.$transaction(async (tx) => {
    if (makeDefault || count === 0) await tx.customerAddress.updateMany({ where: { customerId: customer.id }, data: { isDefault: false } });
    const data = { ...parsed.data, company: parsed.data.company || null, address2: parsed.data.address2 || null, province: parsed.data.province || null, phone: parsed.data.phone || null, isDefault: makeDefault || count === 0 };
    if (addressId) await tx.customerAddress.updateMany({ where: { id: addressId, customerId: customer.id }, data });
    else await tx.customerAddress.create({ data: { ...data, customerId: customer.id } });
  });
  revalidatePath("/", "layout");
  redirect(sf.href("/account/addresses"));
}

export async function deleteAddressAction(site: string, addressId: string) {
  const { sf, customer } = await requireCustomer(site);
  await db.customerAddress.deleteMany({ where: { id: addressId, customerId: customer.id } });
  redirect(sf.href("/account/addresses"));
}

/** GDPR art. 17, self-service: the signed-in shopper erases their data in this store. */
export async function deleteMyAccountAction(site: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { sf, customer } = await requireCustomer(site);
  if (!customer.emailVerifiedAt) return fail(sf.t("sf.account.verify.required"));
  if (!(await rateLimit(`sf-delete:${customer.id}`, 5, 3600))) return fail(sf.t("auth.error.rateLimited"));
  if (customer.passwordHash && !(await verifyPassword(String(fd.get("password") ?? ""), customer.passwordHash))) {
    return fail(sf.t("validation.fixErrors"), { password: sf.t("auth.error.invalidCredentials") });
  }
  const { eraseCustomer } = await import("@/server/gdpr");
  await eraseCustomer(sf.store.id, customer.id, { byCustomer: true });
  await destroyCustomerSession(sf.store.id);
  redirect(sf.href("/?deleted=1"));
}
