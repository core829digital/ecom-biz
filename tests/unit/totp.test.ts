import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, hotp, otpauthUri, totp, verifyTotp } from "@/lib/totp";
import { open, seal } from "@/lib/secret-box";

// RFC 6238 Appendix B test secret (ASCII "12345678901234567890").
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches RFC 4226 HOTP vectors", () => {
    const key = Buffer.from("12345678901234567890");
    expect([0, 1, 2, 9].map((c) => hotp(key, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });
  it("matches RFC 6238 TOTP vectors (8 digits, SHA-1)", () => {
    expect(totp(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totp(RFC_SECRET, 1111111109_000, 8)).toBe("07081804");
    expect(totp(RFC_SECRET, 1234567890_000, 8)).toBe("89005924");
    expect(totp(RFC_SECRET, 20000000000_000, 8)).toBe("65353130");
  });
  it("verifies with ±1 step drift and rejects others", () => {
    const now = 1_700_000_000_000;
    const code = totp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", now)).toBe(false);
  });
  it("round-trips base32 and builds otpauth URIs", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253]);
    expect(base32Decode(base32Encode(buf))).toEqual(buf);
    expect(otpauthUri("ABC", "a@b.c", "My Shop")).toBe("otpauth://totp/My%20Shop%3Aa%40b.c?secret=ABC&issuer=My%20Shop&algorithm=SHA1&digits=6&period=30");
  });
  it("generates unique recovery codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((c) => /^[a-z2-9]{4}-[a-z2-9]{4}$/.test(c))).toBe(true);
  });
});

describe("secret box", () => {
  it("encrypts with authentication", () => {
    process.env.APP_SECRET = "x".repeat(40);
    const sealed = seal("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DP");
    expect(open(sealed)).toBe("JBSWY3DPEHPK3PXP");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join("."))).toThrow();
  });
});
