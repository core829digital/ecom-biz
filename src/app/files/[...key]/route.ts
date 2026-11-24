import { readLocalObject } from "@/lib/storage";
import { db } from "@/lib/db";

/** Serves uploads kept on the local disk or in the database (STORAGE_DRIVER=local|db). With S3/R2 files are served by the bucket/CDN. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const file = await db.storedFile.findUnique({ where: { key } });
  if (!file) return new Response("Not found", { status: 404 });
  const body = await readLocalObject(key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'none'; sandbox",
    },
  });
}
