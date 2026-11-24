import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStoreAccess, hasRole } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { ConfirmSubmit } from "@/components/ui/form";
import { BlogPostForm } from "../form";
import { deleteBlogPostAction, saveBlogPostAction } from "../actions";

export default async function EditBlogPost({ params }: { params: Promise<{ store: string; id: string }> }) {
  const { store: slug, id } = await params;
  const { store, role, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  const post = await db.blogPost.findFirst({ where: { id, storeId: store.id } });
  if (!post) notFound();
  const storeUrl = await storePublicUrl(store);
  return (
    <>
      <PageHeader
        back={<BackLink href={`/admin/${slug}/online-store/blog`} label={t("nav.blog")} />}
        title={post.title}
        actions={
          <>
            {post.published && <a href={`${storeUrl}/blog/${post.handle}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">{t("common.view")} ↗</a>}
            {hasRole(role, "ADMIN") && <form action={deleteBlogPostAction.bind(null, slug, post.id)}><ConfirmSubmit variant="danger" confirmMessage={t("common.confirmDelete")}>{t("common.delete")}</ConfirmSubmit></form>}
          </>
        }
      />
      <BlogPostForm action={saveBlogPostAction.bind(null, slug, post.id)} post={post} storeUrl={storeUrl} defaultAuthor={user.name} />
    </>
  );
}
