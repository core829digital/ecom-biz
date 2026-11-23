import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { clientIp } from "@/lib/http";

/** Append an audit entry. Never throws: auditing must not break the action being audited. */
export async function audit(entry: { action: string; userId?: string | null; storeId?: string | null; target?: string | null; meta?: Prisma.InputJsonValue }) {
  try {
    let ip: string | null = null;
    try {
      ip = await clientIp();
    } catch {
      ip = null; // outside a request (scripts, webhooks)
    }
    await db.auditLog.create({
      data: { action: entry.action, userId: entry.userId ?? null, storeId: entry.storeId ?? null, target: entry.target ?? null, meta: entry.meta ?? {}, ip },
    });
  } catch (e) {
    console.error("[audit] failed", entry.action, e);
  }
}
