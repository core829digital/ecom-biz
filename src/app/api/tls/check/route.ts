import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * "Ask" endpoint for on-demand TLS (e.g. Caddy `on_demand_tls { ask … }`).
 * Returns 200 only for hostnames this platform should serve, so certificates are
 * never issued for arbitrary domains pointed at the server.
 */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase().trim() ?? "";
  if (!domain || domain.length > 253) return new Response("missing", { status: 400 });
  const root = env.storefrontRootDomain.split(":")[0];
  const appHost = new URL(env.appUrl).hostname;
  if (domain === appHost || domain === root) return new Response("ok");
  if (domain.endsWith(`.${root}`)) {
    const slug = domain.slice(0, -(root.length + 1));
    const store = slug.includes(".") ? null : await db.store.findUnique({ where: { slug }, select: { id: true } });
    return store ? new Response("ok") : new Response("unknown", { status: 404 });
  }
  const custom = await db.domain.findUnique({ where: { hostname: domain }, select: { verifiedAt: true } });
  return custom?.verifiedAt ? new Response("ok") : new Response("unknown", { status: 404 });
}
