import { NextResponse, type NextRequest } from "next/server";
import { requireStoreAccess } from "@/lib/auth/staff";
import { isSafeRelativePath } from "@/lib/safe-path";
import { PREVIEW_COOKIE } from "@/server/storefront";
import { env } from "@/lib/env";

/**
 * Opens the storefront in draft-preview mode for the site editor's iframe.
 * The cookie is scoped to this store's path on the platform host and expires in an hour.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ store: string }> }) {
  const { store: slug } = await params;
  const { store } = await requireStoreAccess(slug, "ADMIN");
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  const target = `/sites/${encodeURIComponent(store.slug)}${isSafeRelativePath(path) && path !== "/" ? path : ""}`;
  const res = NextResponse.redirect(new URL(target, env.appUrl));
  res.cookies.set(PREVIEW_COOKIE, store.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: `/sites/${encodeURIComponent(store.slug)}`,
    maxAge: 3600,
  });
  return res;
}
