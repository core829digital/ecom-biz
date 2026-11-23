import { apiRoute } from "@/server/api";
import { storePublicUrl } from "@/lib/tenant";

export const GET = apiRoute(null, async ({ store, scopes }) =>
  Response.json({
    data: {
      id: store.id,
      name: store.name,
      email: store.email,
      currency: store.currency,
      locale: store.locale,
      timezone: store.timezone,
      country_code: store.countryCode,
      taxes_included: store.taxesIncluded,
      url: await storePublicUrl(store),
      token_scopes: scopes,
    },
  }),
);
