import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Most common passwords in public breach corpora (and local variants). NIST 800-63B asks to
 * reject known-compromised and context-specific passwords rather than impose complexity rules.
 */
const COMMON = new Set([
  "password", "password1", "password12", "password123", "passw0rd", "p@ssw0rd", "p@ssword", "12345678", "123456789", "1234567890",
  "12345678910", "123123123", "11111111", "00000000", "87654321", "123456123456", "qwertyuiop", "qwerty123", "qwerty12",
  "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "zaq12wsx", "asdfghjkl", "asdf1234", "abcd1234", "abc12345", "abcdefgh", "iloveyou",
  "iloveyou1", "sunshine", "princess", "football", "baseball", "superman", "welcome1", "welcome123", "letmein1", "trustno1",
  "starwars", "whatever", "dragon123", "monkey123", "shadow123", "master123", "admin123", "administrator", "changeme",
  "qwertyui", "q1w2e3r4", "computer", "internet", "michael1", "jennifer", "football1", "charlie1", "liverpool", "chelsea1",
  "juventus", "ciaociao", "amoremio", "ti amo", "tiamo123", "napoli1926", "forzainter", "forzamilan", "forzajuve", "roma1927",
  "parolachiave", "passwordd", "romania1", "parola123", "bucuresti", "steaua86", "dinamo48", "shopify1", "ecommerce",
]);

export type PasswordIssue = "length" | "common" | "personal";

/** Why a password is rejected, or null when it is acceptable. */
export function passwordIssue(password: string, context: { email?: string; name?: string } = {}): PasswordIssue | null {
  if (password.length < 8 || password.length > 200) return "length";
  const p = password.toLowerCase();
  if (COMMON.has(p) || /^(.)\1+$/.test(p) || /^(0123456789|123456789|abcdefghij)/.test(p)) return "common";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if ((local && local.length >= 4 && p.includes(local)) || (context.email && p === context.email.toLowerCase())) return "personal";
  if (context.name && context.name.length >= 4 && p.replace(/\s/g, "").includes(context.name.toLowerCase().replace(/\s/g, ""))) return "personal";
  return null;
}

/** Minimum policy: 8+ chars, not a common password. Length beats complexity rules (NIST 800-63B). */
export function isAcceptablePassword(password: string): boolean {
  return passwordIssue(password) === null;
}
