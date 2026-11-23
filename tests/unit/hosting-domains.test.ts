import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ENV = { VERCEL_API_TOKEN: "tok", VERCEL_PROJECT_ID: "prj_1", VERCEL_TEAM_ID: "team_1" };

async function load() {
  vi.resetModules();
  return import("@/server/hosting-domains");
}

describe("hosting domains (Vercel)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing when Vercel is not configured", async () => {
    const m = await load();
    expect(m.hostingDomainsEnabled()).toBe(false);
    await m.registerHostingDomain("shop.example.com");
    await m.unregisterHostingDomain("shop.example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds a domain to the project with the team scope", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const m = await load();
    await m.registerHostingDomain("shop.example.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.vercel.com/v10/projects/prj_1/domains?teamId=team_1");
    expect(init).toMatchObject({ method: "POST", headers: { Authorization: "Bearer tok" } });
    expect(JSON.parse(init.body)).toEqual({ name: "shop.example.com" });
  });

  it("treats a domain already on this project as success", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "domain_already_in_use" } }), { status: 409 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const m = await load();
    await expect(m.registerHostingDomain("shop.example.com")).resolves.toBeUndefined();
  });

  it("surfaces provider errors", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "forbidden", message: "Not authorized" } }), { status: 403 }));
    const m = await load();
    await expect(m.registerHostingDomain("shop.example.com")).rejects.toBeInstanceOf(m.HostingDomainError);
  });

  it("never throws on removal", async () => {
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const m = await load();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(m.unregisterHostingDomain("shop.example.com")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
