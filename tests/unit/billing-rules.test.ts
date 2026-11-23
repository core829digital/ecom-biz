import { describe, expect, it } from "vitest";
import { accountActive, isDisposableEmail, mapStripeStatus, normalizeEmail, storesWithinLimit, trialDecision } from "@/lib/billing-rules";

const day = 86_400_000;
const now = new Date("2026-11-23T12:00:00Z");

describe("accountActive", () => {
  it("covers every status", () => {
    expect(accountActive({ subscriptionStatus: "ACTIVE", trialEndsAt: null }, now)).toBe(true);
    expect(accountActive({ subscriptionStatus: "TRIALING", trialEndsAt: new Date(now.getTime() + day) }, now)).toBe(true);
    expect(accountActive({ subscriptionStatus: "TRIALING", trialEndsAt: new Date(now.getTime() - 1) }, now)).toBe(false);
    expect(accountActive({ subscriptionStatus: "PAST_DUE", trialEndsAt: null, pastDueSince: new Date(now.getTime() - 6 * day) }, now)).toBe(true);
    expect(accountActive({ subscriptionStatus: "PAST_DUE", trialEndsAt: null, pastDueSince: new Date(now.getTime() - 8 * day) }, now)).toBe(false);
    expect(accountActive({ subscriptionStatus: "CANCELED", trialEndsAt: null }, now)).toBe(false);
    expect(accountActive({ subscriptionStatus: "NONE", trialEndsAt: null }, now)).toBe(false);
  });
  it("a hold wins over any status", () => {
    expect(accountActive({ subscriptionStatus: "ACTIVE", trialEndsAt: null, billingHold: true }, now)).toBe(false);
  });
});

describe("storesWithinLimit", () => {
  it("keeps the oldest stores open after a downgrade", () => {
    const stores = [
      { id: "c", createdAt: new Date(3) },
      { id: "a", createdAt: new Date(1) },
      { id: "b", createdAt: new Date(2) },
    ];
    expect([...storesWithinLimit(stores, 2)].sort()).toEqual(["a", "b"]);
    expect(storesWithinLimit(stores, 0).size).toBe(0);
  });
});

describe("email identity", () => {
  it("normalizes tricks that create 'new' addresses", () => {
    expect(normalizeEmail("J.O.H.N+trial@GoogleMail.com")).toBe("john@gmail.com");
    expect(normalizeEmail("john+2@company.it")).toBe("john@company.it");
    expect(normalizeEmail("j.ohn@company.it")).toBe("j.ohn@company.it"); // dots matter outside Gmail
  });
  it("detects disposable inboxes, including subdomains", () => {
    expect(isDisposableEmail("x@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@eu.mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@company.com")).toBe(false);
  });
});

describe("trialDecision", () => {
  const base = { planTrialDays: 14, trialUsedAt: null, email: "a@company.com", emailClaimed: false, networkClaimsInWindow: 0 };
  it("grants a first trial", () => expect(trialDecision(base)).toEqual({ trialDays: 14 }));
  it("denies every abuse path", () => {
    expect(trialDecision({ ...base, trialUsedAt: new Date() }).denied).toBe("already_used");
    expect(trialDecision({ ...base, emailClaimed: true }).denied).toBe("email_used");
    expect(trialDecision({ ...base, email: "a@yopmail.com" }).denied).toBe("disposable_email");
    expect(trialDecision({ ...base, networkClaimsInWindow: 3 }).denied).toBe("network_limit");
    expect(trialDecision({ ...base, planTrialDays: 0 }).denied).toBe("trial_disabled");
  });
});

describe("mapStripeStatus", () => {
  it("gives no access before the first payment and after the end", () => {
    expect(mapStripeStatus("incomplete")).toBe("NONE");
    expect(mapStripeStatus("incomplete_expired")).toBe("CANCELED");
    expect(mapStripeStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStripeStatus("paused")).toBe("CANCELED");
  });
});
