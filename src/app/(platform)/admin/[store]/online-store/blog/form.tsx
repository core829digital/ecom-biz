"use client";

import { useState } from "react";
import type { BlogPost } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import { SeoPreview } from "@/components/admin/seo-preview";
import { useT } from "@/components/i18n-provider";
import type { ActionState } from "@/lib/action";

export function BlogPostForm({ action, post, storeUrl, defaultAuthor }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; post?: BlogPost; storeUrl: string; defaultAuthor: string }) {
  const t = useT();
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [seoTitle, setSeoTitle] = useState(post?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(post?.seoDescription ?? "");
  const [handle, setHandle] = useState(post?.handle ?? "");
  const [cover, setCover] = useState(post?.coverUrl ?? "");
  return (
    <ActionForm action={action}>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <div className="space-y-4">
              <Input name="title" label={t("products.field.title")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("blog.titlePlaceholder")} required />
              <Textarea name="excerpt" label={t("blog.excerpt")} rows={2} maxLength={300} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} hint={t("blog.excerptHint")} />
              <Textarea name="body" label={t("pages.content")} rows={18} defaultValue={post?.body} hint={t("products.field.descriptionHint")} />
            </div>
          </Card>
          <Card title={t("products.seo")}>
            <div className="space-y-4">
              <Input name="seoTitle" label={t("products.field.seoTitle")} maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              <Textarea name="seoDescription" label={t("products.field.seoDescription")} rows={3} maxLength={320} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
              <Input name="handle" autoCapitalize="none" autoCorrect="off" spellCheck={false} label={t("products.field.handle")} value={handle} onChange={(e) => setHandle(e.target.value)} hint="/blog/…" />
              <SeoPreview title={seoTitle || title} description={seoDescription || excerpt} url={`${storeUrl}/blog/${handle || "…"}`} />
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title={t("collections.visibility")}>
            <Checkbox name="published" label={t("collections.published")} hint={t("blog.publishedHint")} defaultChecked={post?.published ?? false} />
          </Card>
          <Card title={t("blog.cover")}>
            <div className="space-y-3">
              {cover && <img src={cover} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" />}
              <Input name="coverUrl" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} label={t("blog.coverUrl")} value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" hint={t("blog.coverHint")} />
            </div>
          </Card>
          <Card title={t("blog.author")}>
            <Input name="authorName" autoComplete="name" label={t("blog.authorName")} defaultValue={post?.authorName ?? defaultAuthor} maxLength={100} />
          </Card>
        </div>
      </div>
      <div className="mt-6 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
    </ActionForm>
  );
}
