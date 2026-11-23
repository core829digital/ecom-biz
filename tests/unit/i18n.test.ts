import { describe, expect, it } from "vitest";
import { getTranslator } from "@/lib/i18n";
import { en } from "@/lib/i18n/en";
import { it as itDict } from "@/lib/i18n/it";

describe("translator", () => {
  it("fills placeholders", () => {
    expect(getTranslator("en")("orders.number", { number: 1042 })).toBe("Order #1042");
  });

  it("uses the .one variant when count is 1", () => {
    const t = getTranslator("it");
    expect(t("dashboard.ordersCount", { count: 1 })).toBe("1 ordine");
    expect(t("dashboard.ordersCount", { count: 0 })).toBe("0 ordini");
    expect(t("dashboard.ordersCount", { count: 5 })).toBe("5 ordini");
  });

  it("falls back to the plural form when no .one variant exists", () => {
    expect(getTranslator("en")("staff.members", { count: 1 })).toBe("Members (1)");
  });

  it("keeps the same placeholders in every language", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const mismatched = (Object.keys(en) as (keyof typeof en)[]).filter((k) => vars(en[k]) !== vars(itDict[k]));
    expect(mismatched).toEqual([]);
  });
});
