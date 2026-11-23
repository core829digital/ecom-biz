"use client";

import { useRef, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/components/i18n-provider";
import { bulkProductsAction } from "./actions";

export function BulkBar({ slug, children }: { slug: string; children: React.ReactNode }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const confirmed = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  return (
    <ActionForm action={bulkProductsAction.bind(null, slug)}>
      <div ref={formRef} className="flex flex-wrap items-center gap-2 border-y border-border bg-surface-2/50 px-4 py-2">
        <span className="text-xs text-muted">{t("products.bulk.label")}</span>
        <select name="op" aria-label={t("products.bulk.label")} className="h-8 rounded-md border border-border bg-surface px-2 text-sm">
          <option value="ACTIVE">{t("products.bulk.setActive")}</option>
          <option value="DRAFT">{t("products.bulk.setDraft")}</option>
          <option value="ARCHIVED">{t("products.bulk.archive")}</option>
          <option value="delete">{t("products.bulk.delete")}</option>
        </select>
        <SubmitButton
          variant="secondary"
          className="h-8 px-3"
          onClick={(e) => {
            const form = (e.currentTarget as HTMLButtonElement).form;
            const op = (form?.elements.namedItem("op") as HTMLSelectElement | null)?.value;
            if (op === "delete" && !confirmed.current) {
              e.preventDefault();
              setConfirming(true);
            }
            confirmed.current = false;
          }}
        >
          {t("products.bulk.apply")}
        </SubmitButton>
      </div>
      {children}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t("common.confirmDelete")}
        size="sm"
        footer={
          <>
            <button type="button" className={buttonClass("secondary")} onClick={() => setConfirming(false)}>{t("common.cancel")}</button>
            <button
              type="button"
              data-autofocus
              className={buttonClass("danger")}
              onClick={() => {
                setConfirming(false);
                confirmed.current = true;
                formRef.current?.closest("form")?.requestSubmit(formRef.current.querySelector<HTMLButtonElement>("button[type=submit]") ?? undefined);
              }}
            >
              {t("common.delete")}
            </button>
          </>
        }
      />
    </ActionForm>
  );
}
