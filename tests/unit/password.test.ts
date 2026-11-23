import { describe, expect, it } from "vitest";
import { passwordIssue } from "@/lib/auth/password";

describe("password policy (NIST 800-63B)", () => {
  it("accepts long, uncommon passwords and passphrases", () => {
    expect(passwordIssue("correct horse battery")).toBeNull();
    expect(passwordIssue("Tramonto-sul-mare-7")).toBeNull();
  });
  it("rejects short, common and repetitive passwords", () => {
    expect(passwordIssue("short")).toBe("length");
    expect(passwordIssue("Password123")).toBe("common");
    expect(passwordIssue("aaaaaaaaaa")).toBe("common");
    expect(passwordIssue("1234567890xyz")).toBe("common");
  });
  it("rejects passwords built from the account's email or name", () => {
    expect(passwordIssue("mario.rossi2026", { email: "mario.rossi@example.com" })).toBe("personal");
    expect(passwordIssue("MarioRossi!!", { name: "Mario Rossi" })).toBe("personal");
  });
});
