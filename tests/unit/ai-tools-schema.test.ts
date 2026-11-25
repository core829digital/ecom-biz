import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { toolSpecs } = await import("@/server/ai/tools");

/** Every object schema must declare properties: Gemini rejects the whole request otherwise. */
function emptyObjects(schema: unknown, path: string, out: string[]) {
  if (!schema || typeof schema !== "object") return out;
  const s = schema as Record<string, unknown>;
  if (s.type === "object" && (!s.properties || Object.keys(s.properties as object).length === 0)) out.push(path);
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === "object") emptyObjects(v, `${path}.${k}`, out);
  }
  return out;
}

describe("AI tool definitions", () => {
  it("are accepted by strict providers (no empty object schemas, valid names)", () => {
    const specs = toolSpecs();
    expect(specs.length).toBeGreaterThan(10);
    for (const s of specs) {
      expect(s.function.name).toMatch(/^[a-z_]{3,64}$/);
      expect(emptyObjects(s.function.parameters, s.function.name, [])).toEqual([]);
    }
  });
});
