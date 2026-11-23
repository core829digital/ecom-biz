import "server-only";
import { mkdir, readFile, rm, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import { randomToken } from "@/lib/crypto";

/** Serverless hosts cap request bodies (Vercel: 4.5 MB), so uploads are smaller there. */
export const MAX_UPLOAD_MB = process.env.VERCEL ? 4 : 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Identify images by magic bytes (never trust the client's MIME type or extension). SVG is rejected on purpose. */
export function sniffImageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return { mime: "image/gif", ext: "gif" };
  if (buf.subarray(4, 12).toString("ascii") === "ftypavif") return { mime: "image/avif", ext: "avif" };
  return null;
}

type Driver = {
  put(key: string, body: Buffer, contentType: string): Promise<string>; // returns public URL
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
};

function localDir() {
  return path.resolve(process.env.STORAGE_DIR || "./storage");
}

/** Resolve a key inside the storage dir; rejects traversal. */
export function localPathForKey(key: string): string | null {
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(key) || key.includes("..")) return null;
  const full = path.resolve(localDir(), key);
  return full.startsWith(localDir() + path.sep) ? full : null;
}

const localDriver: Driver = {
  async put(key, body) {
    const full = localPathForKey(key);
    if (!full) throw new Error("Invalid storage key");
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return `/files/${key}`;
  },
  async remove(key) {
    const full = localPathForKey(key);
    if (full) await unlink(full).catch(() => {});
  },
  async removePrefix(prefix) {
    const full = localPathForKey(prefix);
    if (full) await rm(full, { recursive: true, force: true });
  },
};

function s3Driver(): Driver {
  const bucket = process.env.S3_BUCKET!;
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION}.amazonaws.com`).replace(/\/$/, "");
  const publicBase = (process.env.S3_PUBLIC_URL || `${endpoint}/${bucket}`).replace(/\/$/, "");
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    region: process.env.S3_REGION || "auto",
    service: "s3",
  });
  return {
    async put(key, body, contentType) {
      const res = await client.fetch(`${endpoint}/${bucket}/${key}`, {
        method: "PUT",
        body: new Uint8Array(body),
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
      });
      if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
      return `${publicBase}/${key}`;
    },
    async remove(key) {
      await client.fetch(`${endpoint}/${bucket}/${key}`, { method: "DELETE" }).catch(() => {});
    },
    async removePrefix(prefix) {
      // ListObjectsV2 pages of up to 1000 keys; delete each (bounded to protect against runaway loops).
      let token: string | null = null;
      for (let page = 0; page < 200; page++) {
        const q = new URLSearchParams({ "list-type": "2", prefix, ...(token ? { "continuation-token": token } : {}) });
        const res = await client.fetch(`${endpoint}/${bucket}?${q}`);
        if (!res.ok) throw new Error(`S3 list failed: ${res.status}`);
        const xml = await res.text();
        const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
        await Promise.all(keys.map((k) => client.fetch(`${endpoint}/${bucket}/${k.split("/").map(encodeURIComponent).join("/")}`, { method: "DELETE" }).catch(() => {})));
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null) : null;
        if (!token) break;
      }
    },
  };
}

function driver(): Driver {
  if (process.env.STORAGE_DRIVER === "s3") return s3Driver();
  // Serverless file systems are ephemeral: uploads would vanish on the next deploy.
  if (process.env.VERCEL) throw new Error("STORAGE_DRIVER=s3 is required on Vercel (use Cloudflare R2 or S3)");
  return localDriver;
}

export type UploadResult = { key: string; url: string; contentType: string; size: number };

export async function storeImage(storeId: string, file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("too_large");
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) throw new UploadError("unsupported_type");
  const key = `stores/${storeId}/${new Date().getFullYear()}/${randomToken(12)}.${type.ext}`;
  const url = await driver().put(key, buf, type.mime);
  return { key, url, contentType: type.mime, size: buf.length };
}

export async function removeStoredObject(key: string) {
  await driver().remove(key);
}

/** Delete every uploaded file of a store (on store or account deletion). */
export async function removeStoreFiles(storeId: string) {
  if (!/^[a-z0-9]+$/i.test(storeId)) throw new Error("Invalid store id");
  await driver().removePrefix(`stores/${storeId}/`);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  const full = localPathForKey(key);
  if (!full) return null;
  return readFile(full).catch(() => null);
}

export class UploadError extends Error {
  constructor(public code: "too_large" | "unsupported_type") {
    super(code);
  }
}
