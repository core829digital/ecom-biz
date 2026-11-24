/** Database storage driver (default on Vercel without S3/R2). */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.STORAGE_DRIVER = "db";
const { db } = await import("@/lib/db");
const { storeImage, readLocalObject, removeStoreFiles, storageDriverName, UploadError } = await import("@/lib/storage");

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000000500010d0a2db40000000049454e44ae426082", "hex");
const storeId = `blobtest${Date.now().toString(36)}`;
afterAll(async () => {
  await db.fileBlob.deleteMany({ where: { key: { startsWith: `stores/${storeId}/` } } });
  await db.$disconnect();
});

describe("database storage driver", () => {
  it("stores, serves and deletes files without any external service", async () => {
    expect(storageDriverName()).toBe("db");
    const up = await storeImage(storeId, new File([PNG], "logo.png", { type: "image/png" }));
    expect(up.url).toBe(`/files/${up.key}`);
    expect(up.contentType).toBe("image/png");
    expect((await readLocalObject(up.key))?.equals(PNG)).toBe(true);
    await removeStoreFiles(storeId);
    expect(await readLocalObject(up.key)).toBeNull();
  });

  it("still rejects non-images whatever the extension says", async () => {
    await expect(storeImage(storeId, new File([Buffer.from("<svg onload=alert(1)>")], "x.png", { type: "image/png" }))).rejects.toBeInstanceOf(UploadError);
  });
});
