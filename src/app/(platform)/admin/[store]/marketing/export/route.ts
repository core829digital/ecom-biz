import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { audit } from "@/server/audit";

export const dynamic = "force-dynamic";

const csvCell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // neutralise spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV of confirmed subscribers, with the consent date and source (proof of consent for the email tool). */
export async function GET(_: Request, { params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, user } = await requireStoreAccess(slug, "ADMIN");
  const subs = await db.newsletterSubscriber.findMany({ where: { storeId: store.id, status: "SUBSCRIBED" }, orderBy: { consentAt: "asc" } });
  await audit({ userId: user.id, storeId: store.id, action: "newsletter.export", meta: { count: subs.length } });
  const rows = [["email", "consent_at", "source"], ...subs.map((s) => [s.email, s.consentAt?.toISOString() ?? "", s.source])];
  return new Response("﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="newsletter-${store.slug}.csv"`, "Cache-Control": "no-store" },
  });
}
