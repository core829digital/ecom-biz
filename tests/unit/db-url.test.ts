import { describe, expect, it } from "vitest";
import { prismaDatabaseUrl } from "@/lib/db-url";

describe("prismaDatabaseUrl", () => {
  it("adds pooler parameters to Neon pooled URLs", () => {
    const u = new URL(prismaDatabaseUrl("postgresql://u:p@ep-x-123-pooler.eu-central-1.aws.neon.tech/db?sslmode=require")!);
    expect(u.searchParams.get("pgbouncer")).toBe("true");
    expect(u.searchParams.get("connection_limit")).toBe("5");
    expect(u.searchParams.get("sslmode")).toBe("require");
  });
  it("keeps explicit settings and leaves direct URLs alone", () => {
    expect(prismaDatabaseUrl("postgresql://u:p@ep-x-pooler.neon.tech/db?connection_limit=10")).toContain("connection_limit=10");
    const direct = "postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db?sslmode=require";
    expect(prismaDatabaseUrl(direct)).toBe(direct);
    expect(prismaDatabaseUrl(undefined)).toBeUndefined();
  });
});
