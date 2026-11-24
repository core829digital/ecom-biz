import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { env } from "@/lib/env";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("store address", () => {
  it("uses paths when stores share the platform host (e.g. *.vercel.app)", () => {
    process.env.APP_URL = "https://ecom-biz-tau.vercel.app";
    process.env.STOREFRONT_ROOT_DOMAIN = "ecom-biz-tau.vercel.app";
    expect(env.storefrontPathMode).toBe(true);
    expect(env.storeAddress("bottega")).toBe("ecom-biz-tau.vercel.app/sites/bottega");
  });
  it("uses subdomains with a dedicated root domain and on localhost", () => {
    process.env.APP_URL = "https://app.brand.com";
    process.env.STOREFRONT_ROOT_DOMAIN = "brand.com";
    expect(env.storeAddress("bottega")).toBe("bottega.brand.com");
    process.env.APP_URL = "http://localhost:3000";
    process.env.STOREFRONT_ROOT_DOMAIN = "localhost:3000";
    expect(env.storefrontPathMode).toBe(false);
    expect(env.storeAddress("demo")).toBe("demo.localhost:3000");
  });
});
