"use client";

import { ActionForm, SubmitButton } from "@/components/ui/form";
import { useT } from "@/components/i18n-provider";
import { updateInventoryAction } from "../actions";

export function InventoryForm({ slug, children }: { slug: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <ActionForm action={updateInventoryAction.bind(null, slug)} className="[&>[role]]:mx-4">
      {children}
      <div className="flex justify-end border-t border-border p-3">
        <SubmitButton>{t("common.save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
