"use client";

import { useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "framer-motion";
import {
  ChevronLeft, Copy, Eye, EyeOff, GripVertical, HelpCircle, Image as ImageIcon, LayoutGrid, LayoutTemplate, Mail, Megaphone,
  Newspaper, Plus, Quote, ShoppingBag, Sparkles, SquareStack, Trash2, Type, Columns2, Heading, Text, MousePointerClick, Package, MoveVertical, Minus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/en";
import {
  BLOCK_TYPES, MAX_BLOCKS, MAX_SECTIONS, SECTION_TYPES, blankBlock, blankSection, newSectionId,
  REVEALS, type Block, type BlockType, type Section, type SectionOf, type SectionType,
} from "@/lib/theme-sections";
import type { ThemeCapabilities } from "@/lib/theme-capabilities";
import { Lock } from "lucide-react";
import { Group, ImageField, PlusMinus, Segmented, SelectField, TextField, Toggle, type UploadImage } from "./editor-fields";

export const SECTION_ICONS: Record<SectionType, typeof Type> = {
  hero: LayoutTemplate, "featured-products": ShoppingBag, collections: LayoutGrid, "image-text": Columns2, "rich-text": Type,
  features: Sparkles, testimonials: Quote, faq: HelpCircle, banner: Megaphone, newsletter: Mail, "blog-posts": Newspaper, container: SquareStack,
};
const BLOCK_ICONS: Record<BlockType, typeof Type> = {
  heading: Heading, text: Text, image: ImageIcon, button: MousePointerClick, product: Package, spacer: MoveVertical, divider: Minus,
};

export type Catalog = { collections: { id: string; title: string }[]; products: { id: string; title: string }[] };
type Tk = (k: string, v?: Record<string, string | number>) => string;

function useTk(): Tk {
  const t = useT();
  return (k, v) => t(k as MessageKey, v);
}

/** Title shown in the list: the merchant's own heading when there is one. */
export function sectionLabel(s: Section, tk: Tk) {
  const own = "title" in s && s.title ? s.title : s.type === "container" ? (s.blocks.find((b) => b.type === "heading" && b.text) as { text?: string } | undefined)?.text : "";
  return { kind: tk(`editor.section.${s.type}`), own: own || "" };
}

export function SectionList({ sections, selected, onSelect, onChange }: {
  sections: Section[]; selected: string | null; onSelect: (id: string) => void; onChange: (s: Section[]) => void;
}) {
  const tk = useTk();
  const [adding, setAdding] = useState(false);
  const add = (type: SectionType) => {
    const s = blankSection(type);
    onChange([...sections, s]);
    setAdding(false);
    onSelect(s.id);
  };
  return (
    <div className="p-3">
      <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{tk("editor.homepage")}</p>
      <Reorder.Group axis="y" values={sections} onReorder={onChange} className="space-y-1">
        {sections.map((s) => (
          <SectionRow key={s.id} section={s} active={selected === s.id} onSelect={() => onSelect(s.id)}
            onToggle={(enabled) => onChange(sections.map((x) => (x.id === s.id ? { ...x, enabled } : x)))} />
        ))}
      </Reorder.Group>
      {sections.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">{tk("editor.noSections")}</p>}
      <AnimatePresence initial={false} mode="wait">
        {adding ? (
          <motion.div key="picker" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="mt-3 rounded-xl border border-border bg-surface p-2 shadow-sm">
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-sm font-semibold">{tk("editor.addSection")}</p>
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-muted hover:text-text">{tk("common.cancel")}</button>
            </div>
            <ul className="mt-1 grid grid-cols-2 gap-1.5">
              {SECTION_TYPES.map((type) => {
                const Icon = SECTION_ICONS[type];
                return (
                  <li key={type}>
                    <button type="button" onClick={() => add(type)} className="group flex w-full flex-col items-start gap-1.5 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-surface-2">
                      <Icon className="size-4 text-muted transition-colors group-hover:text-text" aria-hidden />
                      <span className="text-xs font-medium leading-tight">{tk(`editor.section.${type}`)}</span>
                      <span className="text-[11px] leading-snug text-muted">{tk(`editor.sectionHint.${type}`)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.button key="add" type="button" disabled={sections.length >= MAX_SECTIONS} onClick={() => setAdding(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="group mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm font-medium text-muted transition-colors hover:border-text hover:text-text disabled:opacity-50">
            <Plus className="size-4 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
            {tk("editor.addSection")}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionRow({ section: s, active, onSelect, onToggle }: { section: Section; active: boolean; onSelect: () => void; onToggle: (v: boolean) => void }) {
  const tk = useTk();
  const controls = useDragControls();
  const Icon = SECTION_ICONS[s.type];
  const { kind, own } = sectionLabel(s, tk);
  return (
    <Reorder.Item value={s} dragListener={false} dragControls={controls} whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgb(0 0 0 / 0.12)" }}
      className={cn("group flex items-center gap-1 rounded-lg border bg-surface pr-2 transition-colors", active ? "border-text" : "border-transparent hover:border-border", !s.enabled && "opacity-55")}>
      <span onPointerDown={(e) => controls.start(e)} className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing" aria-label={tk("editor.drag")}>
        <GripVertical className="size-3.5" aria-hidden />
      </span>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left">
        <Icon className="size-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{own || kind}</span>
          {own && <span className="block truncate text-[11px] text-muted">{kind}</span>}
        </span>
      </button>
      <button type="button" onClick={() => onToggle(!s.enabled)} title={tk(s.enabled ? "editor.hide" : "editor.show")} aria-label={tk(s.enabled ? "editor.hide" : "editor.show")}
        className="flex size-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface-2 hover:text-text focus-visible:opacity-100 group-hover:opacity-100">
        {s.enabled ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
      </button>
    </Reorder.Item>
  );
}

export function SectionInspector({ section, catalog, caps, uploadImage, onChange, onBack, onDuplicate, onDelete }: {
  section: Section; catalog: Catalog; caps: ThemeCapabilities; uploadImage: UploadImage;
  onChange: (s: Section) => void; onBack: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const tk = useTk();
  const Icon = SECTION_ICONS[section.type];
  const set = (patch: Partial<Section>) => onChange({ ...section, ...patch } as Section);
  const style = section.style;
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface/95 px-2 py-2 backdrop-blur">
        <button type="button" onClick={onBack} className="flex size-8 items-center justify-center rounded-md hover:bg-surface-2" aria-label={tk("common.back")}>
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <Icon className="size-4 text-muted" aria-hidden />
        <p className="flex-1 truncate text-sm font-semibold">{tk(`editor.section.${section.type}`)}</p>
        <Toggle checked={section.enabled} onChange={(enabled) => set({ enabled })} label={tk(section.enabled ? "editor.hide" : "editor.show")} />
      </div>
      <Group title={tk("editor.content")}>
        <SectionFields section={section} set={set} catalog={catalog} uploadImage={uploadImage} />
      </Group>
      <Group title={tk("editor.layout")} defaultOpen={section.type === "container"}>
        <Segmented label={tk("editor.style.background")} value={style.background} onChange={(background) => set({ style: { ...style, background } })}
          options={(["default", "muted", "brand", "inverse"] as const).map((v) => ({ value: v, label: tk(`editor.bg.${v}`) }))} />
        {section.type !== "hero" && (
          <Segmented label={tk("editor.style.spacing")} value={style.spacing} onChange={(spacing) => set({ style: { ...style, spacing } })}
            options={(["compact", "normal", "roomy"] as const).map((v) => ({ value: v, label: tk(`editor.spacing.${v}`) }))} />
        )}
        <Segmented label={tk("editor.style.width")} value={style.width} onChange={(width) => set({ style: { ...style, width } })}
          options={(["narrow", "normal", "full"] as const).map((v) => ({ value: v, label: tk(`editor.width.${v}`) }))} />
      </Group>
      <Group title={tk("editor.motion.entrance")} defaultOpen={false}>
        {caps.motion >= 2 ? (
          <SelectField label={tk("editor.motion.entranceLabel")} value={style.reveal} onChange={(reveal) => set({ style: { ...style, reveal } })}
            options={REVEALS.map((v) => ({ value: v, label: tk(`editor.reveal.${v}`) }))} />
        ) : (
          <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted"><Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />{tk("editor.motion.lockedEntrance")}</p>
        )}
      </Group>
      <div className="flex gap-2 p-4">
        <button type="button" onClick={onDuplicate} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm hover:bg-surface-2">
          <Copy className="size-3.5" aria-hidden />{tk("editor.duplicate")}
        </button>
        <button type="button" onClick={onDelete} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm text-danger hover:bg-danger-bg">
          <Trash2 className="size-3.5" aria-hidden />{tk("editor.removeSection")}
        </button>
      </div>
    </div>
  );
}

function SectionFields({ section: s, set, catalog, uploadImage }: { section: Section; set: (p: Partial<Section>) => void; catalog: Catalog; uploadImage: UploadImage }) {
  const tk = useTk();
  const title = "title" in s ? <TextField label={tk("editor.f.title")} value={s.title} max={s.type === "hero" || s.type === "image-text" || s.type === "rich-text" || s.type === "banner" ? 120 : 80} onChange={(title) => set({ title })} /> : null;
  const cta = (label: string, url: string) => (
    <div className="grid grid-cols-2 gap-2">
      <TextField label={tk("editor.f.buttonLabel")} value={label} max={40} onChange={(ctaLabel) => set({ ctaLabel } as Partial<Section>)} />
      <TextField label={tk("editor.f.buttonLink")} value={url} max={500} placeholder="/collections/all" onChange={(ctaUrl) => set({ ctaUrl } as Partial<Section>)} />
    </div>
  );
  switch (s.type) {
    case "hero":
      return (
        <>
          {title}
          <TextField label={tk("editor.f.subtitle")} value={s.subtitle} max={300} multiline rows={2} onChange={(subtitle) => set({ subtitle })} />
          {cta(s.ctaLabel, s.ctaUrl)}
          <ImageField label={tk("editor.f.image")} value={s.imageUrl} onChange={(imageUrl) => set({ imageUrl })} uploadImage={uploadImage} />
          {s.imageUrl && <Range label={tk("editor.f.overlay")} value={s.overlay} min={0} max={80} onChange={(overlay) => set({ overlay })} />}
          <Segmented label={tk("editor.f.height")} value={s.height} onChange={(height) => set({ height })} options={(["small", "medium", "large"] as const).map((v) => ({ value: v, label: tk(`editor.size.${v}`) }))} />
          <AlignField value={s.align} onChange={(align) => set({ align })} />
        </>
      );
    case "featured-products":
      return (
        <>
          {title}
          <SelectField label={tk("theme.featuredCollection")} value={s.collectionId} onChange={(collectionId) => set({ collectionId })}
            options={[{ value: "", label: tk("theme.newestProducts") }, ...catalog.collections.map((c) => ({ value: c.id, label: c.title }))]} />
          <Segmented label={tk("editor.f.count")} value={s.limit} onChange={(limit) => set({ limit })} options={[4, 8, 12].map((v) => ({ value: v as 4 | 8 | 12, label: String(v) }))} />
        </>
      );
    case "collections":
      return <>{title}<Segmented label={tk("editor.f.count")} value={s.limit} onChange={(limit) => set({ limit })} options={[3, 6].map((v) => ({ value: v as 3 | 6, label: String(v) }))} /></>;
    case "blog-posts":
      return <>{title}<Segmented label={tk("editor.f.count")} value={s.limit} onChange={(limit) => set({ limit })} options={[3, 6].map((v) => ({ value: v as 3 | 6, label: String(v) }))} /></>;
    case "image-text":
      return (
        <>
          <ImageField label={tk("editor.f.image")} value={s.imageUrl} onChange={(imageUrl) => set({ imageUrl })} uploadImage={uploadImage} />
          <Segmented label={tk("editor.f.imagePosition")} value={s.imagePosition} onChange={(imagePosition) => set({ imagePosition })} options={(["left", "right"] as const).map((v) => ({ value: v, label: tk(`editor.align.${v}`) }))} />
          {title}
          <TextField label={tk("editor.f.body")} value={s.body} max={1500} multiline rows={5} onChange={(body) => set({ body })} hint={tk("editor.markdownHint")} />
          {cta(s.ctaLabel, s.ctaUrl)}
        </>
      );
    case "rich-text":
      return (
        <>
          {title}
          <TextField label={tk("editor.f.body")} value={s.body} max={3000} multiline rows={7} onChange={(body) => set({ body })} hint={tk("editor.markdownHint")} />
          <AlignField value={s.align} onChange={(align) => set({ align })} />
        </>
      );
    case "banner":
      return <>{title}<TextField label={tk("editor.f.body")} value={s.body} max={300} multiline rows={2} onChange={(body) => set({ body })} />{cta(s.ctaLabel, s.ctaUrl)}</>;
    case "newsletter":
      return <>{title}<TextField label={tk("editor.f.body")} value={s.body} max={300} multiline rows={2} onChange={(body) => set({ body })} hint={tk("editor.newsletterHint")} /></>;
    case "features":
      return (
        <>
          {title}
          <ItemsEditor items={s.items} max={4} blank={{ title: "", body: "" }} onChange={(items) => set({ items })} label={(i, n) => i.title || tk("editor.item", { n })}
            render={(i, up) => <><TextField label={tk("editor.f.title")} value={i.title} max={60} onChange={(title) => up({ title })} /><TextField label={tk("editor.f.body")} value={i.body} max={200} multiline rows={2} onChange={(body) => up({ body })} /></>} />
        </>
      );
    case "testimonials":
      return (
        <>
          {title}
          <ItemsEditor items={s.items} max={6} blank={{ quote: "", author: "" }} onChange={(items) => set({ items })} label={(i, n) => i.author || tk("editor.item", { n })}
            render={(i, up) => <><TextField label={tk("editor.f.quote")} value={i.quote} max={400} multiline rows={3} onChange={(quote) => up({ quote })} /><TextField label={tk("editor.f.author")} value={i.author} max={60} onChange={(author) => up({ author })} /></>} />
        </>
      );
    case "faq":
      return (
        <>
          {title}
          <ItemsEditor items={s.items} max={12} blank={{ q: "", a: "" }} onChange={(items) => set({ items })} label={(i, n) => i.q || tk("editor.item", { n })}
            render={(i, up) => <><TextField label={tk("editor.f.question")} value={i.q} max={200} onChange={(q) => up({ q })} /><TextField label={tk("editor.f.answer")} value={i.a} max={1000} multiline rows={3} onChange={(a) => up({ a })} /></>} />
        </>
      );
    case "container":
      return <ContainerFields section={s} set={set} catalog={catalog} uploadImage={uploadImage} />;
  }
}

function AlignField({ value, onChange }: { value: "left" | "center"; onChange: (v: "left" | "center") => void }) {
  const tk = useTk();
  return <Segmented label={tk("editor.f.align")} value={value} onChange={onChange} options={(["left", "center"] as const).map((v) => ({ value: v, label: tk(`editor.align.${v}`) }))} />;
}

function Range({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-medium text-muted"><span>{label}</span><span className="tabular-nums">{value}%</span></div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label={label} />
    </div>
  );
}

/** Repeatable items (features, testimonials, FAQ) with add / remove / move. */
function ItemsEditor<I extends Record<string, string>>({ items, max, blank, onChange, label, render }: {
  items: I[]; max: number; blank: I; onChange: (items: I[]) => void; label: (i: I, n: number) => string; render: (i: I, update: (p: Partial<I>) => void) => React.ReactNode;
}) {
  const tk = useTk();
  const move = (from: number, to: number) => { const next = [...items]; const [x] = next.splice(from, 1); next.splice(to, 0, x); onChange(next); };
  return (
    <div className="space-y-2">
      {items.map((item, n) => (
        <details key={n} className="group rounded-lg border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{label(item, n + 1)}</span>
            <PlusMinus />
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            {render(item, (p) => onChange(items.map((x, i) => (i === n ? { ...x, ...p } : x))))}
            <div className="flex gap-3 text-xs">
              {n > 0 && <button type="button" onClick={() => move(n, n - 1)} className="text-muted hover:text-text">↑ {tk("editor.moveUp")}</button>}
              {n < items.length - 1 && <button type="button" onClick={() => move(n, n + 1)} className="text-muted hover:text-text">↓ {tk("editor.moveDown")}</button>}
              <button type="button" onClick={() => onChange(items.filter((_, i) => i !== n))} className="ml-auto text-danger hover:underline">{tk("common.delete")}</button>
            </div>
          </div>
        </details>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, { ...blank }])} className="group flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-xs font-medium text-muted hover:border-text hover:text-text">
          <Plus className="size-3.5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />{tk("editor.addItem")}
        </button>
      )}
    </div>
  );
}

function ContainerFields({ section: s, set, catalog, uploadImage }: { section: SectionOf<"container">; set: (p: Partial<Section>) => void; catalog: Catalog; uploadImage: UploadImage }) {
  const tk = useTk();
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const blocks = s.blocks;
  const setBlocks = (b: Block[]) => set({ blocks: b } as Partial<Section>);
  const add = (type: BlockType) => {
    const b = blankBlock(type);
    setBlocks([...blocks, b]);
    setOpen(b.id);
    setAdding(false);
  };
  return (
    <>
      <Segmented label={tk("editor.f.columns")} value={s.columns} onChange={(columns) => set({ columns } as Partial<Section>)} options={[1, 2, 3, 4].map((v) => ({ value: v as 1 | 2 | 3 | 4, label: String(v) }))} />
      <div className="grid grid-cols-2 gap-2">
        <AlignField value={s.align} onChange={(align) => set({ align } as Partial<Section>)} />
        <Segmented label={tk("editor.f.verticalAlign")} value={s.verticalAlign} onChange={(verticalAlign) => set({ verticalAlign } as Partial<Section>)} options={(["top", "center"] as const).map((v) => ({ value: v, label: tk(`editor.valign.${v}`) }))} />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">{tk("editor.blocks")}</p>
        <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-1.5">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} open={open === b.id} onOpen={() => setOpen(open === b.id ? null : b.id)}
              onChange={(nb) => setBlocks(blocks.map((x) => (x.id === b.id ? nb : x)))}
              onDuplicate={() => { const i = blocks.indexOf(b); setBlocks([...blocks.slice(0, i + 1), { ...b, id: newSectionId() }, ...blocks.slice(i + 1)]); }}
              onDelete={() => setBlocks(blocks.filter((x) => x.id !== b.id))}
              catalog={catalog} uploadImage={uploadImage} />
          ))}
        </Reorder.Group>
        {adding ? (
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border p-1.5">
            {BLOCK_TYPES.map((type) => {
              const Icon = BLOCK_ICONS[type];
              return (
                <button key={type} type="button" onClick={() => add(type)} className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium hover:bg-surface-2">
                  <Icon className="size-3.5 text-muted" aria-hidden />{tk(`editor.block.${type}`)}
                </button>
              );
            })}
            <button type="button" onClick={() => setAdding(false)} className="col-span-2 py-1 text-xs text-muted hover:text-text">{tk("common.cancel")}</button>
          </div>
        ) : (
          <button type="button" disabled={blocks.length >= MAX_BLOCKS} onClick={() => setAdding(true)} className="group mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong text-xs font-medium text-muted hover:border-text hover:text-text disabled:opacity-50">
            <Plus className="size-3.5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />{tk("editor.addBlock")}
          </button>
        )}
      </div>
    </>
  );
}

function BlockRow({ block: b, open, onOpen, onChange, onDuplicate, onDelete, catalog, uploadImage }: {
  block: Block; open: boolean; onOpen: () => void; onChange: (b: Block) => void; onDuplicate: () => void; onDelete: () => void; catalog: Catalog; uploadImage: UploadImage;
}) {
  const tk = useTk();
  const controls = useDragControls();
  const Icon = BLOCK_ICONS[b.type];
  const up = (p: Partial<Block>) => onChange({ ...b, ...p } as Block);
  const summary = b.type === "heading" || b.type === "text" ? b.text : b.type === "button" ? b.label : b.type === "product" ? catalog.products.find((p) => p.id === b.productId)?.title : "";
  return (
    <Reorder.Item value={b} dragListener={false} dragControls={controls} className="rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1 pr-1">
        <span onPointerDown={(e) => controls.start(e)} className="flex h-9 w-6 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing" aria-label={tk("editor.drag")}>
          <GripVertical className="size-3.5" aria-hidden />
        </span>
        <button type="button" onClick={onOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm">
          <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
          <span className="truncate">{summary || tk(`editor.block.${b.type}`)}</span>
        </button>
        <span className={cn("relative mr-2 size-3 text-muted transition-transform duration-300", open && "rotate-180")} aria-hidden>
          <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded bg-current" />
          <span className={cn("absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded bg-current transition-transform duration-300", open && "scale-y-0")} />
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
            <div className="space-y-3 border-t border-border p-3">
              {b.type === "heading" && <>
                <TextField label={tk("editor.f.text")} value={b.text} max={160} onChange={(text) => up({ text })} />
                <Segmented label={tk("editor.f.size")} value={b.size} onChange={(size) => up({ size })} options={(["sm", "md", "lg", "xl"] as const).map((v) => ({ value: v, label: v.toUpperCase() }))} />
              </>}
              {b.type === "text" && <TextField label={tk("editor.f.text")} value={b.text} max={3000} multiline rows={5} onChange={(text) => up({ text })} hint={tk("editor.markdownHint")} />}
              {b.type === "image" && <>
                <ImageField label={tk("editor.f.image")} value={b.url} onChange={(url) => up({ url })} uploadImage={uploadImage} />
                <TextField label={tk("editor.f.alt")} value={b.alt} max={200} onChange={(alt) => up({ alt })} hint={tk("editor.altHint")} />
                <Segmented label={tk("editor.f.ratio")} value={b.ratio} onChange={(ratio) => up({ ratio })} options={(["auto", "square", "portrait", "landscape"] as const).map((v) => ({ value: v, label: tk(`editor.ratio.${v}`) }))} />
                <TextField label={tk("editor.f.link")} value={b.link} max={500} placeholder="/products/…" onChange={(link) => up({ link })} />
              </>}
              {b.type === "button" && <>
                <TextField label={tk("editor.f.buttonLabel")} value={b.label} max={40} onChange={(label) => up({ label })} />
                <TextField label={tk("editor.f.buttonLink")} value={b.url} max={500} placeholder="/collections/all" onChange={(url) => up({ url })} />
                <Segmented label={tk("editor.f.variant")} value={b.variant} onChange={(variant) => up({ variant })} options={(["solid", "outline", "link"] as const).map((v) => ({ value: v, label: tk(`editor.variant.${v}`) }))} />
              </>}
              {b.type === "product" && (
                <SelectField label={tk("editor.block.product")} value={b.productId} onChange={(productId) => up({ productId })}
                  options={[{ value: "", label: tk("editor.chooseProduct") }, ...catalog.products.map((p) => ({ value: p.id, label: p.title }))]} />
              )}
              {b.type === "spacer" && <Segmented label={tk("editor.f.size")} value={b.size} onChange={(size) => up({ size })} options={(["sm", "md", "lg"] as const).map((v) => ({ value: v, label: tk(`editor.size.${v === "sm" ? "small" : v === "md" ? "medium" : "large"}`) }))} />}
              {b.type === "divider" && <p className="text-xs text-muted">{tk("editor.dividerHint")}</p>}
              <div className="flex gap-3 pt-1 text-xs">
                <button type="button" onClick={onDuplicate} className="text-muted hover:text-text">{tk("editor.duplicate")}</button>
                <button type="button" onClick={onDelete} className="ml-auto text-danger hover:underline">{tk("common.delete")}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}
