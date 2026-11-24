"use client";

import { SeoPreview } from "@/components/admin/seo-preview";
import { useMemo, useRef, useState } from "react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea, inputClass } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { COLLECTION_SORTS, RULE_FIELDS, RULE_OPS, type CollectionRule, type RuleField } from "@/lib/collections";
import type { ActionState } from "@/lib/action";

export type EditorCollection = {
  title: string;
  handle: string;
  description: string;
  imageUrl: string;
  type: "MANUAL" | "SMART";
  rules: CollectionRule[];
  matchAll: boolean;
  sortOrder: string;
  published: boolean;
  seoTitle: string;
  seoDescription: string;
};

export function CollectionEditor({
  initial,
  action,
  uploadImage,
  isNew,
}: {
  initial: EditorCollection;
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  uploadImage: (fd: FormData) => Promise<{ url?: string; error?: string }>;
  isNew: boolean;
}) {
  const t = useT();
  const [c, setC] = useState(initial);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<EditorCollection>) => setC((p) => ({ ...p, ...patch }));
  const payload = useMemo(() => JSON.stringify(c), [c]);
  const rulesError = useFieldError("rules");

  const setRule = (i: number, patch: Partial<CollectionRule>) =>
    update({ rules: c.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <ActionForm action={action}>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <div className="space-y-4">
              <Input name="title" label={t("products.field.title")} value={c.title} onChange={(e) => update({ title: e.target.value })} required />
              <Textarea label={t("products.field.description")} hint={t("products.field.descriptionHint")} value={c.description} onChange={(e) => update({ description: e.target.value })} />
            </div>
          </Card>

          <Card title={t("collections.type")}>
            <div className="space-y-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ctype" checked={c.type === "MANUAL"} onChange={() => update({ type: "MANUAL" })} className="mt-1" />
                <span><span className="font-medium">{t("collections.type.MANUAL")}</span><span className="block text-muted">{t("collections.type.MANUAL.hint")}</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input type="radio" name="ctype" checked={c.type === "SMART"} onChange={() => update({ type: "SMART", rules: c.rules.length ? c.rules : [{ field: "tag", op: "eq", value: "" }] })} className="mt-1" />
                <span><span className="font-medium">{t("collections.type.SMART")}</span><span className="block text-muted">{t("collections.type.SMART.hint")}</span></span>
              </label>
              {!isNew && initial.type === "MANUAL" && c.type === "SMART" && <p className="text-xs text-warning">{t("collections.switchWarning")}</p>}
            </div>
            {c.type === "SMART" && (
              <div className="mt-5 space-y-3 border-t border-border pt-5">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span>{t("collections.match")}</span>
                  <label className="flex items-center gap-1"><input type="radio" checked={c.matchAll} onChange={() => update({ matchAll: true })} /> {t("collections.matchAll")}</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={!c.matchAll} onChange={() => update({ matchAll: false })} /> {t("collections.matchAny")}</label>
                </div>
                {c.rules.map((r, i) => (
                  <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
                    <select aria-label={t("collections.rule.field")} className={cn(inputClass, "sm:w-36")} value={r.field} onChange={(e) => { const field = e.target.value as RuleField; setRule(i, { field, op: RULE_OPS[field][0] }); }}>
                      {RULE_FIELDS.map((f) => <option key={f} value={f}>{t(`collections.field.${f}`)}</option>)}
                    </select>
                    <select aria-label={t("collections.rule.op")} className={cn(inputClass, "sm:w-40")} value={r.op} onChange={(e) => setRule(i, { op: e.target.value as CollectionRule["op"] })}>
                      {RULE_OPS[r.field].map((o) => <option key={o} value={o}>{t(`collections.op.${o}`)}</option>)}
                    </select>
                    <input aria-label={t("collections.rule.value")} className={cn(inputClass, "flex-1")} value={r.value} inputMode={r.field === "price" ? "decimal" : undefined} onChange={(e) => setRule(i, { value: e.target.value })} />
                    <Button variant="ghost" size="sm" className="h-10 text-danger" onClick={() => update({ rules: c.rules.filter((_, j) => j !== i) })} disabled={c.rules.length === 1}>
                      {t("common.delete")}
                    </Button>
                  </div>
                ))}
                {rulesError && <p className="text-sm text-danger">{rulesError}</p>}
                <Button variant="secondary" size="sm" onClick={() => update({ rules: [...c.rules, { field: "tag", op: "eq", value: "" }] })} disabled={c.rules.length >= 20}>
                  + {t("collections.addRule")}
                </Button>
              </div>
            )}
          </Card>

          <Card title={t("products.seo")}>
            <div className="space-y-4">
              <Input label={t("products.field.seoTitle")} maxLength={70} value={c.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} />
              <Textarea label={t("products.field.seoDescription")} rows={3} maxLength={320} value={c.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} />
              <Input label={t("products.field.handle")} autoCapitalize="none" spellCheck={false} value={c.handle} onChange={(e) => update({ handle: e.target.value })} />
              <SeoPreview title={c.seoTitle || c.title} description={c.seoDescription || c.description.replace(/\s+/g, " ").trim()} url={`/collections/${c.handle || "…"}`} />
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title={t("collections.visibility")}>
            <Checkbox label={t("collections.published")} checked={c.published} onChange={(e) => update({ published: e.target.checked })} />
          </Card>
          <Card title={t("collections.image")}>
            {c.imageUrl && <img src={c.imageUrl} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover" />}
            <div className="flex gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-2">
                {c.imageUrl ? t("collections.image.replace") : t("collections.image.add")}
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploadError(null);
                  const fd = new FormData();
                  fd.append("file", f);
                  const res = await uploadImage(fd);
                  if (res.url) update({ imageUrl: res.url });
                  else setUploadError(res.error ?? t("upload.failed"));
                }} />
              </label>
              {c.imageUrl && <Button variant="ghost" size="sm" className="text-danger" onClick={() => update({ imageUrl: "" })}>{t("common.delete")}</Button>}
            </div>
            {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
          </Card>
          <Card title={t("collections.sort")}>
            <Select value={c.sortOrder} onChange={(e) => update({ sortOrder: e.target.value })} aria-label={t("collections.sort")}>
              {COLLECTION_SORTS.filter((s) => c.type === "MANUAL" || s !== "manual").map((s) => (
                <option key={s} value={s}>{t(`collections.sort.${s}`)}</option>
              ))}
            </Select>
          </Card>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 mt-6 flex justify-end border-t border-border bg-bg/90 py-3 backdrop-blur">
        <SubmitButton pendingLabel={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
