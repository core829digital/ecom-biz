/** AI assistant end to end against the real database, with a scripted OpenAI-compatible provider. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.AI_API_KEY = "test-key";
process.env.AI_BASE_URL = "https://ai.test/v1";
process.env.AI_DAILY_LIMIT = "3";

const { db } = await import("@/lib/db");
const { ask, AssistantError, loadConversation } = await import("@/server/ai/assistant");
const { runTool } = await import("@/server/ai/tools");
const { themeDraft, parseTheme } = await import("@/lib/theme");

type Reply = { content?: string; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] };
let script: Reply[] = [];
const requests: { messages: { role: string; content: string | null }[]; tools?: unknown[] }[] = [];
vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string; headers: Record<string, string> }) => {
  expect(init.headers.Authorization).toBe("Bearer test-key");
  requests.push(JSON.parse(init.body));
  const next = script.shift() ?? { content: "ok" };
  return new Response(JSON.stringify({ choices: [{ message: { content: next.content ?? null, tool_calls: next.tool_calls } }] }), { status: 200 });
}));
const call = (id: string, name: string, args: unknown) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

const run = Date.now().toString(36);
let storeId = "";
let userId = "";
beforeEach(() => { requests.length = 0; });
afterAll(async () => {
  await db.store.deleteMany({ where: { id: storeId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.rateLimit.deleteMany({ where: { key: `ai:${storeId}` } });
  await db.$disconnect();
});

describe("assistant", () => {
  it("builds a store: draft products, homepage draft, memory, persisted chat with action chips", async () => {
    const user = await db.user.create({ data: { email: `ai${run}@example.com`, name: "AI Tester", passwordHash: "x" } });
    userId = user.id;
    const store = await db.store.create({ data: { slug: `ai${run}`.slice(0, 30), name: "Bottega Luna", email: "s@example.com", locale: "it", memberships: { create: { userId: user.id, role: "OWNER" } } } });
    storeId = store.id;
    script = [
      { tool_calls: [
        call("c1", "create_products", { products: [{ title: "Candela al fico", description: "Cera di soia.", price: 24.9, stock: 10 }, { title: "Candela al legno", price: "19,50" }] }),
        call("c2", "design_homepage", { sections: [{ type: "hero", title: "Candele fatte a mano", ctaLabel: "Scopri" }, { type: "features", items: [{ title: "Cera di soia", body: "Naturale" }] }, { type: "not-a-section" }] }),
        call("c3", "remember", { profile: "Candele artigianali per regali", fact: "Tono caldo e informale" }),
      ] },
      { content: "Fatto: ho creato **2 prodotti** e la homepage in bozza." },
    ];
    const res = await ask(store, user.id, null, "Costruisci il mio negozio di candele", "/admin/x");
    expect(res.message.content).toContain("2 prodotti");
    expect(res.message.actions.map((a) => a.label)).toEqual(["products:2", "homepage", "memory"]);

    const products = await db.product.findMany({ where: { storeId }, include: { variants: true }, orderBy: { title: "asc" } });
    expect(products.map((p) => [p.title, p.status, p.variants[0].priceCents])).toEqual([["Candela al fico", "DRAFT", 2490], ["Candela al legno", "DRAFT", 1950]]);

    const fresh = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(themeDraft(fresh.theme)?.sections.map((s) => s.type)).toEqual(["hero", "features"]);
    expect(parseTheme(fresh.theme).sections.map((s) => s.type)).toEqual(["hero", "featured-products", "collections"]); // published one untouched

    const mem = await db.aiMemory.findUniqueOrThrow({ where: { storeId } });
    expect(mem.profile).toContain("Candele");
    expect(mem.facts).toEqual(["Tono caldo e informale"]);

    // The system prompt of the next request carries the memory; history carries tool calls.
    script = [{ content: "Certo." }];
    requests.length = 0;
    await ask(store, user.id, res.conversationId, "E adesso?", "/admin/x");
    const sys = requests[0].messages[0];
    expect(sys.role).toBe("system");
    expect(sys.content).toContain("Tono caldo e informale");
    expect(requests[0].messages.some((m) => m.role === "tool")).toBe(true);

    const conv = await loadConversation(storeId, user.id, res.conversationId);
    expect(conv?.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(await loadConversation(storeId, "someone-else", res.conversationId)).toBeNull();
  });

  it("handles providers that return tool calls without ids", async () => {
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    script = [{ tool_calls: [{ id: "", type: "function", function: { name: "get_store_overview", arguments: "{}" } }] }, { content: "Ecco il riepilogo." }];
    requests.length = 0;
    const res = await ask(store, userId, null, "Riepilogo?", "/admin/x");
    expect(res.message.content).toBe("Ecco il riepilogo.");
    const followUp = requests[1].messages as { role: string; tool_call_id?: string; tool_calls?: { id: string }[] }[];
    const call = followUp.find((m) => m.role === "assistant" && m.tool_calls)!.tool_calls![0];
    expect(call.id).not.toBe("");
    expect(followUp.find((m) => m.role === "tool")?.tool_call_id).toBe(call.id);
    await db.rateLimit.deleteMany({ where: { key: `ai:${storeId}` } });
  });

  it("enforces the daily quota per store", async () => {
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    await db.rateLimit.deleteMany({ where: { key: `ai:${storeId}` } });
    for (const n of ["uno", "due", "tre"]) {
      script = [{ content: n }];
      await ask(store, userId, null, n, "/admin/x"); // 3 of 3 allowed
    }
    await expect(ask(store, userId, null, "quarto", "/admin/x")).rejects.toMatchObject({ code: "quota" });
    expect(AssistantError).toBeDefined();
  });

  it("tools refuse unsafe changes and bad input instead of crashing", async () => {
    const store = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    const ctx = { store, userId, adminBase: "/admin/x" };
    const p = await db.product.findFirstOrThrow({ where: { storeId } });
    await db.product.update({ where: { id: p.id }, data: { status: "ACTIVE" } });
    expect((await runTool("update_product", JSON.stringify({ productId: p.id, price: 1 }), ctx)).result).toMatchObject({ error: expect.stringContaining("on sale") });
    expect((await runTool("update_product", JSON.stringify({ productId: "other-store-product", title: "x" }), ctx)).result).toMatchObject({ error: "Product not found" });
    expect((await runTool("delete_everything", "{}", ctx)).result).toMatchObject({ error: expect.stringContaining("Unknown tool") });
    expect((await runTool("create_discount", "{not json", ctx)).result).toMatchObject({ error: expect.stringContaining("JSON") });
    const d = await runTool("create_discount", JSON.stringify({ code: "BENVENUTO10", type: "PERCENTAGE", value: 10 }), ctx);
    expect(d.result).toMatchObject({ code: "BENVENUTO10", active: false });
    expect((await db.discount.findFirstOrThrow({ where: { storeId, code: "BENVENUTO10" } })).value).toBe(1000);
  });
});
