import type { Prisma } from "@prisma/client";

export type RuleField = "tag" | "type" | "vendor" | "title" | "price";
export type RuleOp = "eq" | "neq" | "contains" | "gt" | "lt";
export type CollectionRule = { field: RuleField; op: RuleOp; value: string };

export const RULE_FIELDS: RuleField[] = ["tag", "type", "vendor", "title", "price"];
export const RULE_OPS: Record<RuleField, RuleOp[]> = {
  tag: ["eq", "neq"],
  type: ["eq", "neq", "contains"],
  vendor: ["eq", "neq", "contains"],
  title: ["eq", "neq", "contains"],
  price: ["gt", "lt"],
};

export function parseRules(json: unknown): CollectionRule[] {
  if (!Array.isArray(json)) return [];
  return json.filter(
    (r): r is CollectionRule =>
      r && typeof r === "object" && RULE_FIELDS.includes(r.field) && RULE_OPS[r.field as RuleField]?.includes(r.op) && typeof r.value === "string",
  );
}

/** Translate one smart-collection rule into a Prisma filter on Product. */
export function ruleToWhere(rule: CollectionRule): Prisma.ProductWhereInput {
  const v = rule.value.trim();
  const ci = { mode: "insensitive" as const };
  switch (rule.field) {
    case "tag":
      return rule.op === "eq" ? { tags: { has: v } } : { NOT: { tags: { has: v } } };
    case "type":
    case "vendor":
    case "title": {
      const col = rule.field === "type" ? "productType" : rule.field;
      if (rule.op === "eq") return { [col]: { equals: v, ...ci } };
      if (rule.op === "neq") return { NOT: { [col]: { equals: v, ...ci } } };
      return { [col]: { contains: v, ...ci } };
    }
    case "price": {
      const cents = Math.round(parseFloat(v.replace(",", ".")) * 100);
      if (!Number.isFinite(cents)) return {};
      return { variants: { some: { priceCents: rule.op === "gt" ? { gt: cents } : { lt: cents } } } };
    }
  }
}

export function smartCollectionWhere(rules: CollectionRule[], matchAll: boolean): Prisma.ProductWhereInput {
  if (rules.length === 0) return { id: "__none__" };
  const parts = rules.map(ruleToWhere);
  return matchAll ? { AND: parts } : { OR: parts };
}

export const COLLECTION_SORTS = ["manual", "newest", "price-asc", "price-desc", "title-asc"] as const;
export type CollectionSort = (typeof COLLECTION_SORTS)[number];
