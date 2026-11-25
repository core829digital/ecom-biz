import "server-only";
import { z } from "zod";
import type { Prisma, Store } from "@prisma/client";
import { db } from "@/lib/db";
import { parseMoney } from "@/lib/money";
import { parseTheme, themeDraft, THEME_PRESETS } from "@/lib/theme";
import { blankSection, newSectionId, parseSections, SECTION_TYPES, type SectionType } from "@/lib/theme-sections";
import { clampTheme } from "@/lib/theme-capabilities";
import { uniqueHandle } from "@/server/catalog";
import { assertCanAddProducts, PlanLimitError } from "@/server/plans";
import { storeThemeCapabilities } from "@/server/storefront";
import { audit } from "@/server/audit";
import type { ToolSpec } from "./provider";

/**
 * What the assistant can do. Every tool runs with the store's own rules (same validation, plan
 * limits and tenant scoping as the admin UI). Safety by design: it creates and edits in draft,
 * never publishes the site, never emails customers, never deletes, never changes the price of a
 * product that is already on sale, and never sees shoppers' personal data.
 */
export type ToolContext = { store: Store; userId: string; adminBase: string };
export type ToolAction = { label: string; href?: string };
export type ToolOutcome = { result: unknown; action?: ToolAction };

type Tool<S extends z.ZodTypeAny> = {
  description: string;
  parameters: Record<string, unknown>;
  schema: S;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<ToolOutcome>;
};
const tool = <S extends z.ZodTypeAny>(t: Tool<S>) => t;

const str = (max: number) => ({ type: "string", maxLength: max });
const money = (v: string | number | undefined) => (v === undefined || v === "" ? null : parseMoney(String(v)));

async function saveDraftTheme(store: Store, mutate: (t: ReturnType<typeof parseTheme>) => ReturnType<typeof parseTheme>) {
  const fresh = await db.store.findUniqueOrThrow({ where: { id: store.id } });
  const base = themeDraft(fresh.theme) ?? parseTheme(fresh.theme);
  const next = clampTheme(mutate(base), await storeThemeCapabilities(store.id));
  const current = (fresh.theme && typeof fresh.theme === "object" ? fresh.theme : {}) as Prisma.InputJsonObject;
  await db.store.update({ where: { id: store.id }, data: { theme: { ...current, draft: JSON.parse(JSON.stringify(next)) } } });
  return next;
}

