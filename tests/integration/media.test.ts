/** Store file library: plan quota, "in use" protection, documents. */
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
process.env.STORAGE_DRIVER = "db";
const { db } = await import("@/lib/db");
const { uploadMedia, deleteMedia, storageUsage, MediaError } = await import("@/server/media");
const { UploadError } = await import("@/lib/storage");

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000000500010d0a2db40000000049454e44ae426082", "hex");
const PDF = Buffer.from("%PDF-1.4\n%test\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const run = Date.now().toString(36);
const ids: { store?: string; user?: string; plan?: string } = {};
afterAll(async () => {
  if (ids.store) await db.fileBlob.deleteMany({ where: { key: { startsWith: `stores/${ids.store}/` } } });
  await db.store.deleteMany({ where: { id: ids.store } });
  await db.user.deleteMany({ where: { id: ids.user } });
  await db.plan.deleteMany({ where: { id: ids.plan } });
  await db.$disconnect();
});

describe("media library", () => {
  it("records uploads with names, accepts PDFs, refuses fake files, enforces the plan quota and protects files in use", async () => {
    const plan = await db.plan.create({ data: { name: `Tiny ${run}`, priceCents: 0, maxStorageMb: 0 } });
    const user = await db.user.create({ data: { email: `media${run}@example.com`, name: "M", passwordHash: "x", planId: plan.id } });
    const store = await db.store.create({ data: { slug: `media${run}`.slice(0, 30), name: "Media", email: "s@example.com", memberships: { create: { userId: user.id, role: "OWNER" } } } });
    Object.assign(ids, { store: store.id, user: user.id, plan: plan.id });

    await expect(uploadMedia(store, new File([PNG], "logo.png"))).rejects.toMatchObject({ code: "quota" });
    await db.plan.update({ where: { id: plan.id }, data: { maxStorageMb: 1 } });

    const logo = await uploadMedia(store, new File([PNG], "My Logo <b>.png"));
    expect(logo.name).toBe("My Logo b.png");
    const doc = await uploadMedia(store, new File([PDF], "terms.pdf"), { documents: true });
    expect(doc.contentType).toBe("application/pdf");
    await expect(uploadMedia(store, new File([PDF], "x.png"))).rejects.toBeInstanceOf(UploadError); // PDFs only where allowed
    await expect(uploadMedia(store, new File([Buffer.from("MZ\x90\x00 not an exe really")], "virus.png"), { documents: true })).rejects.toBeInstanceOf(UploadError);
    expect((await storageUsage(store.id)).files).toBe(2);

    await db.store.update({ where: { id: store.id }, data: { theme: { logoUrl: logo.url } } });
    await expect(deleteMedia(store, logo.id)).rejects.toMatchObject({ code: "in_use", detail: { places: ["theme"] } });
    await deleteMedia(store, doc.id);
    await expect(deleteMedia(store, doc.id)).rejects.toBeInstanceOf(MediaError);
    expect((await storageUsage(store.id)).files).toBe(1);
  });
});
