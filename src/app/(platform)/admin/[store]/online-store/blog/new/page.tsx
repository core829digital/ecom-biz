import { requireStoreAccess } from "@/lib/auth/staff";
import { getPlatformT } from "@/lib/i18n/server";
import { storePublicUrl } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/primitives";
import { BackLink } from "@/components/admin/back-link";
import { BlogPostForm } from "../form";
import { saveBlogPostAction } from "../actions";

export default async function NewBlogPost({ params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store, user } = await requireStoreAccess(slug);
  const { t } = await getPlatformT();
  return (
    <>
      <PageHeader back={<BackLink href={`/admin/${slug}/online-store/blog`} label={t("nav.blog")} />} title={t("blog.add")} />
      <BlogPostForm action={saveBlogPostAction.bind(null, slug, null)} storeUrl={await storePublicUrl(store)} defaultAuthor={user.name} />
    </>
  );
}
