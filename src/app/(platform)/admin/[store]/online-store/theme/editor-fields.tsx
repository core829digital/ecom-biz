"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import { inputClass } from "@/components/ui/fields";
import { isHex } from "@/lib/palette";

export type UploadImage = (fd: FormData) => Promise<{ url?: string; error?: string }>;

/** Compact labelled field used throughout the editor sidebar. */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextField({ label, value, onChange, max, placeholder, multiline, rows = 3, hint }: {
  label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; multiline?: boolean; rows?: number; hint?: ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => multiline
        ? <textarea id={id} rows={rows} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "resize-y")} />
        : <input id={id} maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />}
    </Field>
  );
}

export function SelectField<V extends string | number>({ label, value, onChange, options }: {
  label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string }[];
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select id={id} value={String(value)} onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)} className={cn(inputClass, "pr-8")}>
          {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

/** Pill-style segmented control with a sliding indicator. */
export function Segmented<V extends string | number>({ label, value, onChange, options, hideLabel }: {
  label: string; hideLabel?: boolean; value: V; onChange: (v: V) => void; options: { value: V; label: ReactNode; title?: string }[];
}) {
  const group = useId();
  return (
    <div>
      {!hideLabel && <p className="mb-1 text-xs font-medium text-muted">{label}</p>}
      <div role="radiogroup" aria-label={label} className="relative flex rounded-lg bg-surface-2 p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button key={String(o.value)} type="button" role="radio" aria-checked={active} title={o.title} onClick={() => onChange(o.value)}
              className={cn("relative z-0 flex h-8 flex-1 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors", active ? "text-text" : "text-muted hover:text-text")}>
              {active && <motion.span layoutId={`seg-${group}`} className="absolute inset-0 -z-10 rounded-md bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", checked ? "bg-accent" : "bg-surface-3")}>
      <motion.span layout transition={{ type: "spring", stiffness: 600, damping: 35 }} className={cn("size-4 rounded-full bg-white shadow", checked ? "ml-[18px]" : "ml-0.5")} />
    </button>
  );
}

export function ColorField({ label, value, onChange, warning }: { label: string; value: string; onChange: (v: string) => void; warning?: ReactNode }) {
  const [draft, setDraft] = useState(value);
  const shown = draft.toLowerCase() === value.toLowerCase() || !isHex(draft) ? draft : value;
  return (
    <Field label={label} hint={warning}>
      {(id) => (
        <div className="flex items-center gap-2">
          <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-border shadow-inner" style={{ background: isHex(value) ? value : "#000" }}>
            <input type="color" aria-label={label} value={isHex(value) ? value : "#000000"} onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }} className="absolute inset-0 size-full cursor-pointer opacity-0" />
          </span>
          <input id={id} value={shown} spellCheck={false} maxLength={7}
            onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`; setDraft(v); if (isHex(v)) onChange(v.toLowerCase()); }}
            onBlur={() => setDraft(value)}
            className={cn(inputClass, "h-9 font-mono uppercase", !isHex(shown) && "border-danger")} />
        </div>
      )}
    </Field>
  );
}

export function ImageField({ label, value, onChange, uploadImage, aspect = "wide" }: {
  label: string; value: string; onChange: (v: string) => void; uploadImage: UploadImage; aspect?: "wide" | "logo";
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", f);
    const res = await uploadImage(fd).catch(() => ({ error: t("upload.failed") }) as { url?: string; error?: string });
    setBusy(false);
    if (res.url) onChange(res.url);
    else setError(res.error ?? t("upload.failed"));
  };
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
        className={cn("group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-2 text-xs text-muted transition-colors hover:border-text hover:text-text", aspect === "wide" ? "aspect-[16/9]" : "h-20")}
      >
        {value ? <img src={value} alt="" className={cn("size-full", aspect === "wide" ? "object-cover" : "object-contain p-2")} /> : <span>{busy ? t("common.saving") : t("editor.image.drop")}</span>}
        {value && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">{busy ? "…" : t("collections.image.replace")}</span>}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {value && <button type="button" onClick={() => onChange("")} className="mt-1 text-xs text-danger hover:underline">{t("common.delete")}</button>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Collapsible group in the inspector. */
export function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-border last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
        {title}
        <PlusMinus />
      </summary>
      <div className="space-y-4 px-4 pb-5">{children}</div>
    </details>
  );
}

/** Plus that turns into a minus by rotating its vertical bar away (open state of a <details>). */
export function PlusMinus({ className }: { className?: string }) {
  return (
    <span className={cn("relative size-3 shrink-0 text-muted", className)} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded bg-current" />
      <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded bg-current transition-transform duration-300 ease-out group-open:rotate-90 group-open:scale-y-0" />
    </span>
  );
}
