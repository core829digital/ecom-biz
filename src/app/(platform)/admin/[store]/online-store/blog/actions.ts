"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess } from "@/lib/auth/staff";
import { fail, ok, type ActionState } from "@/lib/action";
import { getPlatformT } from "@/lib/i18n/server";
import { handleize } from "@/lib/slug";
import { uniqueHandle } from "@/server/catalog";
import { isPublicHttpsUrl } from "@/lib/url-safety";

export async function saveBlogPostAction(slug: string, id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const { store, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const title = get("title").slice(0, 255);
  if (!title) return fail(t("validation.fixErrors"), { title: t("validation.required") });
  const cover = get("coverUrl");
  // Cover images: our own uploads ("/files/…") or a public https URL.
  if (cover && !cover.startsWith("/files/") && !(cover.length <= 2048 && (await isPublicHttpsUrl(cover)))) {
    return fail(t("validation.fixErrors"), { coverUrl: t("blog.error.cover") });
  }
  const published = fd.get("published") === "on";
  const existing = id ? await db.blogPost.findFirst({ where: { id, storeId: store.id } }) : null;
  if (id && !existing) return fail(t("common.notFound"));
  const data = {
    title,
    handle: await uniqueHandle(store.id, get("handle") ? handleize(get("handle")) : title, "blog", id ?? undefined),
    excerpt: get("excerpt").slice(0, 300) || null,
    body: String(fd.get("body") ?? "").slice(0, 200_000),
    coverUrl: cover || null,
    authorName: get("authorName").slice(0, 100) || user.name,
    published,
    // The first time a post goes live it gets its publication date; later edits keep it.
    publishedAt: published ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
    seoTitle: get("seoTitle").slice(0, 70) || null,
    seoDescription: get("seoDescription").slice(0, 320) || null,
  };
  if (existing) {
    await db.blogPost.update({ where: { id: existing.id }, data });
    revalidatePath(`/admin/${slug}/online-store/blog`);
    return ok(t("common.saved"));
  }
  const post = await db.blogPost.create({ data: { ...data, storeId: store.id } });
  redirect(`/admin/${slug}/online-store/blog/${post.id}`);
}

export async function deleteBlogPostAction(slug: string, id: string) {
  const { store } = await requireStoreAccess(slug, "ADMIN");
  await db.blogPost.deleteMany({ where: { id, storeId: store.id } });
  redirect(`/admin/${slug}/online-store/blog`);
}
