import "server-only";

/**
 * Registers merchants' custom domains with the hosting provider, when the provider
 * needs it to route traffic and issue HTTPS certificates.
 *
 * - Docker + Caddy (default): nothing to do. Caddy issues certificates on demand and
 *   asks /api/tls/check first.
 * - Vercel: every custom domain must be added to the project through the REST API.
 *   Enabled when VERCEL_API_TOKEN and VERCEL_PROJECT_ID are set (VERCEL_TEAM_ID for team projects).
 *
 * Domains are only registered after the merchant proved ownership with our TXT record,
 * so nobody can make the platform request certificates for domains they don't own.
 */

const API = "https://api.vercel.com";

type Config = { token: string; projectId: string; teamId?: string };

function vercelConfig(): Config | null {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID || undefined };
}

export function hostingDomainsEnabled() {
  return vercelConfig() !== null;
}

function url(cfg: Config, path: string) {
  const u = new URL(path, API);
  if (cfg.teamId) u.searchParams.set("teamId", cfg.teamId);
  return u;
}

async function call(cfg: Config, method: string, path: string, body?: unknown) {
  return fetch(url(cfg, path), {
    method,
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
}

export class HostingDomainError extends Error {
  constructor(public status: number, public detail: string) {
    super(`Hosting provider rejected the domain (${status}): ${detail}`);
  }
}

/** Add a verified custom domain to the hosting project. Idempotent. */
export async function registerHostingDomain(hostname: string): Promise<void> {
  const cfg = vercelConfig();
  if (!cfg) return;
  const res = await call(cfg, "POST", `/v10/projects/${encodeURIComponent(cfg.projectId)}/domains`, { name: hostname });
  if (res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  // Already attached to this project: fine.
  if (res.status === 409 && data.error?.code === "domain_already_in_use") {
    const existing = await call(cfg, "GET", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(hostname)}`);
    if (existing.ok) return;
  }
  throw new HostingDomainError(res.status, data.error?.message ?? data.error?.code ?? "unknown error");
}

/** Remove a custom domain from the hosting project. Never throws: removal must not block the merchant. */
export async function unregisterHostingDomain(hostname: string): Promise<void> {
  const cfg = vercelConfig();
  if (!cfg) return;
  try {
    const res = await call(cfg, "DELETE", `/v9/projects/${encodeURIComponent(cfg.projectId)}/domains/${encodeURIComponent(hostname)}`);
    if (!res.ok && res.status !== 404) console.error("[hosting-domains] remove failed", hostname, res.status);
  } catch (e) {
    console.error("[hosting-domains] remove failed", hostname, e);
  }
}
