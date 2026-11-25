/**
 * VAT number checks used in onboarding and settings. Italy and Romania are verified with their
 * official check digit; other countries get a format check. This catches typos, it does not
 * prove the number is registered (that is the VIES service, an optional later step).
 */
export type VatCheck = { ok: true; normalized: string } | { ok: false; reason: "format" | "checksum" };

export function checkVatNumber(input: string, country: string): VatCheck {
  const cc = country.toUpperCase();
  let v = input.toUpperCase().replace(/[\s.\-/]/g, "");
  if (v.startsWith(cc) || (cc === "GR" && v.startsWith("EL"))) v = v.slice(2);
  if (cc === "IT") {
    if (!/^\d{11}$/.test(v)) return { ok: false, reason: "format" };
    return italianChecksum(v) ? { ok: true, normalized: `IT${v}` } : { ok: false, reason: "checksum" };
  }
  if (cc === "RO") {
    if (!/^\d{2,10}$/.test(v)) return { ok: false, reason: "format" };
    return romanianChecksum(v) ? { ok: true, normalized: `RO${v}` } : { ok: false, reason: "checksum" };
  }
  return /^[A-Z0-9]{4,15}$/.test(v) ? { ok: true, normalized: `${cc}${v}` } : { ok: false, reason: "format" };
}

/** Partita IVA: Luhn-like check on 11 digits. */
function italianChecksum(v: string) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(v[10]);
}

/** CUI/CIF: weights 7,5,3,2,1,7,5,3,2 right-aligned, ×10 mod 11 (10 → 0). */
function romanianChecksum(v: string) {
  const digits = v.padStart(10, "0");
  const w = [7, 5, 3, 2, 1, 7, 5, 3, 2];
  const sum = w.reduce((s, k, i) => s + k * Number(digits[i]), 0);
  const c = ((sum * 10) % 11) % 10;
  return c === Number(digits[9]);
}
