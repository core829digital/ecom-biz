"use server";

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/staff";

export async function setLocaleAction(locale: "en" | "it") {
  const value = locale === "it" ? "it" : "en";
  (await cookies()).set("locale", value, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await db.user.update({ where: { id: user.id }, data: { locale: value } });
}
