import { describe, expect, it } from "vitest";
import { checkVatNumber } from "@/lib/vat-id";

describe("VAT number check", () => {
  it("validates Italian partita IVA with its check digit", () => {
    expect(checkVatNumber("IT 00743110157", "IT")).toEqual({ ok: true, normalized: "IT00743110157" }); // Pirelli
    expect(checkVatNumber("00743110158", "IT")).toEqual({ ok: false, reason: "checksum" });
    expect(checkVatNumber("12345", "IT")).toEqual({ ok: false, reason: "format" });
  });
  it("validates Romanian CUI with its check digit", () => {
    expect(checkVatNumber("RO18547290", "RO")).toEqual({ ok: true, normalized: "RO18547290" });
    expect(checkVatNumber("ro 1854729-0", "RO").ok).toBe(true);
    expect(checkVatNumber("18547291", "RO")).toEqual({ ok: false, reason: "checksum" });
  });
  it("format-checks other countries", () => {
    expect(checkVatNumber("DE123456789", "DE")).toEqual({ ok: true, normalized: "DE123456789" });
    expect(checkVatNumber("@@", "FR")).toEqual({ ok: false, reason: "format" });
  });
});
