"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadStorefront } from "@/server/storefront";
import { fail, formObject, ok, parseForm, type ActionState } from "@/lib/action";
import { createCustomerSession, destroyCustomerSession, getCurrentCustomer } from "@/lib/auth/customer";
import { hashPassword, isAcceptablePassword, verifyPassword } from "@/lib/auth/password";
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

/** Sends a "set your password" link. Used for both registration and password reset (proves email ownership). */
async function sendPasswordLink(site: string, email: string, kind: "activate" | "reset", names?: { firstName?: string; lastName?: string }) {
  const sf = await loadStorefront(site);
  let customer = await db.customer.findUnique({ where: { storeId_email: { storeId: sf.store.id, email } } });
  if (!customer && kind === "activate") {
    customer = await db.customer.create({ data: { storeId: sf.store.id, email, firstName: names?.firstName || null, lastName: names?.lastName || null } });
  }
  if (!customer) return;
  const token = randomToken();
  await db.customerPasswordReset.create({ data: { customerId: customer.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3600_000) } });
  const url = `${sf.publicUrl}/account/reset/${token}`;
  const theme = parseTheme(sf.store.theme);
  const subject = sf.t(kind === "activate" ? "sf.account.email.activateSubject" : "sf.account.email.resetSubject", { store: sf.store.name });
  const body = sf.t(kind === "activate" ? "sf.account.email.activateBody" : "sf.account.email.resetBody");
  await sendEmail({
    to: email,
    fromName: sf.store.name,
    replyTo: sf.store.email,
    subject,
    text: `${body}\n\n${url}`,
    html: emailLayout({ heading: subject, brandColor: theme.primaryColor, footer: sf.store.name, bodyHtml: `<p>${escapeHtml(body)}</p>${emailButton(url, sf.t("sf.account.setPassword"), theme.primaryColor)}` }),
  });
}

export async function customerRegisterAction(site: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const sf = await loadStorefront(site);
  const schema = z.object({
    email: z.string().trim().toLowerCase().email(sf.t("validation.email")),
    firstName: z.string().trim().max(80).default(""),
    lastName: z.string().trim().max(80).default(""),
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(sf.t("validation.fixErrors"), parsed.fieldErrors);
  if (!(await rateLimit(`creg:${sf.store.id}:${await clientIp()}`, 10, 3600))) return fail(sf.t("auth.error.rateLimited"));
  await sendPasswordLink(site, parsed.data.email, "activate", parsed.data);
  if (fd.get("acceptsMarketing") === "on") {
    await db.customer.updateMany({ where: { storeId: sf.store.id, email: parsed.data.email }, data: { acceptsMarketing: true } });
  }
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
  if (!isAcceptablePassword(password)) return fail(sf.t("validation.fixErrors"), { password: sf.t("validation.passwordLength") });
  const reset = await db.customerPasswordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { customer: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || reset.customer.storeId !== sf.store.id) return fail(sf.t("auth.error.resetInvalid"));
  await db.$transaction([
    db.customer.update({ where: { id: reset.customerId }, data: { passwordHash: await hashPassword(password) } }),
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
