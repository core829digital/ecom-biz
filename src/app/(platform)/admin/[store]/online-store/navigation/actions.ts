"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";

const itemsSchema = z
  .array(z.object({
    title: z.string().trim().min(1).max(60),
    url: z.string().trim().max(500).refine((u) => /^\/(?!\/)/.test(u) || /^(https?:|mailto:|tel:)/i.test(u)),
  }))
  .max(30);

export async function saveMenuAction(slug: string, handle: "main" | "footer", _: ActionState, fd: FormData): Promise<ActionState> {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const { t } = await getPlatformT();
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("items") ?? "[]"));
  } catch {
    return fail(t("validation.fixErrors"));
  }
  const parsed = itemsSchema.safeParse(raw);
  if (!parsed.success) return fail(t("navigation.error"));
  await db.menu.upsert({
    where: { storeId_handle: { storeId: store.id, handle } },
    create: { storeId: store.id, handle, title: handle === "main" ? "Main menu" : "Footer menu", items: parsed.data },
    update: { items: parsed.data },
  });
  revalidatePath("/", "layout");
  return ok(t("common.saved"));
}
