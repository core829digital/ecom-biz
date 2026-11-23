/**
 * Seed: default plans, optional platform admin, optional demo store.
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  → creates or promotes a platform admin
 *   SEED_DEMO=true                          → creates a demo merchant + store with products
 * Safe to run repeatedly (idempotent).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Soft vertical gradient PNG, so the demo catalog looks intentional without external images. */
function gradientPng(w: number, h: number, from: [number, number, number], to: [number, number, number]) {
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const px = from.map((c, i) => Math.round(c + (to[i] - c) * t));
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) row.set(px, 1 + x * 3);
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

async function seedPlans() {
  if ((await db.plan.count()) > 0) return;
  await db.plan.createMany({
    data: [
      { name: "Basic", priceCents: 1900, transactionFeeBps: 200, trialDays: 14, position: 1, maxStores: 1, maxProducts: 250, maxStaff: 2, allowCustomDomain: true, allowApi: false, features: ["Online store & checkout", "Card, COD and bank transfer", "Discount codes"] },
      { name: "Grow", priceCents: 4900, transactionFeeBps: 100, trialDays: 14, position: 2, maxStores: 3, maxProducts: null, maxStaff: 5, allowCustomDomain: true, allowApi: true, features: ["Everything in Basic", "API & webhooks", "Priority email support"] },
      { name: "Advanced", priceCents: 14900, transactionFeeBps: 50, trialDays: 14, position: 3, maxStores: 10, maxProducts: null, maxStaff: null, allowCustomDomain: true, allowApi: true, features: ["Everything in Grow", "Lowest transaction fee", "Dedicated onboarding"] },
    ],
  });
  console.log("✓ plans");
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email) return;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
  else {
    if (!password || password.length < 8) throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
    await db.user.create({ data: { email, name: "Platform Admin", passwordHash: await bcrypt.hash(password, 12), isPlatformAdmin: true } });
  }
  console.log(`✓ platform admin ${email}`);
}

