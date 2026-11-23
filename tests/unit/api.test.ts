import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { apiProductCreate, apiProductUpdate } from "@/server/api-products";

describe("API product schemas", () => {
  it("PATCH leaves omitted fields undefined (regression: defaults must not reset data)", () => {
    const parsed = apiProductUpdate.parse({ title: "New title" });
    expect(parsed).toEqual({ title: "New title" });
    expect(parsed.status).toBeUndefined();
    expect(parsed.tags).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });
  it("create applies sensible defaults", () => {
    const parsed = apiProductCreate.parse({ title: "Mug", variants: [{ price: 100 }] });
    expect(parsed.status).toBe("draft");
    expect(parsed.tags).toEqual([]);
    expect(parsed.options).toEqual([]);
  });
  it("rejects non-https images and negative prices", () => {
    expect(apiProductCreate.safeParse({ title: "x", variants: [{ price: -1 }] }).success).toBe(false);
    expect(apiProductCreate.safeParse({ title: "x", variants: [{ price: 1 }], images: [{ url: "http://x.y/a.png" }] }).success).toBe(false);
  });
});
