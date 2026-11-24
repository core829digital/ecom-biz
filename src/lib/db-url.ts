/**
 * Prisma needs `pgbouncer=true` behind a transaction-mode pooler (Neon "-pooler" hosts,
 * Supabase port 6543), otherwise prepared statements fail at random under load.
 * Connection strings copied from a provider usually lack it, so it is added here.
 */
export function prismaDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const pooled = url.hostname.includes("-pooler.") || url.port === "6543";
  if (!pooled) return raw;
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "5");
  return url.toString();
}
