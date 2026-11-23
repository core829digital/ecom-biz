import "server-only";
import { db } from "@/lib/db";
import { COUNTRY_CODES } from "@/lib/geo";

/** Countries the store ships to ("*" in any zone = everywhere). */
export async function shippableCountries(storeId: string): Promise<string[]> {
  const zones = await db.shippingZone.findMany({ where: { storeId, rates: { some: {} } }, select: { countries: true } });
  const all = new Set(zones.flatMap((z) => z.countries));
  if (all.has("*")) return COUNTRY_CODES;
  return COUNTRY_CODES.filter((c) => all.has(c));
}

export type RateOption = { id: string; title: string; priceCents: number };

/**
 * Rates for a destination: zones listing the country explicitly win over
 * a rest-of-world ("*") zone. Conditions are evaluated on the item subtotal.
 */
export async function ratesFor(storeId: string, countryCode: string, subtotalCents: number): Promise<RateOption[]> {
  const zones = await db.shippingZone.findMany({ where: { storeId }, include: { rates: true } });
  const specific = zones.filter((z) => z.countries.includes(countryCode));
  const chosen = specific.length ? specific : zones.filter((z) => z.countries.includes("*"));
  return chosen
    .flatMap((z) => z.rates)
    .filter((r) => (r.minSubtotalCents === null || subtotalCents >= r.minSubtotalCents) && (r.maxSubtotalCents === null || subtotalCents <= r.maxSubtotalCents))
    .sort((a, b) => a.priceCents - b.priceCents)
    .map((r) => ({ id: r.id, title: r.name, priceCents: r.priceCents }));
}

export async function taxRateFor(storeId: string, countryCode: string): Promise<number> {
  const rate = await db.taxRate.findUnique({ where: { storeId_countryCode: { storeId, countryCode } } });
  return rate?.rateBps ?? 0;
}
