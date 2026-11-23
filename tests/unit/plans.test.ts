import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { accountActive, limitsOf } from "@/server/plans";
import type { Plan } from "@prisma/client";

const plan = (over: Partial<Plan> = {}) => ({ maxStores: 3, maxProducts: null, maxStaff: 5, allowCustomDomain: true, allowApi: false, ...over }) as Plan;

describe("plan entitlements", () => {
  it("treats active subscriptions and unexpired trials as active", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(accountActive({ subscriptionStatus: "ACTIVE", trialEndsAt: null }, now)).toBe(true);
    expect(accountActive({ subscriptionStatus: "TRIALING", trialEndsAt: new Date("2026-06-02") }, now)).toBe(true);
    expect(accountActive({ subscriptionStatus: "TRIALING", trialEndsAt: new Date("2026-05-31") }, now)).toBe(false);
    expect(accountActive({ subscriptionStatus: "PAST_DUE", trialEndsAt: null }, now)).toBe(false);
    expect(accountActive({ subscriptionStatus: "CANCELED", trialEndsAt: null }, now)).toBe(false);
  });
  it("maps plan limits, with safe defaults when there is no plan", () => {
    expect(limitsOf(plan())).toEqual({ stores: 3, products: null, staff: 5, customDomain: true, api: false });
    expect(limitsOf(null)).toEqual({ stores: 1, products: null, staff: null, customDomain: false, api: false });
  });
});
