/** All money is integer minor units. These helpers are the only place formatting happens. */

export function formatMoney(cents: number, currency: string, locale = "en"): string {
  return new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Parse a user-entered decimal amount ("12,50" or "12.50") into cents. Returns null if invalid. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const normalized = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, frac = ""] = normalized.split(".");
  return parseInt(whole, 10) * 100 + parseInt(frac.padEnd(2, "0"), 10);
}

/** Cents → plain decimal string for form inputs ("1250" → "12.50"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Percentage in basis points of an amount, rounded half-up. */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10000);
}
