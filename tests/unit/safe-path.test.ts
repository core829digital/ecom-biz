import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "@/lib/safe-path";

describe("open-redirect guard", () => {
  it("allows same-origin paths", () => {
    expect(isSafeRelativePath("/admin/demo?x=1")).toBe(true);
    expect(isSafeRelativePath("/")).toBe(true);
  });
  it("blocks every way of leaving the origin", () => {
    for (const p of ["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com", "evil.com", "/\tevil", "/%0d%0a".replace("%0d%0a", "\r\n"), "", null, undefined]) {
      expect(isSafeRelativePath(p as string)).toBe(false);
    }
  });
});
