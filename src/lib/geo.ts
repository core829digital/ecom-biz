/** ISO 3166-1 alpha-2 codes. Names are localized at runtime via Intl.DisplayNames. */
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ " +
  "CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MK ML MM MN MO MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NZ OM PA PE PF PG PH PK PL PM PR PS PT PY QA RE RO RS RU RW SA " +
  "SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY " +
  "UZ VA VC VE VG VN VU WS XK YE YT ZA ZM ZW"
).split(" ");

export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(locale = "en") {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

/**
 * Standard EU VAT rates (bps) used to pre-fill a new store's tax settings.
 * Merchants can edit them; verify against current law before going live.
 */
export const EU_STANDARD_VAT_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, CY: 1900, CZ: 2100, DE: 1900, DK: 2500, EE: 2400, ES: 2100, FI: 2550,
  FR: 2000, GR: 2400, HR: 2500, HU: 2700, IE: 2300, IT: 2200, LT: 2100, LU: 1700, LV: 2100, MT: 1800,
  NL: 2100, PL: 2300, PT: 2300, RO: 2100, SE: 2500, SI: 2200, SK: 2300,
};

export const CURRENCIES = ["EUR", "RON", "USD", "GBP", "CHF", "PLN", "HUF", "CZK", "BGN", "SEK", "DKK", "NOK"];
