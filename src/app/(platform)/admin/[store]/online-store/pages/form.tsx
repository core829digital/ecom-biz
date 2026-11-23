import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Checkbox, Input, Textarea } from "@/components/ui/fields";
import { Card } from "@/components/ui/primitives";
import type { Translator } from "@/lib/i18n";
import type { ActionState } from "@/lib/action";
import type { Page } from "@prisma/client";

export function PageForm({ action, page, t }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; page?: Page; t: Translator }) {
  return (
    <ActionForm action={action}>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <div className="space-y-4">
              <Input name="title" label={t("products.field.title")} defaultValue={page?.title} placeholder={t("pages.titlePlaceholder")} required />
              <Textarea name="body" label={t("pages.content")} rows={16} defaultValue={page?.body} hint={t("products.field.descriptionHint")} />
            </div>
          </Card>
          <Card title={t("products.seo")}>
            <div className="space-y-4">
              <Input name="seoTitle" label={t("products.field.seoTitle")} maxLength={70} defaultValue={page?.seoTitle ?? ""} />
              <Textarea name="seoDescription" label={t("products.field.seoDescription")} rows={3} maxLength={320} defaultValue={page?.seoDescription ?? ""} />
              <Input name="handle" autoCapitalize="none" autoCorrect="off" spellCheck={false} label={t("products.field.handle")} defaultValue={page?.handle} hint="/pages/…" />
            </div>
          </Card>
        </div>
        <Card title={t("collections.visibility")}>
          <Checkbox name="published" label={t("collections.published")} defaultChecked={page?.published ?? true} />
        </Card>
      </div>
      <div className="mt-6 flex justify-end"><SubmitButton>{t("common.save")}</SubmitButton></div>
    </ActionForm>
  );
}
