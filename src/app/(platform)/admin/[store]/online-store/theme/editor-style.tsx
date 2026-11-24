"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";
import { contrastText, THEME_PRESETS, type Theme } from "@/lib/theme";
import { contrastGrade, contrastRatio, dominantColors, fixContrast, generatePalettes, isHex, type Palette } from "@/lib/palette";
import { ColorField, Group, ImageField, Segmented, SelectField, TextField, type UploadImage } from "./editor-fields";

type Patch = (p: Partial<Theme>) => void;

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="flex">
      {colors.map((c, i) => <span key={i} className="-ml-1 size-5 rounded-full border-2 border-surface first:ml-0" style={{ background: c }} />)}
    </span>
  );
}

export function StylePanel({ theme, update, fonts, uploadImage }: { theme: Theme; update: Patch; fonts: { value: string; label: string }[]; uploadImage: UploadImage }) {
  const t = useT();
  const tk = (k: string, v?: Record<string, string | number>) => t(k as MessageKey, v);
  return (
    <div>
      <Group title={tk("theme.presets")}>
        <ul className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((p) => {
            const active = theme.primaryColor === p.primaryColor && theme.backgroundColor === p.backgroundColor && theme.textColor === p.textColor;
            return (
              <li key={p.id}>
                <motion.button type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} aria-pressed={active}
                  onClick={() => update({ primaryColor: p.primaryColor, accentColor: p.accentColor, backgroundColor: p.backgroundColor, textColor: p.textColor, font: p.font, headingFont: p.headingFont, buttonShape: p.buttonShape, cornerStyle: p.cornerStyle })}
                  className={cn("w-full overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md", active ? "border-text ring-1 ring-text" : "border-border")}>
                  <span className="block p-2.5" style={{ background: p.backgroundColor, color: p.textColor }}>
                    <span className="block text-sm font-semibold leading-none">Aa</span>
                    <span className="mt-2 inline-block px-2 py-0.5 text-[9px] font-semibold" style={{ background: p.primaryColor, color: contrastText(p.primaryColor), borderRadius: p.buttonShape === "pill" ? 999 : p.buttonShape === "rounded" ? 5 : 0 }}>Shop</span>
                    <span className="ml-1 inline-block size-2 rounded-full align-middle" style={{ background: p.accentColor }} />
                  </span>
                  <span className="flex items-center justify-between border-t border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium">
                    {p.name}{active && <Check className="size-3" aria-hidden />}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title={tk("editor.palette.generate")}>
        <PaletteGenerator theme={theme} update={update} />
      </Group>

      <Group title={tk("theme.colors")}>
        <ColorRow label={tk("theme.primary")} value={theme.primaryColor} onChange={(primaryColor) => update({ primaryColor })}
          check={{ ratio: contrastRatio(contrastText(theme.primaryColor), theme.primaryColor), min: 4.5 }} />
        <ColorRow label={tk("editor.color.accent")} value={theme.accentColor} onChange={(accentColor) => update({ accentColor })}
          check={{ ratio: contrastRatio(theme.accentColor, theme.backgroundColor), min: 3, fix: () => update({ accentColor: fixContrast(theme.accentColor, theme.backgroundColor, 3) }) }} />
        <ColorRow label={tk("theme.background")} value={theme.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} />
        <ColorRow label={tk("theme.text")} value={theme.textColor} onChange={(textColor) => update({ textColor })}
          check={{ ratio: contrastRatio(theme.textColor, theme.backgroundColor), min: 4.5, fix: () => update({ textColor: fixContrast(theme.textColor, theme.backgroundColor, 7) }) }} />
      </Group>

      <Group title={tk("editor.typography")}>
        <SelectField label={tk("editor.font.body")} value={theme.font} onChange={(font) => update({ font: font as Theme["font"] })} options={fonts} />
        <SelectField label={tk("editor.font.heading")} value={theme.headingFont} onChange={(headingFont) => update({ headingFont: headingFont as Theme["headingFont"] })}
          options={[{ value: "same", label: tk("editor.font.same") }, ...fonts]} />
      </Group>

      <Group title={tk("editor.shapes")}>
        <Segmented label={tk("editor.shape.buttons")} value={theme.buttonShape} onChange={(buttonShape) => update({ buttonShape })}
          options={(["pill", "rounded", "square"] as const).map((v) => ({ value: v, label: <ShapeIcon shape={v} />, title: tk(`editor.shape.${v}`) }))} />
        <Segmented label={tk("editor.shape.corners")} value={theme.cornerStyle} onChange={(cornerStyle) => update({ cornerStyle })}
          options={(["sharp", "soft", "round"] as const).map((v) => ({ value: v, label: tk(`editor.corner.${v}`) }))} />
      </Group>

      <Group title={tk("theme.brand")} defaultOpen={false}>
        <ImageField label={tk("theme.logo")} value={theme.logoUrl} onChange={(logoUrl) => update({ logoUrl })} uploadImage={uploadImage} aspect="logo" />
        {theme.logoUrl && (
          <div>
            <div className="mb-1 flex justify-between text-xs font-medium text-muted"><span>{tk("theme.logoHeight")}</span><span className="tabular-nums">{theme.logoHeight}px</span></div>
            <input type="range" min={16} max={120} value={theme.logoHeight} onChange={(e) => update({ logoHeight: Number(e.target.value) })} className="w-full" aria-label={tk("theme.logoHeight")} />
          </div>
        )}
        <ImageField label={tk("theme.favicon")} value={theme.faviconUrl} onChange={(faviconUrl) => update({ faviconUrl })} uploadImage={uploadImage} aspect="logo" />
      </Group>
    </div>
  );
}

function ShapeIcon({ shape }: { shape: Theme["buttonShape"] }) {
  return <span className="inline-block h-3.5 w-7 border-[1.5px] border-current" style={{ borderRadius: shape === "pill" ? 999 : shape === "rounded" ? 4 : 0 }} />;
}

function ColorRow({ label, value, onChange, check }: { label: string; value: string; onChange: (v: string) => void; check?: { ratio: number; min: number; fix?: () => void } }) {
  const t = useT();
  const grade = check ? contrastGrade(check.ratio) : null;
  const bad = check && check.ratio < check.min;
  return (
    <ColorField label={label} value={value} onChange={onChange}
      warning={check && (
        <span className={cn("flex items-center gap-2", bad ? "text-danger" : "text-muted")}>
          <span className="tabular-nums">{t("editor.contrast", { ratio: check.ratio.toFixed(1) })} · {grade === "fail" ? t("editor.contrast.fail") : grade}</span>
          {bad && check.fix && <button type="button" onClick={check.fix} className="font-medium underline">{t("editor.contrast.fix")}</button>}
        </span>
      )} />
  );
}

function PaletteGenerator({ theme, update }: { theme: Theme; update: Patch }) {
  const t = useT();
  const [seed, setSeed] = useState(theme.primaryColor);
  const [fromLogo, setFromLogo] = useState<string[] | null>(null);
  const [logoError, setLogoError] = useState(false);
  const palettes = isHex(seed) ? generatePalettes(seed) : [];
  const apply = (p: Palette) => update({ primaryColor: p.primaryColor, accentColor: p.accentColor, backgroundColor: p.backgroundColor, textColor: p.textColor });

  const readLogo = () => {
    setLogoError(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        const scale = Math.min(1, 96 / Math.max(img.width, img.height));
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const colors = dominantColors(ctx.getImageData(0, 0, c.width, c.height).data, 4);
        setFromLogo(colors);
        if (colors[0]) setSeed(colors[0]);
        else setLogoError(true);
      } catch {
        setLogoError(true);
      }
    };
    img.onerror = () => setLogoError(true);
    img.src = theme.logoUrl;
  };

  return (
    <>
      <p className="text-xs text-muted">{t("editor.palette.hint")}</p>
      <div className="flex items-end gap-2">
        <div className="flex-1"><ColorField label={t("editor.palette.seed")} value={seed} onChange={setSeed} /></div>
        {theme.logoUrl && (
          <button type="button" onClick={readLogo} className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-surface-2">
            <Wand2 className="size-3.5" aria-hidden />{t("editor.palette.fromLogo")}
          </button>
        )}
      </div>
      {logoError && <p className="text-xs text-danger">{t("editor.palette.logoError")}</p>}
      {fromLogo && fromLogo.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {fromLogo.map((c) => (
            <button key={c} type="button" onClick={() => setSeed(c)} title={c} aria-label={c} className={cn("size-7 rounded-full border-2 transition-transform hover:scale-110", seed === c ? "border-text" : "border-surface")} style={{ background: c }} />
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {palettes.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => apply(p)} className="group flex w-full items-center gap-3 rounded-lg border border-border p-2 text-left transition-colors hover:border-text">
              <span className="flex h-9 w-16 shrink-0 items-center justify-center rounded-md text-xs font-semibold" style={{ background: p.backgroundColor, color: p.textColor, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.08)" }}>
                Aa <span className="ml-1 inline-block size-2.5 rounded-full" style={{ background: p.primaryColor }} />
              </span>
              <span className="min-w-0 flex-1 text-xs font-medium">{t(`editor.palette.${p.id}` as MessageKey)}</span>
              <Swatches colors={[p.primaryColor, p.accentColor, p.backgroundColor, p.textColor]} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SettingsPanel({ theme, update }: { theme: Theme; update: Patch }) {
  const t = useT();
  return (
    <div>
      <Group title={t("theme.announcement")}>
        <TextField label={t("theme.announcementText")} value={theme.announcement} max={200} onChange={(announcement) => update({ announcement })} hint={t("theme.announcementHint")} />
      </Group>
      <Group title={t("theme.footer")}>
        <TextField label={t("theme.footerText")} value={theme.footerText} max={500} multiline onChange={(footerText) => update({ footerText })} />
        {(["instagram", "facebook", "tiktok", "youtube"] as const).map((k) => (
          <TextField key={k} label={k[0].toUpperCase() + k.slice(1)} value={theme.social[k]} max={200} placeholder="https://" onChange={(v) => update({ social: { ...theme.social, [k]: v } })} />
        ))}
      </Group>
    </div>
  );
}
