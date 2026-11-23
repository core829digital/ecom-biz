import { expect, test } from "@playwright/test";

const APP = process.env.E2E_BASE_URL || "http://localhost:3000";
const DEMO_HOST = `demo.${new URL(APP).host}`;

test("security headers on admin, storefront and API", async ({ request }) => {
  // The storefront is reached via its Host header (Node can't resolve *.localhost).
  for (const [url, host] of [[`${APP}/login`, undefined], [`${APP}/`, DEMO_HOST]] as const) {
    const get = () => request.get(url, host ? { headers: { host } } : undefined);
    const h = (await get()).headers();
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
    expect(h["x-powered-by"]).toBeUndefined();
    // A fresh nonce on every response.
    expect((await get()).headers()["content-security-policy"]).not.toBe(h["content-security-policy"]);
  }
  const api = (await request.get(`${APP}/api/health`)).headers();
  expect(api["x-content-type-options"]).toBe("nosniff");
  expect(api["cache-control"]).toContain("no-store");
});
