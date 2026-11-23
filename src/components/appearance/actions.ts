"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/staff";
import { normalizeAccent, normalizeTheme } from "@/lib/appearance";
import { writeAppearanceCookies } from "@/lib/appearance-server";

export async function setAppearanceAction(theme: string, accent: string) {
  const t = normalizeTheme(theme);
  const a = normalizeAccent(accent);
  await writeAppearanceCookies(t, a);
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { theme: t, accent: a } });
}
