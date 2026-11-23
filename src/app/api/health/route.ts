import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + database readiness probe for load balancers and Docker HEALTHCHECK. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error", database: "unreachable" }, { status: 503 });
  }
}
