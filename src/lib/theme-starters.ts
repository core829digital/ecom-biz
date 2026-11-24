import { blankSection, newSectionId, parseSections, type Section } from "./theme-sections";
import { THEME_PRESETS } from "./theme";

/**
 * Ready-made homepages offered when a store is created, so it looks finished from minute one.
 * The copy is written in the store's language and is meant to be edited in the site editor.
 */
export const STARTER_IDS = ["classic", "editorial", "minimal"] as const;
export type StarterId = (typeof STARTER_IDS)[number];

const COPY = {
  en: {
    heroSub: "Thoughtfully made products, delivered to your door.",
    shop: "Shop now",
    benefits: [["Fast shipping", "Dispatched within 48 hours."], ["Easy returns", "14 days to change your mind."], ["Secure payments", "Cards, bank transfer and more."], ["Real support", "Write to us, a person answers."]],
    storyTitle: "Our story",
    storyBody: "Tell customers who you are, how your products are made and why they will love them.",
    storyCta: "Discover the collection",
    reviews: "What customers say",
    quotes: [["Beautiful quality and super fast delivery.", "Giulia"], ["Exactly as described. I'll order again.", "Marco"], ["Lovely packaging and great service.", "Elena"]],
    faqTitle: "Frequently asked questions",
    faq: [["How long does shipping take?", "Orders ship within 48 hours; delivery usually takes 2–4 working days."], ["Can I return an item?", "Yes, you have 14 days from delivery to return it."]],
    newsletter: "Join the newsletter",
    manifesto: "Fewer, better things.",
    manifestoBody: "We choose every material and every detail with care, so what you buy lasts.",
  },
  it: {
    heroSub: "Prodotti scelti con cura, consegnati a casa tua.",
    shop: "Scopri ora",
    benefits: [["Spedizione rapida", "Spediamo entro 48 ore."], ["Resi facili", "14 giorni per cambiare idea."], ["Pagamenti sicuri", "Carte, bonifico e altro."], ["Assistenza vera", "Scrivici, risponde una persona."]],
    storyTitle: "La nostra storia",
    storyBody: "Racconta chi sei, come nascono i tuoi prodotti e perché i clienti li ameranno.",
    storyCta: "Scopri la collezione",
    reviews: "Cosa dicono i clienti",
    quotes: [["Qualità bellissima e consegna velocissima.", "Giulia"], ["Esattamente come descritto. Riordinerò.", "Marco"], ["Confezione curata e servizio ottimo.", "Elena"]],
    faqTitle: "Domande frequenti",
    faq: [["Quanto tempo richiede la spedizione?", "Spediamo entro 48 ore; la consegna richiede di solito 2–4 giorni lavorativi."], ["Posso restituire un articolo?", "Sì, hai 14 giorni dalla consegna per il reso."]],
    newsletter: "Iscriviti alla newsletter",
    manifesto: "Meno cose, fatte meglio.",
    manifestoBody: "Scegliamo ogni materiale e ogni dettaglio con cura, perché ciò che compri duri nel tempo.",
  },
} as const;

export function starterSections(id: StarterId, storeName: string, locale: string): Section[] {
  const c = COPY[locale === "it" ? "it" : "en"];
  const s = (raw: Record<string, unknown>) => ({ id: newSectionId(), enabled: true, ...raw });
  const hero = (extra: Record<string, unknown>) => s({ type: "hero", title: storeName, subtitle: c.heroSub, ctaLabel: c.shop, ctaUrl: "/collections/all", ...extra });
  const featured = s({ type: "featured-products", limit: 8 });
  const layouts: Record<StarterId, Record<string, unknown>[]> = {
    classic: [
      hero({ height: "large", style: { background: "muted" } }),
      s({ type: "features", items: c.benefits.map(([title, body]) => ({ title, body })), style: { spacing: "compact" } }),
      featured,
      s({ type: "image-text", title: c.storyTitle, body: c.storyBody, ctaLabel: c.storyCta, ctaUrl: "/collections/all" }),
      s({ type: "testimonials", title: c.reviews, items: c.quotes.map(([quote, author]) => ({ quote, author })), style: { background: "muted" } }),
      s({ type: "newsletter", title: c.newsletter }),
    ],
    editorial: [
      hero({ height: "large", align: "center", style: { background: "inverse" } }),
      s({ type: "rich-text", title: c.manifesto, body: c.manifestoBody, style: { spacing: "roomy", width: "narrow" } }),
      s({ type: "image-text", title: c.storyTitle, body: c.storyBody, imagePosition: "right" }),
      featured,
      s({ type: "faq", title: c.faqTitle, items: c.faq.map(([q, a]) => ({ q, a })) }),
    ],
    minimal: [
      hero({ height: "small" }),
      featured,
      s({ type: "collections", limit: 3 }),
    ],
  };
  return parseSections(layouts[id]) ?? [blankSection("hero")];
}

/** Theme JSON for a new store: a preset's look plus a starter homepage. */
export function starterTheme(presetId: string, starter: StarterId, storeName: string, locale: string) {
  const p = THEME_PRESETS.find((x) => x.id === presetId) ?? THEME_PRESETS[0];
  const { id: _id, name: _name, ...look } = p;
  void _id; void _name;
  return { ...look, sections: starterSections(starter, storeName, locale) };
}
