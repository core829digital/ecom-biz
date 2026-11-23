import { z } from "zod";
import { COUNTRY_CODES } from "./geo";

export const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  company: z.string().trim().max(120).optional().default(""),
  address1: z.string().trim().min(1).max(200),
  address2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(1).max(100),
  province: z.string().trim().max(100).optional().default(""),
  zip: z.string().trim().min(1).max(20),
  countryCode: z.string().refine((c) => COUNTRY_CODES.includes(c)),
  phone: z.string().trim().max(40).optional().default(""),
});

export type Address = z.infer<typeof addressSchema>;

export function formatAddressLines(a: Partial<Address> | null | undefined, countryName?: (c: string) => string): string[] {
  if (!a) return [];
  return [
    [a.firstName, a.lastName].filter(Boolean).join(" "),
    a.company,
    a.address1,
    a.address2,
    [a.zip, a.city, a.province].filter(Boolean).join(" "),
    a.countryCode ? (countryName ? countryName(a.countryCode) : a.countryCode) : "",
    a.phone,
  ].filter((l): l is string => !!l && l.trim() !== "");
}
