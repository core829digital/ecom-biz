/**
 * Create or promote a platform administrator.
 *   npm run platform:admin -- admin@example.com "Full Name" [password]
 * If the user exists it is promoted; otherwise it is created (password required, min 8 chars) with the
 * address counted as verified, since the operator running this command chose it.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const [emailArg, name = "Platform Admin", password] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run platform:admin -- <email> [name] [password]");
  const db = new PrismaClient();
  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
      console.log(`Promoted ${email} to platform admin.`);
      return;
    }
    if (!password || password.length < 8) throw new Error("New users need a password of at least 8 characters.");
    await db.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 12), isPlatformAdmin: true, emailVerifiedAt: new Date() } });
    console.log(`Created platform admin ${email}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
