import { describe, expect, it } from "vitest";
import { comboKey, variantCombos, variantTitle } from "@/lib/variants";
import { parseRules, ruleToWhere, smartCollectionWhere } from "@/lib/collections";
import { parseCsv, toCsv } from "@/lib/csv";
import { applyBps, centsToInput, parseMoney } from "@/lib/money";
import { handleize, isValidStoreSlug } from "@/lib/slug";

describe("variants", () => {
  it("builds the cartesian product of options", () => {
    const combos = variantCombos([
      { name: "Size", values: ["S", "M"] },
      { name: "Color", values: ["Red", "Blue"] },
    ]);
    expect(combos).toEqual([["S", "Red"], ["S", "Blue"], ["M", "Red"], ["M", "Blue"]]);
  });
  it("ignores incomplete options and caps at 3", () => {
    expect(variantCombos([{ name: "", values: ["x"] }, { name: "Size", values: [] }])).toEqual([]);
    const four = variantCombos([1, 2, 3, 4].map((n) => ({ name: `O${n}`, values: ["a"] })));
    expect(four[0]).toHaveLength(3);
  });
  it("formats titles", () => {
    expect(variantTitle(["Red", "M", null])).toBe("Red / M");
    expect(variantTitle([null, null, null])).toBe("Default");
    expect(comboKey(["a", undefined, ""])).toBe("a");
  });
});

describe("smart collection rules", () => {
  it("drops malformed rules", () => {
    expect(parseRules([{ field: "tag", op: "eq", value: "x" }, { field: "tag", op: "gt", value: "x" }, { field: "evil", op: "eq", value: "x" }, null])).toHaveLength(1);
    expect(parseRules("nope")).toEqual([]);
  });
  it("maps rules to prisma filters", () => {
    expect(ruleToWhere({ field: "tag", op: "eq", value: "sale" })).toEqual({ tags: { has: "sale" } });
    expect(ruleToWhere({ field: "type", op: "contains", value: "Shirt" })).toEqual({ productType: { contains: "Shirt", mode: "insensitive" } });
    expect(ruleToWhere({ field: "price", op: "gt", value: "19,90" })).toEqual({ variants: { some: { priceCents: { gt: 1990 } } } });
  });
  it("matches nothing without rules and supports any/all", () => {
    expect(smartCollectionWhere([], true)).toEqual({ id: "__none__" });
    const rules = parseRules([{ field: "tag", op: "eq", value: "a" }, { field: "vendor", op: "eq", value: "b" }]);
    expect(Object.keys(smartCollectionWhere(rules, true))).toEqual(["AND"]);
    expect(Object.keys(smartCollectionWhere(rules, false))).toEqual(["OR"]);
  });
});

describe("csv", () => {
  it("parses quotes, escaped quotes, CRLF and embedded newlines", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","He said ""hi""","line1\nline2"\r\n\r\n');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'He said "hi"', "line1\nline2"]]);
  });
  it("round-trips and neutralizes formula injection", () => {
    const csv = toCsv([["=HYPERLINK(\"x\")", "+1", "plain", 'q"uote']]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'+1");
    const back = parseCsv(csv);
    expect(back[0][2]).toBe("plain");
    expect(back[0][3]).toBe('q"uote');
  });
});

describe("money", () => {
  it("parses decimal input in both locales", () => {
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("12,50")).toBe(1250);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("1 234.99")).toBe(123499);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
  it("formats for inputs and applies basis points", () => {
    expect(centsToInput(1990)).toBe("19.90");
    expect(centsToInput(null)).toBe("");
    expect(applyBps(10000, 2100)).toBe(2100);
    expect(applyBps(333, 1000)).toBe(33);
  });
});

describe("slugs", () => {
  it("handleizes unicode titles", () => {
    expect(handleize("Tricou Bărbați — Ediție Specială!")).toBe("tricou-barbati-editie-speciala");
    expect(handleize("  Caffè   Latte ")).toBe("caffe-latte");
  });
  it("validates store slugs and reserved words", () => {
    expect(isValidStoreSlug("my-shop")).toBe(true);
    expect(isValidStoreSlug("admin")).toBe(false);
    expect(isValidStoreSlug("-bad")).toBe(false);
    expect(isValidStoreSlug("ab")).toBe(false);
  });
});
