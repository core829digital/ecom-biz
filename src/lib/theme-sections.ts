import { z } from "zod";

/**
 * Homepage sections (the "site editor" model). Each section is a typed block the merchant
 * can add, reorder, hide and edit. Every field falls back to a safe default, so a damaged
 * or outdated section never breaks the storefront: unknown types are simply dropped.
 */
const safeUrl = z.string().max(2000).refine((u) => u === "" || u.startsWith("https://") || u.startsWith("/files/"));
const text = (max: number, d = "") => z.string().max(max).catch(d);
const link = z.string().max(500).catch("");

/** Look shared by every section: background, vertical spacing and content width. */
export const sectionStyleSchema = z.object({
  background: z.enum(["default", "muted", "brand", "inverse"]).catch("default"),
  spacing: z.enum(["compact", "normal", "roomy"]).catch("normal"),
  width: z.enum(["narrow", "normal", "full"]).catch("normal"),
  /** Entrance animation; "auto" follows the store's motion preset. Premium plans only. */
  reveal: z.enum(["auto", "none", "fade", "rise", "zoom", "slide-left", "slide-right", "blur"]).catch("auto"),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;
export const REVEALS = ["auto", "none", "fade", "rise", "zoom", "slide-left", "slide-right", "blur"] as const;
const DEFAULT_STYLE: SectionStyle = { background: "default", spacing: "normal", width: "normal", reveal: "auto" };

const base = {
  id: z.string().regex(/^[a-z0-9]{4,16}$/),
  enabled: z.boolean().catch(true),
  style: sectionStyleSchema.catch(DEFAULT_STYLE),
};

/** Free-form building blocks for the "container" section. */
const blockId = z.string().regex(/^[a-z0-9]{4,16}$/);
export const BLOCK_SCHEMAS = {
  heading: z.object({ id: blockId, type: z.literal("heading"), text: text(160), size: z.enum(["sm", "md", "lg", "xl"]).catch("lg") }),
  text: z.object({ id: blockId, type: z.literal("text"), text: text(3000) }),
  image: z.object({ id: blockId, type: z.literal("image"), url: safeUrl.catch(""), alt: text(200), ratio: z.enum(["auto", "square", "portrait", "landscape"]).catch("auto"), link }),
  button: z.object({ id: blockId, type: z.literal("button"), label: text(40), url: link, variant: z.enum(["solid", "outline", "link"]).catch("solid") }),
  product: z.object({ id: blockId, type: z.literal("product"), productId: z.string().max(40).catch("") }),
  spacer: z.object({ id: blockId, type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).catch("md") }),
  divider: z.object({ id: blockId, type: z.literal("divider") }),
} as const;
export type BlockType = keyof typeof BLOCK_SCHEMAS;
export const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];
export type Block = { [K in BlockType]: z.infer<(typeof BLOCK_SCHEMAS)[K]> }[BlockType];
export const MAX_BLOCKS = 24;

const blocksSchema = z.array(z.unknown()).max(MAX_BLOCKS).catch([]).transform((arr) => {
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const item of arr) {
    const type = (item as { type?: unknown })?.type;
    if (typeof type !== "string" || !(type in BLOCK_SCHEMAS)) continue;
    const parsed = BLOCK_SCHEMAS[type as BlockType].safeParse(item);
    if (parsed.success && !seen.has(parsed.data.id)) {
      seen.add(parsed.data.id);
      out.push(parsed.data as Block);
    }
  }
  return out;
});

