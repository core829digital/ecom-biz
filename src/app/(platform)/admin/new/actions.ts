"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/staff";
import { fail, formObject, parseForm, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { isValidStoreSlug } from "@/lib/slug";
import { COUNTRY_CODES, CURRENCIES } from "@/lib/geo";
import { createStore } from "@/server/stores";
import { rateLimit } from "@/lib/rate-limit";
import { assertCanCreateStore, PlanLimitError } from "@/server/plans";
import { audit } from "@/server/audit";
import { THEME_PRESETS } from "@/lib/theme";
import { STARTER_IDS } from "@/lib/theme-starters";

export async function createStoreAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const { t } = await getPlatformT();
  const schema = z.object({
    name: z.string().trim().min(1, t("validation.required")).max(80),
    slug: z.string().trim().toLowerCase().refine(isValidStoreSlug, t("stores.new.slugInvalid")),
    email: z.string().trim().toLowerCase().email(t("validation.email")),
    currency: z.enum(CURRENCIES as [string, ...string[]]),
    locale: z.enum(["en", "it"]),
    countryCode: z.string().refine((c) => COUNTRY_CODES.includes(c), t("validation.required")),
    preset: z.enum(THEME_PRESETS.map((p) => p.id) as [string, ...string[]]).catch("minimal"),
    starter: z.enum(STARTER_IDS).catch("classic"),
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  if (!(await rateLimit(`create-store:${user.id}`, 10, 86400))) return fail(t("auth.error.rateLimited"));
  try {
    await assertCanCreateStore(await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { plan: true } }));
  } catch (e) {
    if (e instanceof PlanLimitError) return fail(t("usage.limitStoresDetail", { count: e.limit ?? 0 }));
    throw e;
  }
  if (await db.store.findUnique({ where: { slug: parsed.data.slug } })) {
    return fail(t("validation.fixErrors"), { slug: t("stores.new.slugTaken") });
  }
  const store = await createStore({ ownerId: user.id, ...parsed.data });
  await audit({ userId: user.id, storeId: store.id, action: "store.create", target: store.slug });
  redirect(`/admin/${store.slug}`);
}
