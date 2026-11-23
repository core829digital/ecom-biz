"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { Checkbox, Input, Select, Textarea, inputClass } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { cn } from "@/lib/cn";
import { comboKey, MAX_VARIANTS, variantCombos, type OptionDef } from "@/lib/variants";
import type { ActionState } from "@/lib/action";
import { emptyVariant, type EditorProduct, type EditorVariant } from "./editor-types";

export function ProductEditor({
  initial,
  action,
  uploadImage,
  collections,
  currency,
  storefrontUrl,
}: {
  initial: EditorProduct;
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  uploadImage: (fd: FormData) => Promise<{ url?: string; error?: string }>;
  collections: { id: string; title: string }[];
  currency: string;
  storefrontUrl?: string;
}) {
  const t = useT();
  const [p, setP] = useState<EditorProduct>(initial);
  const [tagsInput, setTagsInput] = useState(initial.tags.join(", "));
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (patch: Partial<EditorProduct>) => {
    setP((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  /** Rebuild the variant list from options, preserving rows whose combination still exists. */
  const setOptions = (options: OptionDef[]) => {
    const combos = variantCombos(options);
    setP((prev) => {
      const byKey = new Map(prev.variants.map((v) => [comboKey([v.option1, v.option2, v.option3]), v]));
      const template = prev.variants[0] ?? emptyVariant();
      const variants: EditorVariant[] =
        combos.length === 0
          ? [{ ...(byKey.get("") ?? { ...template, id: undefined }), option1: null, option2: null, option3: null }]
          : (() => {
              const used = new Set<EditorVariant>();
              return combos.slice(0, MAX_VARIANTS).map((c) => {
                const values = { option1: c[0] ?? null, option2: c[1] ?? null, option3: c[2] ?? null };
                const exact = byKey.get(comboKey(c));
                if (exact && !used.has(exact)) {
                  used.add(exact);
                  return exact;
                }
                // An option was added: carry an existing variant (SKU, stock, price) onto the first matching combination.
                const carried = prev.variants.find((v) => {
                  if (used.has(v)) return false;
                  const vals = [v.option1, v.option2, v.option3].filter((x): x is string => !!x);
                  return vals.length < c.length && vals.every((val, idx) => c[idx] === val);
                });
                if (carried) {
                  used.add(carried);
                  return { ...carried, ...values };
                }
                return { ...template, id: undefined, sku: "", inventoryQty: 0, ...values };
              });
            })();
      return { ...prev, options, variants };
    });
    setDirty(true);
  };

  const setVariant = (i: number, patch: Partial<EditorVariant>) => {
    setP((prev) => ({ ...prev, variants: prev.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
    setDirty(true);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadImage(fd);
      setUploading((n) => n - 1);
      if (res.url) {
        setP((prev) => ({ ...prev, images: [...prev.images, { url: res.url!, alt: "" }] }));
        setDirty(true);
      } else setUploadError(res.error ?? t("upload.failed"));
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const moveImage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= p.images.length) return;
    const images = [...p.images];
    [images[i], images[j]] = [images[j], images[i]];
    update({ images });
  };

  const payload = useMemo(
    () =>
      JSON.stringify({
        ...p,
        options: p.options.filter((o) => o.name.trim() && o.values.length > 0),
        tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    [p, tagsInput],
  );
  const hasOptions = p.options.length > 0;
  const single = p.variants[0];

  return (
    <ActionForm action={action} onSuccess={() => setDirty(false)}>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card>
            <div className="space-y-4">
              <Input name="title" label={t("products.field.title")} value={p.title} onChange={(e) => update({ title: e.target.value })} required maxLength={255} />
              <Textarea
                label={t("products.field.description")}
                hint={t("products.field.descriptionHint")}
                rows={8}
                value={p.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </div>
          </Card>

          <Card title={t("products.media")}>
            {p.images.length > 0 && (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {p.images.map((img, i) => (
                  <li key={img.url + i} className={cn("overflow-hidden rounded-lg border border-border bg-surface-2", i === 0 && "sm:col-span-2 sm:row-span-2")}>
                    <img src={img.url} alt={img.alt} className="aspect-square w-full object-cover" />
                    <div className="space-y-1 p-2">
                      <input
                        aria-label={t("products.media.alt")}
                        placeholder={t("products.media.alt")}
                        className={cn(inputClass, "py-1 text-xs")}
                        value={img.alt}
                        onChange={(e) => update({ images: p.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)) })}
                      />
                      <div className="flex justify-between text-xs">
                        <span className="flex gap-1">
                          <button type="button" className="rounded px-1.5 hover:bg-surface" onClick={() => moveImage(i, -1)} aria-label="Move left">←</button>
                          <button type="button" className="rounded px-1.5 hover:bg-surface" onClick={() => moveImage(i, 1)} aria-label="Move right">→</button>
                        </span>
                        <button type="button" className="text-danger hover:underline" onClick={() => update({ images: p.images.filter((_, j) => j !== i) })}>
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-4 py-8 text-center text-sm text-muted hover:bg-surface-2">
              <span className="font-medium text-text">{uploading ? t("products.media.uploading", { count: uploading }) : t("products.media.add")}</span>
              <span className="mt-1 text-xs">{t("products.media.hint")}</span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
            </label>
            {uploadError && <p className="mt-2 text-sm text-danger">{uploadError}</p>}
          </Card>

          {!hasOptions && single && (
            <>
              <Card title={t("products.pricing")}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <MoneyInput name="variants.0.price" label={t("products.field.price")} currency={currency} value={single.price} onChange={(v) => setVariant(0, { price: v })} />
                  <MoneyInput name="variants.0.compareAt" label={t("products.field.compareAt")} currency={currency} value={single.compareAt} onChange={(v) => setVariant(0, { compareAt: v })} />
                  <MoneyInput name="variants.0.cost" label={t("products.field.cost")} hint={t("products.field.costHint")} currency={currency} value={single.cost} onChange={(v) => setVariant(0, { cost: v })} />
                </div>
                <Checkbox className="mt-4" label={t("products.field.taxable")} checked={single.taxable} onChange={(e) => setVariant(0, { taxable: e.target.checked })} />
              </Card>
              <Card title={t("products.inventory")}>
                <VariantInventoryFields v={single} onChange={(patch) => setVariant(0, patch)} index={0} />
              </Card>
              <Card title={t("products.shipping")}>
                <VariantShippingFields v={single} onChange={(patch) => setVariant(0, patch)} />
              </Card>
            </>
          )}

          <Card title={t("products.variants")}>
            <OptionsEditor options={p.options} onChange={setOptions} />
            {hasOptions && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-2 font-medium">{t("products.variant")}</th>
                      <th className="px-2 py-2 font-medium">{t("products.field.price")}</th>
                      <th className="px-2 py-2 font-medium">{t("products.field.available")}</th>
                      <th className="px-2 py-2 font-medium">{t("products.field.sku")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map((v, i) => {
                      const key = comboKey([v.option1, v.option2, v.option3]);
                      const open = expanded === key;
                      return (
                        <VariantRow
                          key={key}
                          index={i}
                          v={v}
                          label={key}
                          currency={currency}
                          open={open}
                          onToggle={() => setExpanded(open ? null : key)}
                          onChange={(patch) => setVariant(i, patch)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={t("products.seo")}>
            <div className="space-y-4">
              <Input label={t("products.field.seoTitle")} maxLength={70} value={p.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} hint={`${p.seoTitle.length}/70`} />
              <Textarea label={t("products.field.seoDescription")} rows={3} maxLength={320} value={p.seoDescription} onChange={(e) => update({ seoDescription: e.target.value })} hint={`${p.seoDescription.length}/320`} />
              <Input label={t("products.field.handle")} value={p.handle} onChange={(e) => update({ handle: e.target.value })} hint={storefrontUrl ? `${storefrontUrl}/products/${p.handle || "…"}` : undefined} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title={t("common.status")}>
            <Select value={p.status} onChange={(e) => update({ status: e.target.value as EditorProduct["status"] })} aria-label={t("common.status")}>
              <option value="ACTIVE">{t("products.status.ACTIVE")}</option>
              <option value="DRAFT">{t("products.status.DRAFT")}</option>
              <option value="ARCHIVED">{t("products.status.ARCHIVED")}</option>
            </Select>
            <p className="mt-2 text-xs text-muted">{t(`products.statusHint.${p.status}`)}</p>
          </Card>
          <Card title={t("products.organization")}>
            <div className="space-y-4">
              <Input label={t("products.field.vendor")} value={p.vendor} onChange={(e) => update({ vendor: e.target.value })} />
              <Input label={t("products.field.type")} value={p.productType} onChange={(e) => update({ productType: e.target.value })} />
              <Input
                label={t("products.field.tags")}
                hint={t("products.field.tagsHint")}
                value={tagsInput}
                onChange={(e) => {
                  setTagsInput(e.target.value);
                  setDirty(true);
                }}
              />
              {collections.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">{t("nav.collections")}</legend>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {collections.map((c) => (
                      <Checkbox
                        key={c.id}
                        label={c.title}
                        checked={p.collectionIds.includes(c.id)}
                        onChange={(e) =>
                          update({ collectionIds: e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id) })
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </Card>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-end gap-3 border-t border-border bg-bg/90 py-3 backdrop-blur">
        {dirty && <span className="mr-auto text-sm text-muted">{t("products.unsaved")}</span>}
        <SubmitButton pendingLabel={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function MoneyInput({ name, label, hint, currency, value, onChange }: { name: string; label: string; hint?: string; currency: string; value: string; onChange: (v: string) => void }) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted">{currency}</span>
        <input inputMode="decimal" className={cn(inputClass, "pl-12", error && "border-danger")} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" aria-invalid={!!error || undefined} />
      </div>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function VariantInventoryFields({ v, onChange, index }: { v: EditorVariant; onChange: (p: Partial<EditorVariant>) => void; index: number }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("products.field.sku")} value={v.sku} onChange={(e) => onChange({ sku: e.target.value })} name={`variants.${index}.sku`} />
        <Input label={t("products.field.barcode")} value={v.barcode} onChange={(e) => onChange({ barcode: e.target.value })} />
      </div>
      <Checkbox label={t("products.field.trackInventory")} checked={v.trackInventory} onChange={(e) => onChange({ trackInventory: e.target.checked })} />
      {v.trackInventory && (
        <>
          <Input type="number" label={t("products.field.available")} value={String(v.inventoryQty)} onChange={(e) => onChange({ inventoryQty: parseInt(e.target.value || "0", 10) || 0 })} className="max-w-40" />
          <Checkbox label={t("products.field.allowBackorder")} checked={v.allowBackorder} onChange={(e) => onChange({ allowBackorder: e.target.checked })} />
        </>
      )}
    </div>
  );
}

function VariantShippingFields({ v, onChange }: { v: EditorVariant; onChange: (p: Partial<EditorVariant>) => void }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <Checkbox label={t("products.field.requiresShipping")} checked={v.requiresShipping} onChange={(e) => onChange({ requiresShipping: e.target.checked })} />
      {v.requiresShipping && (
        <Input type="number" min={0} label={t("products.field.weight")} value={String(v.weightGrams)} onChange={(e) => onChange({ weightGrams: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} className="max-w-40" />
      )}
    </div>
  );
}

function VariantRow({ index, v, label, currency, open, onToggle, onChange }: {
  index: number; v: EditorVariant; label: string; currency: string; open: boolean; onToggle: () => void; onChange: (p: Partial<EditorVariant>) => void;
}) {
  const t = useT();
  const priceError = useFieldError(`variants.${index}.price`);
  return (
    <>
      <tr className="border-t border-border">
        <td className="whitespace-nowrap py-2 pr-2 font-medium">{label}</td>
        <td className="px-2 py-2">
          <div className="relative w-32">
            <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] text-muted">{currency}</span>
            <input inputMode="decimal" aria-label={`${label} ${t("products.field.price")}`} className={cn(inputClass, "py-1.5 pl-10", priceError && "border-danger")} value={v.price} onChange={(e) => onChange({ price: e.target.value })} />
          </div>
        </td>
        <td className="px-2 py-2">
          <input type="number" aria-label={`${label} ${t("products.field.available")}`} disabled={!v.trackInventory} className={cn(inputClass, "w-24 py-1.5")} value={v.trackInventory ? v.inventoryQty : ""} onChange={(e) => onChange({ inventoryQty: parseInt(e.target.value || "0", 10) || 0 })} />
        </td>
        <td className="px-2 py-2">
          <input aria-label={`${label} ${t("products.field.sku")}`} className={cn(inputClass, "w-32 py-1.5")} value={v.sku} onChange={(e) => onChange({ sku: e.target.value })} />
        </td>
        <td className="py-2 pl-2 text-right">
          <button type="button" className="text-sm text-muted hover:text-text" onClick={onToggle} aria-expanded={open}>
            {open ? t("products.variant.less") : t("products.variant.more")}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="pb-4">
            <div className="grid gap-4 rounded-lg bg-surface-2 p-4 sm:grid-cols-2">
              <MoneyInput name={`variants.${index}.compareAt`} label={t("products.field.compareAt")} currency={currency} value={v.compareAt} onChange={(x) => onChange({ compareAt: x })} />
              <MoneyInput name={`variants.${index}.cost`} label={t("products.field.cost")} currency={currency} value={v.cost} onChange={(x) => onChange({ cost: x })} />
              <Input label={t("products.field.barcode")} value={v.barcode} onChange={(e) => onChange({ barcode: e.target.value })} />
              <Input type="number" min={0} label={t("products.field.weight")} value={String(v.weightGrams)} onChange={(e) => onChange({ weightGrams: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} />
              <Checkbox label={t("products.field.trackInventory")} checked={v.trackInventory} onChange={(e) => onChange({ trackInventory: e.target.checked })} />
              <Checkbox label={t("products.field.allowBackorder")} checked={v.allowBackorder} onChange={(e) => onChange({ allowBackorder: e.target.checked })} />
              <Checkbox label={t("products.field.requiresShipping")} checked={v.requiresShipping} onChange={(e) => onChange({ requiresShipping: e.target.checked })} />
              <Checkbox label={t("products.field.taxable")} checked={v.taxable} onChange={(e) => onChange({ taxable: e.target.checked })} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OptionsEditor({ options, onChange }: { options: OptionDef[]; onChange: (o: OptionDef[]) => void }) {
  const t = useT();
  const [drafts, setDrafts] = useState<string[]>(options.map(() => ""));
  const optionsError = useFieldError("options");

  const addValue = (i: number) => {
    const value = (drafts[i] ?? "").trim();
    if (!value || options[i].values.some((v) => v.toLowerCase() === value.toLowerCase())) return;
    onChange(options.map((o, j) => (j === i ? { ...o, values: [...o.values, value] } : o)));
    setDrafts((d) => d.map((x, j) => (j === i ? "" : x)));
  };

  return (
    <div className="space-y-4">
      {options.length === 0 && <p className="text-sm text-muted">{t("products.options.empty")}</p>}
      {options.map((o, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <div className="flex items-end gap-2">
            <Input
              wrapperClassName="flex-1"
              label={t("products.options.name")}
              placeholder={t("products.options.namePlaceholder")}
              value={o.name}
              onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <Button variant="ghost" size="sm" className="mb-1 text-danger" onClick={() => { onChange(options.filter((_, j) => j !== i)); setDrafts((d) => d.filter((_, j) => j !== i)); }}>
              {t("common.delete")}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.values.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-sm">
                {v}
                <button type="button" aria-label={`${t("common.delete")} ${v}`} className="text-muted hover:text-danger" onClick={() => onChange(options.map((x, j) => (j === i ? { ...x, values: x.values.filter((y) => y !== v) } : x)))}>
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className={cn(inputClass, "flex-1")}
              placeholder={t("products.options.valuePlaceholder")}
              aria-label={t("products.options.addValue")}
              value={drafts[i] ?? ""}
              onChange={(e) => setDrafts((d) => { const n = [...d]; n[i] = e.target.value; return n; })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addValue(i);
                }
              }}
            />
            <Button variant="secondary" size="sm" className="h-auto" onClick={() => addValue(i)}>{t("common.add")}</Button>
          </div>
        </div>
      ))}
      {optionsError && <p className="text-sm text-danger">{optionsError}</p>}
      {options.length < 3 && (
        <Button variant="secondary" size="sm" onClick={() => { onChange([...options, { name: "", values: [] }]); setDrafts((d) => [...d, ""]); }}>
          + {t("products.options.add")}
        </Button>
      )}
    </div>
  );
}