export const SECTION_SCHEMAS = {
  hero: z.object({
    ...base, type: z.literal("hero"),
    title: text(120), subtitle: text(300), imageUrl: safeUrl.catch(""),
    ctaLabel: text(40), ctaUrl: link,
    align: z.enum(["left", "center"]).catch("left"),
    height: z.enum(["small", "medium", "large"]).catch("medium"),
    overlay: z.number().int().min(0).max(80).catch(35),
  }),
  "featured-products": z.object({
    ...base, type: z.literal("featured-products"),
    title: text(80), collectionId: z.string().max(40).catch(""),
    limit: z.union([z.literal(4), z.literal(8), z.literal(12)]).catch(8),
  }),
  collections: z.object({
    ...base, type: z.literal("collections"),
    title: text(80), limit: z.union([z.literal(3), z.literal(6)]).catch(6),
  }),
  "image-text": z.object({
    ...base, type: z.literal("image-text"),
    title: text(120), body: text(1500), imageUrl: safeUrl.catch(""),
    ctaLabel: text(40), ctaUrl: link,
    imagePosition: z.enum(["left", "right"]).catch("left"),
  }),
  "rich-text": z.object({
    ...base, type: z.literal("rich-text"),
    title: text(120), body: text(3000), align: z.enum(["left", "center"]).catch("center"),
  }),
  features: z.object({
    ...base, type: z.literal("features"),
    title: text(80),
    items: z.array(z.object({ title: text(60), body: text(200) })).max(4).catch([]),
  }),
  testimonials: z.object({
    ...base, type: z.literal("testimonials"),
    title: text(80),
    items: z.array(z.object({ quote: text(400), author: text(60) })).max(6).catch([]),
  }),
  faq: z.object({
    ...base, type: z.literal("faq"),
    title: text(80),
    items: z.array(z.object({ q: text(200), a: text(1000) })).max(12).catch([]),
  }),
  banner: z.object({
    ...base, type: z.literal("banner"),
    title: text(120), body: text(300), ctaLabel: text(40), ctaUrl: link,
  }),
  newsletter: z.object({ ...base, type: z.literal("newsletter"), title: text(80), body: text(300) }),
  container: z.object({
    ...base, type: z.literal("container"),
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).catch(1),
    align: z.enum(["left", "center"]).catch("left"),
    verticalAlign: z.enum(["top", "center"]).catch("top"),
    blocks: blocksSchema,
  }),
  "blog-posts": z.object({ ...base, type: z.literal("blog-posts"), title: text(80), limit: z.union([z.literal(3), z.literal(6)]).catch(3) }),
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export const SECTION_TYPES = Object.keys(SECTION_SCHEMAS) as SectionType[];
export type Section = { [K in SectionType]: z.infer<(typeof SECTION_SCHEMAS)[K]> }[SectionType];
export type SectionOf<K extends SectionType> = Extract<Section, { type: K }>;

export const MAX_SECTIONS = 20;

/** Keeps the valid sections (in order), drops the rest and duplicate ids. */
export function parseSections(raw: unknown): Section[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: Section[] = [];
  for (const item of raw.slice(0, MAX_SECTIONS)) {
    const type = (item as { type?: unknown })?.type;
    if (typeof type !== "string" || !(type in SECTION_SCHEMAS)) continue;
    const parsed = SECTION_SCHEMAS[type as SectionType].safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    out.push(parsed.data as Section);
  }
  return out;
}

/** A new block of the given type with neutral defaults. */
export function blankBlock(type: BlockType, id = newSectionId()): Block {
  return BLOCK_SCHEMAS[type].parse({ id, type }) as Block;
}

export function newSectionId() {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

/** A new section of the given type, with neutral defaults (texts left empty = translated fallbacks). */
export function blankSection<K extends SectionType>(type: K, id = newSectionId()): SectionOf<K> {
  const seed: Record<SectionType, Record<string, unknown>> = {
    hero: {},
    "featured-products": {},
    collections: {},
    "image-text": {},
    "rich-text": {},
    features: { items: [{ title: "", body: "" }, { title: "", body: "" }, { title: "", body: "" }] },
    testimonials: { items: [{ quote: "", author: "" }] },
    faq: { items: [{ q: "", a: "" }] },
    banner: {},
    newsletter: {},
    "blog-posts": {},
    container: { blocks: [{ id: newSectionId(), type: "heading", text: "", size: "lg" }, { id: newSectionId(), type: "text", text: "" }] },
  };
  return SECTION_SCHEMAS[type].parse({ id, type, enabled: true, ...seed[type] }) as SectionOf<K>;
}
