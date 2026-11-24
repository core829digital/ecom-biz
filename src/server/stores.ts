import "server-only";
import { db } from "@/lib/db";
import { EU_STANDARD_VAT_BPS } from "@/lib/geo";
import { starterTheme, type StarterId } from "@/lib/theme-starters";

export type NewStoreInput = {
  ownerId: string;
  name: string;
  slug: string;
  email: string;
  currency: string;
  locale: string;
  countryCode: string;
  /** Look and starter homepage chosen during onboarding. */
  preset?: string;
  starter?: StarterId;
};

/** Creates a store with sensible defaults so a merchant can sell immediately. */
export async function createStore(input: NewStoreInput) {
  const isEU = input.countryCode in EU_STANDARD_VAT_BPS;

  return db.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        name: input.name,
        slug: input.slug,
        email: input.email,
        currency: input.currency,
        locale: input.locale,
        countryCode: input.countryCode,
        taxesIncluded: isEU,
        theme: JSON.parse(JSON.stringify(starterTheme(input.preset ?? "minimal", input.starter ?? "classic", input.name, input.locale))),
        manualPayments: {
          cod: { enabled: false, instructions: "" },
          bankTransfer: { enabled: false, instructions: "" },
        },
        memberships: { create: { userId: input.ownerId, role: "OWNER" } },
        shippingZones: {
          create: [
            {
              name: "Domestic",
              countries: [input.countryCode],
              rates: { create: [{ name: "Standard", priceCents: 0 }] },
            },
          ],
        },
        menus: {
          create: [
            { handle: "main", title: "Main menu", items: [{ title: "Home", url: "/" }, { title: "Catalog", url: "/collections/all" }] },
            { handle: "footer", title: "Footer menu", items: [{ title: "Search", url: "/search" }] },
          ],
        },
      },
    });
    const vat = EU_STANDARD_VAT_BPS[input.countryCode];
    if (vat) {
      await tx.taxRate.create({ data: { storeId: store.id, countryCode: input.countryCode, name: "VAT", rateBps: vat } });
    }
    return store;
  });
}
