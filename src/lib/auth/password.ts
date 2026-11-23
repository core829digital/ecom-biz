import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Minimum policy: 8+ chars. Length beats complexity rules (NIST 800-63B). */
export function isAcceptablePassword(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}
