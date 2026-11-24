import Link from "next/link";
import { db } from "@/lib/db";
import { RichText, plainExcerpt } from "@/lib/richtext";
import { cn } from "@/lib/cn";
import { collectionProducts, productCardInclude, type ProductCardData } from "@/server/catalog";
import { sfHref, type Storefront } from "@/server/storefront";
import type { Block, Section, SectionOf, SectionStyle } from "@/lib/theme-sections";
import { ProductCard, ProductGrid } from "./product-card";
import { SimpleActionForm } from "./simple-action";
import { subscribeAction } from "@/app/(store)/sites/[site]/newsletter/actions";

/** Renders the homepage sections the merchant built in the site editor. */
export async function HomeSections({ sf, site, sections }: { sf: Storefront; site: string; sections: Section[] }) {
  const visible = sections.filter((s) => s.enabled);
  const data = await loadSectionData(sf, visible);
  return (
    <>
      {visible.map((s, i) => (
        <SectionFrame key={s.id} section={s} hero={s.type === "hero"} first={i === 0}>
          <SectionBody section={s} sf={sf} site={site} data={data} />
        </SectionFrame>
      ))}
      {visible.length === 0 && sf.preview && <p className="mx-auto max-w-6xl px-4 py-24 text-center text-muted">{sf.t("sf.sections.empty")}</p>}
    </>
  );
}

type SectionData = Awaited<ReturnType<typeof loadSectionData>>;

/** One query per kind of data, whatever the number of sections. */
async function loadSectionData(sf: Storefront, sections: Section[]) {
  const storeId = sf.store.id;
  const featured = sections.filter((s): s is SectionOf<"featured-products"> => s.type === "featured-products");
  const productIds = sections.flatMap((s) => (s.type === "container" ? s.blocks.flatMap((b) => (b.type === "product" && b.productId ? [b.productId] : [])) : []));
  const wantsCollections = sections.some((s) => s.type === "collections");
  const wantsBlog = sections.some((s) => s.type === "blog-posts");

  const [featuredProducts, products, collections, posts] = await Promise.all([
    Promise.all(featured.map(async (s) => {
      const col = s.collectionId ? await db.collection.findFirst({ where: { id: s.collectionId, storeId, published: true } }) : null;
      const list = col
        ? (await collectionProducts(col, { perPage: s.limit })).products
        : await db.product.findMany({ where: { storeId, status: "ACTIVE" }, include: productCardInclude, orderBy: { createdAt: "desc" }, take: s.limit });
      return [s.id, { collection: col, products: list }] as const;
    })).then((e) => new Map(e)),
    productIds.length
      ? db.product.findMany({ where: { storeId, status: "ACTIVE", id: { in: productIds } }, include: productCardInclude }).then((l) => new Map(l.map((p) => [p.id, p])))
      : new Map<string, ProductCardData>(),
    wantsCollections ? db.collection.findMany({ where: { storeId, published: true }, orderBy: { title: "asc" }, take: 6 }) : [],
    wantsBlog ? db.blogPost.findMany({ where: { storeId, published: true }, orderBy: { publishedAt: "desc" }, take: 6 }) : [],
  ]);
  return { featuredProducts, products, collections, posts };
}

const BG: Record<SectionStyle["background"], string> = {
  default: "",
  muted: "bg-surface-2",
  brand: "bg-brand text-brand-contrast",
  inverse: "bg-text text-bg",
};
const PAD: Record<SectionStyle["spacing"], string> = { compact: "py-8 sm:py-10", normal: "py-14 sm:py-20", roomy: "py-20 sm:py-28" };
const WIDTH: Record<SectionStyle["width"], string> = { narrow: "max-w-3xl", normal: "max-w-6xl", full: "max-w-none" };

/** Sections whose items enter one after another rather than as a block. */
const STAGGERED = new Set<Section["type"]>(["featured-products", "collections", "features", "testimonials", "blog-posts", "container"]);

