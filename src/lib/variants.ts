/** Pure helpers shared by the product editor (client) and the server. */

export type OptionDef = { name: string; values: string[] };

/** Cartesian product of option values → list of [v1, v2?, v3?]. Max 3 options (like Shopify). */
export function variantCombos(options: OptionDef[]): string[][] {
  const opts = options.filter((o) => o.name.trim() && o.values.length > 0).slice(0, 3);
  if (opts.length === 0) return [];
  return opts.reduce<string[][]>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => [...combo, v])),
    [[]],
  );
}

export function comboKey(values: (string | null | undefined)[]): string {
  return values.filter((v) => v !== null && v !== undefined && v !== "").join(" / ");
}

/** Variant title as shown to customers, e.g. "Red / M". */
export function variantTitle(values: (string | null | undefined)[]): string {
  return comboKey(values) || "Default";
}

export const MAX_VARIANTS = 100;
