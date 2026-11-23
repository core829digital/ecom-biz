"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton, useFieldError } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { contrastText, THEME_PRESETS, type Theme } from "@/lib/theme";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ActionState } from "@/lib/action";

export function ThemeEditor({
  initial,
  storeName,
  fonts,
  collections,
  action,
  uploadImage,
}: {
  initial: Theme;
  storeName: string;
  fonts: { value: string; label: string }[];
  collections: { id: string; title: string }[];
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  uploadImage: (fd: FormData) => Promise<{ url?: string; error?: string }>;
}) {
  const t = useT();
  const [th, setTh] = useState<Theme>(initial);
  const update = (patch: Partial<Theme>) => setTh((p) => ({ ...p, ...patch }));
  const payload = useMemo(() => JSON.stringify(th), [th]);

  return (
    <ActionForm action={action}>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title={t("theme.presets")}>
            <p className="mb-4 text-sm text-muted">{t("theme.presetsHint")}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {THEME_PRESETS.map((preset) => {
                const active = th.primaryColor === preset.primaryColor && th.backgroundColor === preset.backgroundColor && th.textColor === preset.textColor;
                return (
                  <li key={preset.id}>
                    <motion.button
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => update({ primaryColor: preset.primaryColor, backgroundColor: preset.backgroundColor, textColor: preset.textColor, font: preset.font })}
                      aria-pressed={active}
                      className={`relative w-full overflow-hidden rounded-xl border text-left transition-shadow hover:shadow-elevated ${active ? "border-accent ring-1 ring-accent" : "border-border"}`}
                    >
                      <span className="block p-3" style={{ background: preset.backgroundColor, color: preset.textColor }}>
                        <span className="block h-2 w-10 rounded-full" style={{ background: preset.textColor, opacity: 0.85 }} />
                        <span className="mt-1.5 block h-1.5 w-16 rounded-full" style={{ background: preset.textColor, opacity: 0.35 }} />
                        <span className="mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: preset.primaryColor, color: contrastText(preset.primaryColor) }}>Shop</span>
                      </span>
                      <span className="flex items-center justify-between border-t border-border bg-surface px-3 py-2 text-xs font-medium">
                        {preset.name}
                        {active && <Check className="size-3.5" aria-hidden />}
                      </span>
                    </motion.button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title={t("theme.brand")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImageField label={t("theme.logo")} value={th.logoUrl} onChange={(logoUrl) => update({ logoUrl })} uploadImage={uploadImage} name="logoUrl" />
              <ImageField label={t("theme.favicon")} value={th.faviconUrl} onChange={(faviconUrl) => update({ faviconUrl })} uploadImage={uploadImage} name="faviconUrl" />
            </div>
            {th.logoUrl && (
              <Input className="mt-4 max-w-40" wrapperClassName="mt-4" type="number" min={16} max={120} label={t("theme.logoHeight")} value={String(th.logoHeight)} onChange={(e) => update({ logoHeight: Math.min(120, Math.max(16, parseInt(e.target.value || "32", 10) || 32)) })} />
            )}
          </Card>
          <Card title={t("theme.colors")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField name="primaryColor" label={t("theme.primary")} value={th.primaryColor} onChange={(primaryColor) => update({ primaryColor })} />
              <ColorField name="backgroundColor" label={t("theme.background")} value={th.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
              <ColorField name="textColor" label={t("theme.text")} value={th.textColor} onChange={(textColor) => update({ textColor })} />
            </div>
            <Select wrapperClassName="mt-4" label={t("theme.font")} value={th.font} onChange={(e) => update({ font: e.target.value as Theme["font"] })}>
              {fonts.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Card>
          <Card title={t("theme.announcement")}>
            <Input label={t("theme.announcementText")} maxLength={200} value={th.announcement} onChange={(e) => update({ announcement: e.target.value })} hint={t("theme.announcementHint")} />
          </Card>
          <Card title={t("theme.hero")}>
            <div className="space-y-4">
              <Input label={t("theme.heroTitle")} maxLength={120} value={th.heroTitle} onChange={(e) => update({ heroTitle: e.target.value })} />
              <Textarea label={t("theme.heroSubtitle")} rows={2} maxLength={300} value={th.heroSubtitle} onChange={(e) => update({ heroSubtitle: e.target.value })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label={t("theme.heroCta")} maxLength={40} value={th.heroCtaLabel} onChange={(e) => update({ heroCtaLabel: e.target.value })} />
                <Input label={t("theme.heroCtaUrl")} value={th.heroCtaUrl} onChange={(e) => update({ heroCtaUrl: e.target.value })} />
              </div>
              <ImageField label={t("theme.heroImage")} value={th.heroImageUrl} onChange={(heroImageUrl) => update({ heroImageUrl })} uploadImage={uploadImage} name="heroImageUrl" wide />
            </div>
          </Card>
          <Card title={t("theme.featured")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select name="featuredCollectionId" label={t("theme.featuredCollection")} value={th.featuredCollectionId} onChange={(e) => update({ featuredCollectionId: e.target.value })}>
                <option value="">{t("theme.newestProducts")}</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </Select>
              <Input label={t("theme.featuredTitle")} maxLength={80} value={th.featuredTitle} onChange={(e) => update({ featuredTitle: e.target.value })} />
            </div>
          </Card>
          <Card title={t("theme.footer")}>
            <div className="space-y-4">
              <Textarea label={t("theme.footerText")} rows={3} maxLength={500} value={th.footerText} onChange={(e) => update({ footerText: e.target.value })} />
              <div className="grid gap-4 sm:grid-cols-2">
                {(["instagram", "facebook", "tiktok", "youtube"] as const).map((k) => (
                  <Input key={k} label={k[0].toUpperCase() + k.slice(1)} placeholder="https://" value={th.social[k]} onChange={(e) => update({ social: { ...th.social, [k]: e.target.value } })} />
                ))}
              </div>
            </div>
          </Card>
        </div>
        <div>
          <div className="sticky top-6">
            <p className="mb-2 text-sm font-medium">{t("theme.preview")}</p>
            <div className="overflow-hidden rounded-xl border border-border shadow-sm" style={{ background: th.backgroundColor, color: th.textColor }}>
              {th.announcement && <div className="px-3 py-1.5 text-center text-xs" style={{ background: th.primaryColor, color: contrastText(th.primaryColor) }}>{th.announcement}</div>}
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: th.textColor + "22" }}>
                {th.logoUrl ? <img src={th.logoUrl} alt="" style={{ height: Math.min(th.logoHeight, 32) }} /> : <span className="font-semibold">{storeName}</span>}
                <span className="text-xs opacity-70">☰</span>
              </div>
              <div className="relative px-4 py-10">
                {th.heroImageUrl && <img src={th.heroImageUrl} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
                <div className="relative">
                  <p className="text-lg font-semibold">{th.heroTitle || storeName}</p>
                  {th.heroSubtitle && <p className="mt-1 text-xs opacity-80">{th.heroSubtitle}</p>}
                  <span className="mt-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium" style={{ background: th.primaryColor, color: contrastText(th.primaryColor) }}>
                    {th.heroCtaLabel || "Shop now"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 mt-6 flex justify-end border-t border-border bg-bg/90 py-3 backdrop-blur">
        <SubmitButton pendingLabel={t("common.saving")}>{t("common.save")}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function ColorField({ name, label, value, onChange }: { name: string; label: string; value: string; onChange: (v: string) => void }) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded border border-border bg-surface" aria-label={label} />
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-surface px-2 font-mono text-sm" aria-label={`${label} hex`} />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function ImageField({ label, value, onChange, uploadImage, name, wide }: {
  label: string; value: string; onChange: (v: string) => void; uploadImage: (fd: FormData) => Promise<{ url?: string; error?: string }>; name: string; wide?: boolean;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fieldError = useFieldError(name);
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      {value && <img src={value} alt="" className={`mb-2 rounded-lg border border-border object-contain ${wide ? "aspect-[3/1] w-full object-cover" : "h-16"}`} />}
      <div className="flex gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-2">
          {busy ? "…" : value ? t("collections.image.replace") : t("collections.image.add")}
          <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setError(null);
            const fd = new FormData();
            fd.append("file", f);
            const res = await uploadImage(fd);
            setBusy(false);
            if (res.url) onChange(res.url);
            else setError(res.error ?? t("upload.failed"));
          }} />
        </label>
        {value && <Button variant="ghost" size="sm" className="text-danger" onClick={() => onChange("")}>{t("common.delete")}</Button>}
      </div>
      {(error || fieldError) && <p className="mt-1 text-xs text-danger">{error || fieldError}</p>}
    </div>
  );
}
