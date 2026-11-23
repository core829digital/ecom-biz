import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: () => {} }));
const { signWebhook } = await import("@/server/webhooks");

describe("outgoing webhook signature", () => {
  it("authenticates the timestamp together with the body", () => {
    const body = '{"id":"1"}';
    const sig = signWebhook("whsec", 1700000000, body);
    expect(sig).toBe(createHmac("sha256", "whsec").update(`1700000000.${body}`).digest("base64"));
    // A replay with a fresh timestamp no longer matches.
    expect(signWebhook("whsec", 1700009999, body)).not.toBe(sig);
    // A tampered body doesn't match either.
    expect(signWebhook("whsec", 1700000000, '{"id":"2"}')).not.toBe(sig);
  });
});