function SectionFrame({ section, hero, first, children }: { section: Section; hero?: boolean; first?: boolean; children: React.ReactNode }) {
  const { background, spacing, reveal } = section.style;
  // The opening section is never hidden: it animates on load (CSS) so the first paint stays fast.
  const motion = first ? {} : { "data-reveal": reveal, ...(STAGGERED.has(section.type) && reveal === "auto" ? { "data-stagger": "" } : {}) };
  return (
    <section data-section-id={section.id} {...motion} className={cn("relative scroll-mt-20", BG[background], !hero && PAD[spacing])}>
      {children}
    </section>
  );
}

function Container({ section, className, children, ...rest }: { section: Section; className?: string; children: React.ReactNode; "data-hero-text"?: boolean }) {
  return <div className={cn("mx-auto px-4 sm:px-6", WIDTH[section.style.width], className)} {...rest}>{children}</div>;
}

/** Marks a grid item for the staggered entrance (index drives the delay). */
const item = (i: number) => ({ "data-reveal-item": "", style: { "--i": Math.min(i, 8) } as React.CSSProperties });

/** Solid buttons invert on colored sections so they never disappear into the background. */
function buttonClass(section: Section, variant: "solid" | "outline" | "link" = "solid") {
  const colored = section.style.background === "brand" || section.style.background === "inverse";
  if (variant === "link") return "inline-flex items-center gap-1 font-medium underline underline-offset-4";
  if (variant === "outline") return "inline-flex h-12 items-center rounded-btn border border-current px-7 font-medium transition-opacity hover:opacity-80";
  return cn("inline-flex h-12 items-center rounded-btn px-7 font-medium transition-opacity hover:opacity-90", colored ? "bg-bg text-text" : "bg-brand text-brand-contrast");
}

function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-balance text-2xl font-semibold tracking-tight sm:text-3xl", className)}>{children}</h2>;
}

