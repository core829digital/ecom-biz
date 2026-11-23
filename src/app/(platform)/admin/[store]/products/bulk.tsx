"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";
import { bulkProductsAction } from "./actions";

export function BulkBar({ slug, children }: { slug: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <ActionForm action={bulkProductsAction.bind(null, slug)}>
      <div className="flex flex-wrap items-center gap-2 border-y border-border bg-surface-2/50 px-4 py-2">
        <span className="text-xs text-muted">{t("products.bulk.label")}</span>
        <select name="op" aria-label={t("products.bulk.label")} className="h-8 rounded-md border border-border bg-surface px-2 text-sm">
          <option value="ACTIVE">{t("products.bulk.setActive")}</option>
          <option value="DRAFT">{t("products.bulk.setDraft")}</option>
          <option value="ARCHIVED">{t("products.bulk.archive")}</option>
          <option value="delete">{t("products.bulk.delete")}</option>
        </select>
        <SubmitButton variant="secondary" className="h-8 px-3" onClick={(e) => {
          const form = (e.currentTarget as HTMLButtonElement).form;
          if (form && (form.elements.namedItem("op") as HTMLSelectElement).value === "delete" && !window.confirm(t("common.confirmDelete"))) e.preventDefault();
        }}>{t("products.bulk.apply")}</SubmitButton>
      </div>
      {children}
    </ActionForm>
  );
}
