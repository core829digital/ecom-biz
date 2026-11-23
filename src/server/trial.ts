import "server-only";
import { createHmac } from "node:crypto";
import type { TrialClaimKind } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { NETWORK_WINDOW_DAYS, normalizeEmail, trialDecision } from "@/lib/billing-rules";

/** Keyed hash: the ledger never stores raw emails, card fingerprints or IPs. */
export function claimHash(kind: TrialClaimKind, value: string) {
  return createHmac("sha256", env.appSecret).update(`${kind}:${value}`).digest("hex");
}

/** IPv4 → /24, IPv6 → /48: one "network", so rotating addresses on one connection doesn't help. */
export function networkOf(ip: string) {
  if (!ip || ip === "unknown") return null;
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":");
  const parts = ip.split(".");
  return parts.length === 4 ? parts.slice(0, 3).join(".") : ip;
}

async function claimed(kind: TrialClaimKind, value: string, exceptUserId?: string) {
  const hit = await db.trialClaim.findFirst({ where: { kind, valueHash: claimHash(kind, value), ...(exceptUserId ? { NOT: { userId: exceptUserId } } : {}) }, select: { id: true } });
  return !!hit;
}

/** Can this account start a free trial right now? */
export async function trialEligibility(user: { id: string; email: string; trialUsedAt: Date | null }, planTrialDays: number, ip: string) {
  const network = networkOf(ip);
  const [emailClaimed, networkClaimsInWindow] = await Promise.all([
    claimed("EMAIL", normalizeEmail(user.email), user.id),
    network
      ? db.trialClaim.count({ where: { kind: "NETWORK", valueHash: claimHash("NETWORK", network), createdAt: { gt: new Date(Date.now() - NETWORK_WINDOW_DAYS * 86_400_000) }, NOT: { userId: user.id } } })
      : Promise.resolve(0),
  ]);
  return trialDecision({ planTrialDays, trialUsedAt: user.trialUsedAt, email: user.email, emailClaimed, networkClaimsInWindow });
}

/** Has this card already been used for a trial by another account? */
export function cardUsedForTrial(fingerprint: string, userId: string) {
  return claimed("CARD", fingerprint, userId);
}

/** Record who started a trial, so the same person, card or network can't start another one. */
export async function recordTrialClaims(userId: string, claims: { email?: string; cardFingerprint?: string | null; ip?: string | null }) {
  const rows: { kind: TrialClaimKind; valueHash: string; userId: string }[] = [];
  if (claims.email) rows.push({ kind: "EMAIL", valueHash: claimHash("EMAIL", normalizeEmail(claims.email)), userId });
  if (claims.cardFingerprint) rows.push({ kind: "CARD", valueHash: claimHash("CARD", claims.cardFingerprint), userId });
  const network = claims.ip ? networkOf(claims.ip) : null;
  if (network) rows.push({ kind: "NETWORK", valueHash: claimHash("NETWORK", network), userId });
  // Skip claims this user already holds (webhooks can repeat).
  const existing = await db.trialClaim.findMany({ where: { userId, OR: rows.map((r) => ({ kind: r.kind, valueHash: r.valueHash })) }, select: { kind: true, valueHash: true } });
  const fresh = rows.filter((r) => !existing.some((e) => e.kind === r.kind && e.valueHash === r.valueHash));
  if (fresh.length) await db.trialClaim.createMany({ data: fresh });
}