export const TOOLS = {
  get_store_overview: tool({
    description: "Store facts: name, currency, language, catalog size, last 30 days of sales, subscribers, what the homepage contains and what is still missing. Call this first when you need context.",
    // Gemini rejects object schemas without properties: one optional field keeps it valid everywhere.
    parameters: { type: "object", properties: { focus: { type: "string", description: "Optional: what you are about to work on." } } },
    schema: z.object({}).passthrough(),
    async run(_, { store }) {
      const since = new Date(Date.now() - 30 * 86400_000);
      const [products, active, collections, orders, subscribers, pages, shipping] = await Promise.all([
        db.product.count({ where: { storeId: store.id } }),
        db.product.count({ where: { storeId: store.id, status: "ACTIVE" } }),
        db.collection.count({ where: { storeId: store.id } }),
        db.order.aggregate({ where: { storeId: store.id, createdAt: { gte: since }, status: { not: "CANCELLED" } }, _count: true, _sum: { totalCents: true } }),
        db.newsletterSubscriber.count({ where: { storeId: store.id, status: "SUBSCRIBED" } }),
        db.page.findMany({ where: { storeId: store.id }, select: { title: true, handle: true, published: true } }),
        db.shippingRate.count({ where: { zone: { storeId: store.id } } }),
      ]);
      const theme = themeDraft(store.theme) ?? parseTheme(store.theme);
      return {
        result: {
          name: store.name, currency: store.currency, language: store.locale, country: store.countryCode,
          products, activeProducts: active, collections,
          last30Days: { orders: orders._count, revenue: (orders._sum.totalCents ?? 0) / 100 },
          newsletterSubscribers: subscribers, newsletterEnabled: store.newsletterEnabled,
          pages: pages.map((p) => `${p.title} (/${p.handle}${p.published ? "" : ", draft"})`),
          shippingRates: shipping,
          homepageSections: theme.sections.map((s) => s.type), motion: theme.motion,
          seo: { title: store.seoTitle, description: store.seoDescription },
        },
      };
    },
  }),

  list_products: tool({
    description: "Search the catalog. Returns id, title, status, price and stock.",
    parameters: { type: "object", properties: { query: str(100), limit: { type: "integer", minimum: 1, maximum: 50 } } },
    schema: z.object({ query: z.string().max(100).optional(), limit: z.number().int().min(1).max(50).optional() }),
    async run({ query, limit }, { store }) {
      const rows = await db.product.findMany({
        where: { storeId: store.id, ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) },
        include: { variants: { select: { priceCents: true, inventoryQty: true }, take: 1, orderBy: { position: "asc" } } },
        orderBy: { createdAt: "desc" }, take: limit ?? 20,
      });
      return { result: rows.map((p) => ({ id: p.id, title: p.title, status: p.status, price: (p.variants[0]?.priceCents ?? 0) / 100, stock: p.variants[0]?.inventoryQty ?? 0 })) };
    },
  }),

  create_products: tool({
    description: "Create up to 10 products as DRAFTS (the merchant reviews and activates them). Write persuasive, honest descriptions in the store language; price in the store currency as a number like 29.90.",
    parameters: {
      type: "object",
      properties: {
        products: {
          type: "array", maxItems: 10,
          items: {
            type: "object",
            properties: { title: str(150), description: str(5000), price: { type: "number" }, compareAtPrice: { type: "number" }, stock: { type: "integer" }, tags: { type: "array", items: str(40) }, productType: str(80), seoTitle: str(70), seoDescription: str(160) },
            required: ["title", "price"],
          },
        },
      },
      required: ["products"],
    },
    schema: z.object({
      products: z.array(z.object({
        title: z.string().trim().min(1).max(150), description: z.string().max(5000).default(""),
        price: z.union([z.number(), z.string()]), compareAtPrice: z.union([z.number(), z.string()]).optional(),
        stock: z.number().int().min(0).max(100000).optional(), tags: z.array(z.string().max(40)).max(15).default([]),
        productType: z.string().max(80).optional(), seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(160).optional(),
      })).min(1).max(10),
    }),
    async run({ products }, { store, userId, adminBase }) {
      try {
        await assertCanAddProducts(store.id, products.length);
      } catch (e) {
        if (e instanceof PlanLimitError) return { result: { error: `Plan limit reached: max ${e.limit} products.` } };
        throw e;
      }
      const created: { id: string; title: string }[] = [];
      for (const p of products) {
        const price = money(p.price);
        if (price === null || price < 0) continue;
        const compare = money(p.compareAtPrice);
        const product = await db.product.create({
          data: {
            storeId: store.id, title: p.title, handle: await uniqueHandle(store.id, p.title, "product"), description: p.description,
            status: "DRAFT", tags: p.tags, productType: p.productType || null, seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null,
            variants: { create: [{ title: "Default", priceCents: price, compareAtCents: compare && compare > price ? compare : null, inventoryQty: p.stock ?? 0 }] },
          },
        });
        created.push({ id: product.id, title: product.title });
      }
      await audit({ userId, storeId: store.id, action: "ai.products_create", meta: { count: created.length } });
      return { result: { created, note: "Created as drafts without photos: ask the merchant to add photos and activate them." }, action: { label: `products:${created.length}`, href: `${adminBase}/products?status=draft` } };
    },
  }),

  update_product: tool({
    description: "Improve a product's texts or SEO. Price changes are only allowed on DRAFT products.",
    parameters: { type: "object", properties: { productId: str(40), title: str(150), description: str(5000), price: { type: "number" }, seoTitle: str(70), seoDescription: str(160), tags: { type: "array", items: str(40) } }, required: ["productId"] },
    schema: z.object({ productId: z.string().max(40), title: z.string().trim().min(1).max(150).optional(), description: z.string().max(5000).optional(), price: z.union([z.number(), z.string()]).optional(), seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(160).optional(), tags: z.array(z.string().max(40)).max(15).optional() }),
    async run(a, { store, userId, adminBase }) {
      const p = await db.product.findFirst({ where: { id: a.productId, storeId: store.id }, include: { variants: { orderBy: { position: "asc" }, take: 1 } } });
      if (!p) return { result: { error: "Product not found" } };
      if (a.price !== undefined && p.status !== "DRAFT") return { result: { error: "This product is on sale: ask the merchant to change its price." } };
      await db.product.update({ where: { id: p.id }, data: { title: a.title, description: a.description, seoTitle: a.seoTitle, seoDescription: a.seoDescription, tags: a.tags } });
      const price = money(a.price);
      if (price !== null && price >= 0 && p.variants[0]) await db.productVariant.update({ where: { id: p.variants[0].id }, data: { priceCents: price } });
      await audit({ userId, storeId: store.id, action: "ai.product_update", target: p.title });
      return { result: { ok: true }, action: { label: `product:${a.title ?? p.title}`, href: `${adminBase}/products/${p.id}` } };
    },
  }),

  create_collection: tool({
    description: "Create a collection (category) and optionally put products in it.",
    parameters: { type: "object", properties: { title: str(120), description: str(2000), productIds: { type: "array", items: str(40) } }, required: ["title"] },
    schema: z.object({ title: z.string().trim().min(1).max(120), description: z.string().max(2000).default(""), productIds: z.array(z.string().max(40)).max(200).default([]) }),
    async run(a, { store, userId, adminBase }) {
      const owned = await db.product.findMany({ where: { storeId: store.id, id: { in: a.productIds } }, select: { id: true } });
      const c = await db.collection.create({
        data: { storeId: store.id, title: a.title, description: a.description, handle: await uniqueHandle(store.id, a.title, "collection"), products: { create: owned.map((p, i) => ({ productId: p.id, position: i })) } },
      });
      await audit({ userId, storeId: store.id, action: "ai.collection_create", target: c.title });
      return { result: { id: c.id, products: owned.length }, action: { label: `collection:${c.title}`, href: `${adminBase}/collections/${c.id}` } };
    },
  }),

  create_discount: tool({
    description: "Create a discount code. type: PERCENTAGE (value = percent, e.g. 15), FIXED_AMOUNT (value in store currency), FREE_SHIPPING. Created INACTIVE: the merchant switches it on.",
    parameters: { type: "object", properties: { code: str(30), type: { type: "string", enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"] }, value: { type: "number" }, minimumOrder: { type: "number" }, usageLimit: { type: "integer" }, endsAt: { type: "string", description: "ISO date" } }, required: ["code", "type"] },
    schema: z.object({ code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/), type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]), value: z.number().min(0).max(100000).default(0), minimumOrder: z.number().min(0).optional(), usageLimit: z.number().int().min(1).max(1_000_000).optional(), endsAt: z.string().max(40).optional() }),
    async run(a, { store, userId, adminBase }) {
      const code = a.code.toUpperCase();
      if (await db.discount.findUnique({ where: { storeId_code: { storeId: store.id, code } } })) return { result: { error: "This code already exists" } };
      if (a.type === "PERCENTAGE" && (a.value <= 0 || a.value > 100)) return { result: { error: "Percentage must be between 1 and 100" } };
      const endsAt = a.endsAt ? new Date(a.endsAt) : null;
      const d = await db.discount.create({
        data: {
          storeId: store.id, code, type: a.type, active: false,
          value: a.type === "PERCENTAGE" ? Math.round(a.value * 100) : a.type === "FIXED_AMOUNT" ? Math.round(a.value * 100) : 0,
          minSubtotalCents: a.minimumOrder ? Math.round(a.minimumOrder * 100) : 0, usageLimit: a.usageLimit ?? null,
          endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
        },
      });
      await audit({ userId, storeId: store.id, action: "ai.discount_create", target: code });
      return { result: { id: d.id, code, active: false }, action: { label: `discount:${code}`, href: `${adminBase}/discounts/${d.id}` } };
    },
  }),

  write_blog_post: tool({
    description: "Write a blog article saved as an unpublished draft. Use '## ' for headings and '- ' for lists in the body.",
    parameters: { type: "object", properties: { title: str(150), excerpt: str(300), body: str(20000), seoDescription: str(160) }, required: ["title", "body"] },
    schema: z.object({ title: z.string().trim().min(1).max(150), excerpt: z.string().max(300).optional(), body: z.string().max(20000), seoDescription: z.string().max(160).optional() }),
    async run(a, { store, userId, adminBase }) {
      const post = await db.blogPost.create({ data: { storeId: store.id, title: a.title, handle: await uniqueHandle(store.id, a.title, "blog"), excerpt: a.excerpt || null, body: a.body, seoDescription: a.seoDescription || null, published: false } });
      await audit({ userId, storeId: store.id, action: "ai.blog_create", target: post.title });
      return { result: { id: post.id }, action: { label: `blog:${post.title}`, href: `${adminBase}/online-store/blog/${post.id}` } };
    },
  }),

  create_page: tool({
    description: "Create an informational page (e.g. About us, FAQ) as an unpublished draft.",
    parameters: { type: "object", properties: { title: str(120), body: str(20000) }, required: ["title", "body"] },
    schema: z.object({ title: z.string().trim().min(1).max(120), body: z.string().max(20000) }),
    async run(a, { store, userId, adminBase }) {
      const page = await db.page.create({ data: { storeId: store.id, title: a.title, handle: await uniqueHandle(store.id, a.title, "page"), body: a.body, published: false } });
      await audit({ userId, storeId: store.id, action: "ai.page_create", target: page.title });
      return { result: { id: page.id }, action: { label: `page:${page.title}`, href: `${adminBase}/online-store/pages/${page.id}` } };
    },
  }),

  design_homepage: tool({
    description: `Replace the homepage layout in the site editor DRAFT (the merchant previews and publishes). Section types: ${SECTION_TYPES.join(", ")}. Useful fields: title, subtitle, body, ctaLabel, ctaUrl, items (features: [{title, body}], testimonials: [{quote, author}], faq: [{q, a}]), style {background: default|muted|brand|inverse}. Write real copy for this business, never placeholders.`,
    parameters: {
      type: "object",
      properties: { sections: { type: "array", maxItems: 12, items: { type: "object", properties: { type: { type: "string", enum: SECTION_TYPES }, title: str(120), subtitle: str(300), body: str(3000), ctaLabel: str(40), ctaUrl: str(200), items: { type: "array", items: { type: "object", properties: { title: str(120), body: str(1000), quote: str(400), author: str(60), q: str(200), a: str(1000) } } }, style: { type: "object", properties: { background: { type: "string", enum: ["default", "muted", "brand", "inverse"] }, spacing: { type: "string", enum: ["compact", "normal", "roomy"] }, width: { type: "string", enum: ["narrow", "normal", "full"] } } } }, required: ["type"] } } },
      required: ["sections"],
    },
    schema: z.object({ sections: z.array(z.record(z.string(), z.unknown())).min(1).max(12) }),
    async run({ sections }, { store, userId, adminBase }) {
      const parsed = parseSections(sections.map((s) => ({ ...(blankSection((SECTION_TYPES.includes(s.type as SectionType) ? s.type : "rich-text") as SectionType) as Record<string, unknown>), ...s, id: newSectionId() })));
      if (!parsed?.length) return { result: { error: "No valid sections" } };
      await saveDraftTheme(store, (t) => ({ ...t, sections: parsed }));
      await audit({ userId, storeId: store.id, action: "ai.homepage_draft", meta: { sections: parsed.length } });
      return { result: { ok: true, sections: parsed.map((s) => s.type), note: "Saved as a draft: the merchant publishes it from the site editor." }, action: { label: "homepage", href: `${adminBase}/online-store/theme` } };
    },
  }),

  set_store_style: tool({
    description: `Change the store look in the site editor DRAFT: a preset (${THEME_PRESETS.map((p) => p.id).join(", ")}) and/or explicit hex colors, and the animation style (none, subtle, smooth, cinematic).`,
    parameters: { type: "object", properties: { preset: { type: "string", enum: THEME_PRESETS.map((p) => p.id) }, primaryColor: str(7), backgroundColor: str(7), textColor: str(7), accentColor: str(7), motion: { type: "string", enum: ["none", "subtle", "smooth", "cinematic"] } } },
    schema: z.object({ preset: z.string().max(30).optional(), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), motion: z.enum(["none", "subtle", "smooth", "cinematic"]).optional() }),
    async run(a, { store, userId, adminBase }) {
      const preset = THEME_PRESETS.find((p) => p.id === a.preset);
      const next = await saveDraftTheme(store, (t) => {
        const { id: _i, name: _n, ...look } = preset ?? { id: "", name: "" };
        void _i; void _n;
        return { ...t, ...look, ...Object.fromEntries(Object.entries({ primaryColor: a.primaryColor, backgroundColor: a.backgroundColor, textColor: a.textColor, accentColor: a.accentColor, motion: a.motion }).filter(([, v]) => v)) };
      });
      await audit({ userId, storeId: store.id, action: "ai.style_draft" });
      return { result: { ok: true, motion: next.motion, note: next.motion !== a.motion && a.motion ? "Animation style limited by the plan." : undefined }, action: { label: "style", href: `${adminBase}/online-store/theme` } };
    },
  }),

  create_email_campaign: tool({
    description: "Write a newsletter campaign saved as a DRAFT (the merchant reviews, tests and sends it). Body: blank line between paragraphs, '- ' for lists, **bold**.",
    parameters: { type: "object", properties: { subject: str(150), preheader: str(150), heading: str(150), body: str(5000), ctaLabel: str(40), ctaUrl: str(200) }, required: ["subject", "body"] },
    schema: z.object({ subject: z.string().trim().min(1).max(150), preheader: z.string().max(150).default(""), heading: z.string().max(150).default(""), body: z.string().max(5000), ctaLabel: z.string().max(40).default(""), ctaUrl: z.string().max(200).default("") }),
    async run(a, { store, userId, adminBase }) {
      const c = await db.emailCampaign.create({ data: { storeId: store.id, ...a, createdByAi: true } });
      await audit({ userId, storeId: store.id, action: "ai.campaign_draft", target: c.subject });
      return { result: { id: c.id }, action: { label: `campaign:${c.subject}`, href: `${adminBase}/marketing/campaigns/${c.id}` } };
    },
  }),

  update_store_seo: tool({
    description: "Set the store's homepage title (max 70 chars) and meta description (max 160) for Google.",
    parameters: { type: "object", properties: { seoTitle: str(70), seoDescription: str(160) } },
    schema: z.object({ seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(160).optional() }),
    async run(a, { store, userId, adminBase }) {
      await db.store.update({ where: { id: store.id }, data: { seoTitle: a.seoTitle, seoDescription: a.seoDescription } });
      await audit({ userId, storeId: store.id, action: "ai.seo_update" });
      return { result: { ok: true }, action: { label: "seo", href: `${adminBase}/settings` } };
    },
  }),

  remember: tool({
    description: "Save something important about this business for future conversations (preferences, tone, audience, decisions). Use it whenever the merchant tells you something lasting. To replace the overall business description, pass profile.",
    parameters: { type: "object", properties: { fact: str(300), profile: str(2000) } },
    schema: z.object({ fact: z.string().trim().max(300).optional(), profile: z.string().trim().max(2000).optional() }),
    async run(a, { store }) {
      const mem = await db.aiMemory.findUnique({ where: { storeId: store.id } });
      const facts = Array.isArray(mem?.facts) ? (mem!.facts as string[]) : [];
      const next = a.fact ? [...facts.filter((f) => f !== a.fact), a.fact].slice(-40) : facts;
      await db.aiMemory.upsert({ where: { storeId: store.id }, create: { storeId: store.id, profile: a.profile ?? "", facts: next }, update: { ...(a.profile ? { profile: a.profile } : {}), facts: next } });
      return { result: { ok: true }, action: { label: "memory" } };
    },
  }),
} as const;

export type ToolName = keyof typeof TOOLS;

export function toolSpecs(): ToolSpec[] {
  return Object.entries(TOOLS).map(([name, t]) => ({ type: "function", function: { name, description: t.description, parameters: t.parameters } }));
}

/** Runs a tool call from the model. Errors become results the model can explain, never crashes. */
export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolOutcome> {
  const t = (TOOLS as Record<string, Tool<z.ZodTypeAny>>)[name];
  if (!t) return { result: { error: `Unknown tool ${name}` } };
  let args: unknown;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { result: { error: "Arguments are not valid JSON" } };
  }
  const parsed = t.schema.safeParse(args);
  if (!parsed.success) return { result: { error: "Invalid arguments", issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) } };
  try {
    return await t.run(parsed.data, ctx);
  } catch (e) {
    console.error(`[ai] tool ${name} failed`, e);
    return { result: { error: "The action failed on the server." } };
  }
}
