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
  });
  const parsed = parseForm(schema, formObject(fd));
  if (parsed.fieldErrors) return fail(t("validation.fixErrors"), parsed.fieldErrors);
  if (!(await rateLimit(`create-store:${user.id}`, 10, 86400))) return fail(t("auth.error.rateLimited"));
  if (await db.store.findUnique({ where: { slug: parsed.data.slug } })) {
    return fail(t("validation.fixErrors"), { slug: t("stores.new.slugTaken") });
  }
  const store = await createStore({ ownerId: user.id, ...parsed.data });
  redirect(`/admin/${store.slug}`);
}
