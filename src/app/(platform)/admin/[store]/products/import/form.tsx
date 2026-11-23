"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";
import { importProductsAction } from "../actions";

export function ImportForm({ slug }: { slug: string }) {
  const t = useT();
  return (
    <ActionForm action={importProductsAction.bind(null, slug)} className="space-y-4">
      <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" aria-label="CSV" />
      <SubmitButton pendingLabel={t("import.importing")}>{t("products.import")}</SubmitButton>
    </ActionForm>
  );
}
