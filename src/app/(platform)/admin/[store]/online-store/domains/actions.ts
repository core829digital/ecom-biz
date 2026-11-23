"use server";

import { revalidatePath } from "next/cache";
import { resolveTxt } from "node:dns/promises";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { assertFeature, PlanLimitError } from "@/server/plans";
import { audit } from "@/server/audit";

const HOST_RE = /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

export async function addDomainAction(slug: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug, "OWNER");
  const { t } = await getPlatformT();
  try {
    await assertFeature(store.id, "customDomain");
  } catch (e) {
    if (e instanceof PlanLimitError) return fail(t("usage.featureCustomDomain"));
    throw e;
  }
  const hostname = String(fd.get("hostname") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const root = env.storefrontRootDomain.split(":")[0];
  if (!HOST_RE.test(hostname) || hostname === root || hostname.endsWith(`.${root}`) || hostname === new URL(env.appUrl).hostname) {
    return fail(t("validation.fixErrors"), { hostname: t("domains.error.invalid") });
  }
  if (await db.domain.findUnique({ where: { hostname } })) return fail(t("validation.fixErrors"), { hostname: t("domains.error.taken") });
  if ((await db.domain.count({ where: { storeId: store.id } })) >= 10) return fail(t("domains.error.limit"));
  await db.domain.create({ data: { storeId: store.id, hostname, verificationToken: `verify-${randomToken(16)}` } });
  await audit({ userId: user.id, storeId: store.id, action: "domain.add", target: hostname });
  revalidatePath(`/admin/${slug}/online-store/domains`);
  return ok(t("domains.added"));
}

/** Ownership check via TXT record at _commerce-verify.<hostname>. */
export async function verifyDomainAction(slug: string, domainId: string, _: ActionState): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "OWNER");
  const { t } = await getPlatformT();
  const domain = await db.domain.findFirst({ where: { id: domainId, storeId: store.id } });
  if (!domain) return fail(t("common.notFound"));
  let records: string[] = [];
  try {
    records = (await resolveTxt(`_commerce-verify.${domain.hostname}`)).map((r) => r.join(""));
  } catch {
    records = [];
  }
  if (!records.includes(domain.verificationToken)) return fail(t("domains.error.notVerified"));
  const hasPrimary = await db.domain.count({ where: { storeId: store.id, isPrimary: true, verifiedAt: { not: null } } });
  await db.domain.update({ where: { id: domain.id }, data: { verifiedAt: new Date(), isPrimary: hasPrimary === 0 } });
  revalidatePath(`/admin/${slug}/online-store/domains`);
  return ok(t("domains.verified"));
}

export async function setPrimaryDomainAction(slug: string, domainId: string) {
  const { store } = await requireStoreAccess(slug, "OWNER");
  const domain = await db.domain.findFirst({ where: { id: domainId, storeId: store.id, verifiedAt: { not: null } } });
  if (!domain) return;
  await db.$transaction([
    db.domain.updateMany({ where: { storeId: store.id }, data: { isPrimary: false } }),
    db.domain.update({ where: { id: domain.id }, data: { isPrimary: true } }),
  ]);
  revalidatePath(`/admin/${slug}/online-store/domains`);
}

export async function removeDomainAction(slug: string, domainId: string) {
  const { store } = await requireStoreAccess(slug, "OWNER");
  await db.domain.deleteMany({ where: { id: domainId, storeId: store.id } });
  revalidatePath(`/admin/${slug}/online-store/domains`);
}
