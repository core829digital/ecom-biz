"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { currentSessionId, requireUser } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { verifyPassword } from "@/lib/auth/password";
import { generateRecoveryCodes, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { open, seal } from "@/lib/secret-box";
import { sha256 } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { audit } from "@/server/audit";

export type EnrollState = { error?: string; qr?: string; secret?: string; codes?: string[]; done?: boolean; at?: number } | null;

/** Step 1: create a pending secret (not active until confirmed) and return a QR code. */
export async function beginEnrollAction(): Promise<EnrollState> {
  const user = await requireUser();
  if (user.totpEnabledAt) return { done: true };
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: seal(secret) } });
  const svg = await QRCode.toString(otpauthUri(secret, user.email, env.platformName), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { qr: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, secret: secret.replace(/(.{4})/g, "$1 ").trim(), at: Date.now() };
}

/** Step 2: confirm with a code from the app; enable 2FA and return recovery codes once. */
export async function confirmEnrollAction(_: EnrollState, fd: FormData): Promise<EnrollState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  if (!(await rateLimit(`2fa-enroll:${user.id}`, 10, 900))) return { error: t("auth.error.rateLimited"), at: Date.now() };
  if (!user.totpSecret) return { error: t("security.error.code"), at: Date.now() };
  if (!verifyTotp(open(user.totpSecret), String(fd.get("code") ?? ""))) return { error: t("security.error.code"), at: Date.now() };
  const codes = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), recoveryCodes: codes.map(sha256) } });
  await audit({ userId: user.id, action: "auth.2fa_enabled" });
  revalidatePath("/account/security");
  return { codes, done: true, at: Date.now() };
}

export async function disableTwoFactorAction(_: EnrollState, fd: FormData): Promise<EnrollState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  if (!(await rateLimit(`2fa-disable:${user.id}`, 10, 900))) return { error: t("auth.error.rateLimited"), at: Date.now() };
  if (!(await verifyPassword(String(fd.get("password") ?? ""), user.passwordHash))) return { error: t("account.error.password"), at: Date.now() };
  if (!user.totpSecret || !verifyTotp(open(user.totpSecret), String(fd.get("code") ?? ""))) return { error: t("security.error.code"), at: Date.now() };
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: null, totpSecret: null, recoveryCodes: [] } });
  await audit({ userId: user.id, action: "auth.2fa_disabled" });
  revalidatePath("/account/security");
  return { done: true, at: Date.now() };
}

export async function regenerateRecoveryCodesAction(_: EnrollState, fd: FormData): Promise<EnrollState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  if (!user.totpEnabledAt || !user.totpSecret || !verifyTotp(open(user.totpSecret), String(fd.get("code") ?? ""))) return { error: t("security.error.code"), at: Date.now() };
  const codes = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { recoveryCodes: codes.map(sha256) } });
  await audit({ userId: user.id, action: "auth.recovery_codes_regenerated" });
  return { codes, at: Date.now() };
}

export async function revokeSessionAction(sessionId: string) {
  const user = await requireUser();
  const current = await currentSessionId();
  if (sessionId === current) return;
  await db.session.deleteMany({ where: { id: sessionId, userId: user.id } });
  await audit({ userId: user.id, action: "auth.session_revoked" });
  revalidatePath("/account/security");
}

export async function revokeOtherSessionsAction() {
  const user = await requireUser();
  const current = await currentSessionId();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: current ?? "" } } });
  await audit({ userId: user.id, action: "auth.sessions_revoked_all" });
  revalidatePath("/account/security");
}