async function seedDemo() {
  if (process.env.SEED_DEMO !== "true") return;
  if (await db.store.findUnique({ where: { slug: "demo" } })) return console.log("• demo store already exists");
  const plan = await db.plan.findFirst({ where: { name: "Grow" } }) ?? (await db.plan.findFirst({ orderBy: { position: "asc" } }));
  const user =
    (await db.user.findUnique({ where: { email: "demo@example.com" } })) ??
    (await db.user.create({
      data: {
        email: "demo@example.com",
        name: "Demo Merchant",
        passwordHash: await bcrypt.hash("demo12345", 12),
        planId: plan?.id,
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 86400_000),
      },
    }));
  const store = await db.store.create({
    data: {
      slug: "demo",
      name: "Atelier Demo",
      email: "demo@example.com",
      currency: "EUR",
      locale: "en",
      countryCode: "RO",
      taxesIncluded: true,
      theme: {
        primaryColor: "#1f3a5f", backgroundColor: "#ffffff", textColor: "#111111", font: "dmsans",
        heroTitle: "Everyday essentials, made well", heroSubtitle: "Natural materials, honest prices, shipped across Europe.",
        heroCtaLabel: "Shop the collection", heroCtaUrl: "/collections/all", announcement: "Free shipping on orders over €50",
        footerText: "Atelier Demo · Bucharest", featuredTitle: "Bestsellers",
      },
      manualPayments: { cod: { enabled: true, instructions: "Pay the courier in cash or by card on delivery." }, bankTransfer: { enabled: true, instructions: "IBAN RO00 DEMO 0000 0000 0000 0000\nBank: Demo Bank" } },
      memberships: { create: { userId: user.id, role: "OWNER" } },
      taxRates: { create: [{ countryCode: "RO", name: "VAT", rateBps: 2100 }, { countryCode: "IT", name: "IVA", rateBps: 2200 }] },
      shippingZones: {
        create: [
          { name: "Romania", countries: ["RO"], rates: { create: [{ name: "Standard courier", priceCents: 1500, maxSubtotalCents: 4999 }, { name: "Free shipping", priceCents: 0, minSubtotalCents: 5000 }] } },
          { name: "Europe", countries: ["IT", "DE", "FR", "ES", "AT", "HU", "BG"], rates: { create: [{ name: "International", priceCents: 2500 }] } },
        ],
      },
      menus: {
        create: [
          { handle: "main", title: "Main menu", items: [{ title: "Shop", url: "/collections/all" }, { title: "Bestsellers", url: "/collections/bestsellers" }, { title: "About", url: "/pages/about" }] },
          { handle: "footer", title: "Footer menu", items: [{ title: "About", url: "/pages/about" }, { title: "Search", url: "/search" }] },
        ],
      },
      pages: { create: [{ title: "About", handle: "about", body: "We design **everyday essentials** in small batches.\n\n## Our promise\n\n- Natural materials\n- Fair production\n- 30-day returns" }] },
      discounts: { create: [{ code: "WELCOME10", type: "PERCENTAGE", value: 1000 }] },
    },
  });

  const dir = path.resolve(process.env.STORAGE_DIR || "./storage");
  const palette: [string, [number, number, number], [number, number, number], number, string, string[]][] = [
    ["Linen Shirt", [222, 214, 196], [176, 160, 132], 5900, "Shirts", ["S", "M", "L"]],
    ["Wool Beanie", [60, 72, 88], [28, 34, 44], 2400, "Accessories", []],
    ["Canvas Tote", [232, 226, 210], [196, 184, 156], 1900, "Bags", []],
    ["Cotton Tee", [245, 245, 245], [200, 200, 200], 2200, "Shirts", ["S", "M", "L", "XL"]],
    ["Ceramic Mug", [196, 110, 80], [140, 70, 50], 1600, "Home", []],
    ["Merino Scarf", [120, 30, 45], [70, 15, 25], 4500, "Accessories", []],
  ];
  const collection = await db.collection.create({ data: { storeId: store.id, title: "Bestsellers", handle: "bestsellers", description: "Our customers' favourites." } });
  for (const [i, [title, from, to, price, type, sizes]] of palette.entries()) {
    const key = `stores/${store.id}/seed/${randomBytes(6).toString("hex")}.png`;
    await mkdir(path.dirname(path.join(dir, key)), { recursive: true });
    const png = gradientPng(600, 750, from, to);
    await writeFile(path.join(dir, key), png);
    const url = `/files/${key}`;
    await db.storedFile.create({ data: { storeId: store.id, key, url, contentType: "image/png", size: png.length } });
    const handle = title.toLowerCase().replace(/\s+/g, "-");
    await db.product.create({
      data: {
        storeId: store.id,
        title,
        handle,
        description: `A ${title.toLowerCase()} you'll reach for every day.\n\n- Thoughtfully made\n- Built to last`,
        status: "ACTIVE",
        publishedAt: new Date(),
        productType: type,
        vendor: "Atelier Demo",
        tags: i < 3 ? ["bestseller"] : [],
        images: { create: [{ url, alt: title, position: 0 }] },
        options: sizes.length ? { create: [{ name: "Size", position: 1, values: sizes }] } : undefined,
        variants: {
          create: (sizes.length ? sizes : [null]).map((s, position) => ({
            title: s ?? "Default",
            option1: s,
            priceCents: price,
            costCents: Math.round(price * 0.42), // demo cost so profit reports work out of the box
            compareAtCents: i === 5 ? 5900 : null,
            sku: `${handle.toUpperCase().slice(0, 6)}-${s ?? "OS"}`,
            inventoryQty: 25,
            weightGrams: 300,
            position,
          })),
        },
        collections: i < 3 ? { create: { collectionId: collection.id, position: i } } : undefined,
      },
    });
  }
  await db.store.update({ where: { id: store.id }, data: { theme: { ...(store.theme as object), featuredCollectionId: collection.id } } });
  console.log("✓ demo store → login demo@example.com / demo12345, storefront slug 'demo'");
}

async function main() {
  await seedPlans();
  await seedAdmin();
  await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