function SectionBody({ section: s, sf, site, data }: { section: Section; sf: Storefront; site: string; data: SectionData }) {
  const { t } = sf;
  switch (s.type) {
    case "hero": {
      const tall = { small: "py-16 sm:py-20", medium: "py-24 sm:py-32", large: "min-h-[70svh] py-24 flex items-center" }[s.height];
      const img = !!s.imageUrl;
      return (
        <div className={cn("relative overflow-hidden", !img && s.style.background === "default" && "bg-surface-2")}>
          {img && <img src={s.imageUrl} alt="" data-hero-img className="absolute inset-0 size-full object-cover" />}
          {img && <div className="absolute inset-0 bg-black" style={{ opacity: s.overlay / 100 }} aria-hidden />}
          <div className={cn(tall, "relative w-full", img && "text-white")}>
            <Container section={s} className={cn("w-full", s.align === "center" && "text-center")} data-hero-text>
              <h1 className={cn("max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl", s.align === "center" && "mx-auto")}>{s.title || sf.store.name}</h1>
              {s.subtitle && <p className={cn("mt-5 max-w-xl text-pretty text-lg opacity-90", s.align === "center" && "mx-auto")}>{s.subtitle}</p>}
              <a href={sfHref(sf.base, s.ctaUrl || "/collections/all")} className={cn(buttonClass(s), "mt-8", img && "bg-white text-black")}>
                {s.ctaLabel || t("sf.shopNow")}
              </a>
            </Container>
          </div>
        </div>
      );
    }
    case "featured-products": {
      const d = data.featuredProducts.get(s.id);
      return (
        <Container section={s}>
          <div className="mb-8 flex items-end justify-between gap-4">
            <Heading>{s.title || d?.collection?.title || t("sf.featured")}</Heading>
            <Link href={sf.href(d?.collection ? `/collections/${d.collection.handle}` : "/collections/all")} className="shrink-0 text-sm underline">{t("sf.viewAll")}</Link>
          </div>
          {d?.products.length ? <ProductGrid products={d.products} sf={sf} stagger /> : <p className="opacity-70">{t("sf.noProducts")}</p>}
        </Container>
      );
    }
    case "collections": {
      const list = data.collections.slice(0, s.limit);
      if (!list.length) return sf.preview ? <Container section={s}><p className="opacity-70">{t("sf.sections.noCollections")}</p></Container> : null;
      return (
        <Container section={s}>
          <Heading className="mb-8">{s.title || t("sf.collections")}</Heading>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {list.map((c, i) => (
              <li key={c.id} {...item(i)}>
                <Link href={sf.href(`/collections/${c.handle}`)} className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-surface-2 text-text">
                  {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  <span className={cn("absolute bottom-3 left-3 rounded-btn px-3 py-1 text-sm font-medium", c.imageUrl && "bg-bg")}>{c.title} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      );
    }
    case "image-text":
      return (
        <Container section={s} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className={cn("aspect-[4/3] overflow-hidden rounded-card bg-surface-2", s.imagePosition === "right" && "md:order-2")}>
            {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
          <div>
            {s.title && <Heading>{s.title}</Heading>}
            {s.body && <RichText text={s.body} className="prose-store mt-4 opacity-90" />}
            {s.ctaLabel && <a href={sfHref(sf.base, s.ctaUrl || "/collections/all")} className={cn(buttonClass(s), "mt-6")}>{s.ctaLabel}</a>}
          </div>
        </Container>
      );
    case "rich-text":
      return (
        <Container section={s} className={cn(s.align === "center" && "text-center")}>
          <div className={cn("max-w-2xl", s.align === "center" && "mx-auto")}>
            {s.title && <Heading>{s.title}</Heading>}
            {s.body && <RichText text={s.body} className="prose-store mt-4 opacity-90" />}
          </div>
        </Container>
      );
    case "features":
      return (
        <Container section={s}>
          {s.title && <Heading className="mb-10 text-center">{s.title}</Heading>}
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {s.items.filter((i) => i.title || i.body).map((i, n) => (
              <li key={n} className="text-center" {...item(n)}>
                <span className="mx-auto mb-3 block h-1 w-8 rounded-full bg-current opacity-40" aria-hidden />
                <p className="font-semibold">{i.title}</p>
                {i.body && <p className="mt-1.5 text-sm opacity-75">{i.body}</p>}
              </li>
            ))}
          </ul>
        </Container>
      );
    case "testimonials":
      return (
        <Container section={s}>
          {s.title && <Heading className="mb-10 text-center">{s.title}</Heading>}
          <ul className="grid gap-5 md:grid-cols-3">
            {s.items.filter((i) => i.quote).map((i, n) => (
              <li key={n} {...item(n)}>
                <figure className="h-full rounded-card border border-current/15 p-6">
                  <blockquote className="text-pretty leading-relaxed">“{i.quote}”</blockquote>
                  {i.author && <figcaption className="mt-4 text-sm font-medium opacity-75">— {i.author}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </Container>
      );
    case "faq": {
      const items = s.items.filter((i) => i.q && i.a);
      const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })) };
      return (
        <Container section={s} className="max-w-3xl">
          {s.title && <Heading className="mb-8">{s.title}</Heading>}
          <div className="divide-y divide-current/15 border-y border-current/15">
            {items.map((i, n) => (
              <details key={n} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {i.q}
                  <span className="relative size-4 shrink-0" aria-hidden>
                    <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                    <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" />
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed opacity-80">{i.a}</p>
              </details>
            ))}
          </div>
          {items.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
        </Container>
      );
    }
    case "banner":
      return (
        <Container section={s} className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            {s.title && <Heading>{s.title}</Heading>}
            {s.body && <p className="mt-2 max-w-xl opacity-85">{s.body}</p>}
          </div>
          {s.ctaLabel && <a href={sfHref(sf.base, s.ctaUrl || "/collections/all")} className={cn(buttonClass(s), "shrink-0")}>{s.ctaLabel}</a>}
        </Container>
      );
    case "newsletter":
      if (!sf.store.newsletterEnabled) return sf.preview ? <Container section={s}><p className="opacity-70">{t("sf.sections.newsletterOff")}</p></Container> : null;
      return (
        <Container section={s} className="max-w-xl text-center">
          <Heading>{s.title || t("sf.newsletter.title")}</Heading>
          <p className="mt-2 opacity-80">{s.body || t("sf.newsletter.body")}</p>
          <SimpleActionForm action={subscribeAction.bind(null, site)} submitLabel={t("sf.newsletter.cta")} className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2" buttonClassName={cn(buttonClass(s), "h-11")}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <input type="email" name="email" required maxLength={200} autoComplete="email" placeholder={t("field.email")} aria-label={t("field.email")} className="h-11 min-w-0 flex-1 rounded-btn border border-current/25 bg-transparent px-4 text-sm outline-none focus:border-current" />
          </SimpleActionForm>
          <p className="mt-3 text-xs opacity-60">{t("sf.newsletter.consent")}</p>
        </Container>
      );
    case "blog-posts": {
      const posts = data.posts.slice(0, s.limit);
      if (!posts.length) return sf.preview ? <Container section={s}><p className="opacity-70">{t("sf.blog.empty")}</p></Container> : null;
      return (
        <Container section={s}>
          <div className="mb-8 flex items-end justify-between gap-4">
            <Heading>{s.title || t("sf.blog.title")}</Heading>
            <Link href={sf.href("/blog")} className="shrink-0 text-sm underline">{t("sf.viewAll")}</Link>
          </div>
          <ul className="grid gap-6 md:grid-cols-3">
            {posts.map((p, i) => (
              <li key={p.id} {...item(i)}>
                <Link href={sf.href(`/blog/${p.handle}`)} className="group block">
                  <div className="mb-3 aspect-[16/10] overflow-hidden rounded-card bg-surface-2">
                    {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  </div>
                  <p className="font-medium group-hover:underline">{p.title}</p>
                  <p className="mt-1 text-sm opacity-75">{p.excerpt || plainExcerpt(p.body, 120)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      );
    }
    case "container": {
      const cols = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[s.columns];
      return (
        <Container section={s} className={cn("grid gap-6", cols, s.verticalAlign === "center" && "items-center", s.align === "center" && "text-center")}>
          {s.blocks.map((b, i) => <div key={b.id} {...item(i)} className={cn("min-w-0", s.columns > 1 && (b.type === "spacer" || b.type === "divider") && "md:col-span-full")}><BlockView block={b} section={s} sf={sf} data={data} /></div>)}
        </Container>
      );
    }
  }
}

function BlockView({ block: b, section, sf, data }: { block: Block; section: SectionOf<"container">; sf: Storefront; data: SectionData }) {
  switch (b.type) {
    case "heading": {
      const size = { sm: "text-lg", md: "text-2xl", lg: "text-3xl sm:text-4xl", xl: "text-4xl sm:text-6xl" }[b.size];
      return b.text ? <h2 className={cn("text-balance font-semibold tracking-tight", size)}>{b.text}</h2> : null;
    }
    case "text":
      return b.text ? <RichText text={b.text} className="prose-store opacity-90" /> : null;
    case "image": {
      const ratio = { auto: "", square: "aspect-square", portrait: "aspect-[4/5]", landscape: "aspect-[16/10]" }[b.ratio];
      if (!b.url) return sf.preview ? <div className={cn("rounded-card bg-surface-2", ratio || "aspect-[16/10]")} /> : null;
      const img = <img src={b.url} alt={b.alt} loading="lazy" className={cn("w-full rounded-card object-cover", ratio)} />;
      return b.link ? <a href={sfHref(sf.base, b.link)} className="block">{img}</a> : img;
    }
    case "button":
      return b.label ? <div><a href={sfHref(sf.base, b.url || "/collections/all")} className={buttonClass(section, b.variant)}>{b.label}</a></div> : null;
    case "product": {
      const p = data.products.get(b.productId);
      return p ? <div className="text-left"><ProductCard product={p} sf={sf} /></div> : null;
    }
    case "spacer":
      return <div style={{ height: { sm: 16, md: 40, lg: 80 }[b.size] }} aria-hidden />;
    case "divider":
      return <hr className="border-current opacity-15" />;
  }
}
