import { expect, test, type Page } from "@playwright/test";

const APP = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOT = new URL(APP).host;
const DEMO = `http://demo.${ROOT}`;
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function login(page: Page, email: string, password: string) {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin(\/|$)/);
}

test.describe.configure({ mode: "serial" });

test("merchant signs up, creates a store and a product", async ({ page }) => {
  const slug = `e2e${unique().slice(-7)}`;
  await page.goto(`${APP}/signup`, { waitUntil: "networkidle" });
  await page.fill("input[name=name]", "E2E Merchant");
  await page.fill("input[name=email]", `e2e-${unique()}@example.com`);
  await page.fill("input[name=password]", "short");
  await page.click("button[type=submit]");
  await expect(page.getByText("Use at least 8 characters").first()).toBeVisible();
  await expect(page.locator("input[name=name]")).toHaveValue("E2E Merchant"); // input kept after an error
  await page.fill("input[name=password]", "supersecret123");
  await page.click("button[type=submit]");
  await page.waitForURL("**/admin/new");
  await page.fill("input[name=name]", "E2E Shop");
  await page.fill("input[name=slug]", slug);
  await page.click("button[type=submit]");
  await page.waitForURL(new RegExp(`/admin/${slug}$`));

  await page.goto(`${APP}/admin/${slug}/products/new`, { waitUntil: "networkidle" });
  await page.fill("input[name=title]", "E2E Hoodie");
  await page.getByText("+ Add option").click();
  await page.locator('input[placeholder="Size"]').fill("Size");
  const value = page.locator('input[placeholder="Type a value and press Enter"]');
  for (const v of ["S", "M"]) {
    await value.fill(v);
    await value.press("Enter");
  }
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.locator('input[aria-label="S Price"]').fill("49,90");
  await page.locator('input[aria-label="M Price"]').fill("49.90");
  await page.locator('input[aria-label="S Available"]').fill("3");
  await page.selectOption('select[aria-label="Status"]', "ACTIVE");
  await page.click('button:has-text("Save")');
  await page.waitForURL(/\/products\/[a-z0-9]+\?created=1/);

  const sf = await page.context().newPage();
  await sf.goto(`http://${slug}.${ROOT}/products/e2e-hoodie`, { waitUntil: "networkidle" });
  await expect(sf.locator("h1")).toHaveText("E2E Hoodie");
  await expect(sf.locator("p[aria-live]")).toContainText("49.90");
});

test("shopper checks out on the demo store with a discount (cash on delivery)", async ({ page }) => {
  await page.goto(`${DEMO}/products/wool-beanie`, { waitUntil: "networkidle" });
  await page.fill("#qty", "2");
  await page.click('button:has-text("Add to cart")');
  await expect(page.getByText("Added to your cart.")).toBeVisible();

  await page.goto(`${DEMO}/checkout`, { waitUntil: "networkidle" });
  await page.fill("input[aria-label=Email]", `shopper-${unique()}@example.com`);
  await page.fill('input[aria-label="First name"]', "Ana");
  await page.fill('input[aria-label="Last name"]', "Pop");
  await page.fill("input[aria-label=Address]", "Str. Test 1");
  await page.fill('input[aria-label="Postal code"]', "010101");
  await page.fill("input[aria-label=City]", "Bucharest");
  await page.waitForSelector("input[name=rate]");
  // 2 × 24.00 = 48.00 < 50 → standard courier 15.00
  await expect(page.getByTestId("checkout-total")).toHaveText("€63.00");
  await page.fill('input[aria-label="Discount code"]', "welcome10");
  await page.click('button:has-text("Apply")');
  await expect(page.getByText("(WELCOME10)")).toBeVisible();
  // 48.00 − 4.80 + 15.00
  await expect(page.getByTestId("checkout-total")).toHaveText("€58.20");
  await page.locator('label:has-text("Cash on delivery") input').check();
  await page.click('button:has-text("Complete order")');
  await page.waitForURL(/\/orders\/[A-Za-z0-9_-]+$/);
  await expect(page.locator("h1")).toHaveText("Thank you, Ana!");
  await expect(page.getByText("Pay the courier")).toBeVisible();
});

test("merchant marks the order paid, fulfils it and refunds one item", async ({ page }) => {
  await login(page, "demo@example.com", "demo12345");
  await page.goto(`${APP}/admin/demo/orders?view=unpaid`, { waitUntil: "networkidle" });
  await page.locator("tbody tr a").first().click();
  await page.waitForURL(/\/orders\/[a-z0-9]+$/);
  const orderUrl = page.url();
  await page.click('button:has-text("Mark as paid")');
  // Confirmation happens in the app's own accessible dialog.
  await page.locator('[role=dialog] button[data-autofocus]').click();
  await expect(page.locator("h1")).toContainText("Paid");
  await page.goto(`${orderUrl}?action=fulfill`, { waitUntil: "networkidle" });
  await page.fill("input[name=trackingNumber]", "TRK123");
  await page.click('form button:has-text("Fulfill items")');
  await page.waitForURL(orderUrl);
  await expect(page.locator("h1")).toContainText("Fulfilled");
  await page.goto(`${orderUrl}?action=refund`, { waitUntil: "networkidle" });
  await page.fill('input[name^="qty:"]', "1");
  await expect(page.locator("input[name=amount]")).toHaveValue("21.60"); // 24.00 − 10%
  await page.click('form button:has-text("Refund")');
  await page.waitForURL(orderUrl);
  await expect(page.locator("h1")).toContainText("Partially refunded");
});

test("API: scopes, validation and CRUD", async ({ page, request }) => {
  await login(page, "demo@example.com", "demo12345");
  await page.goto(`${APP}/admin/demo/settings/developers`, { waitUntil: "networkidle" });
  const form = page.locator("form", { has: page.locator("input[name=name]") });
  await form.locator("input[name=name]").fill(`e2e ${unique()}`);
  await form.locator("input[value=write_products]").check();
  await form.locator('button:has-text("Create token")').click();
  const token = (await page.getByTestId("secret").innerText()).trim();
  const auth = { Authorization: `Bearer ${token}` };

  expect((await request.get(`${APP}/api/v1/shop`)).status()).toBe(401);
  expect((await request.get(`${APP}/api/v1/orders`, { headers: auth })).status()).toBe(200);
  const bad = await request.post(`${APP}/api/v1/products`, { headers: auth, data: { title: "x", variants: [{ price: -1 }] } });
  expect(bad.status()).toBe(422);
  const created = await request.post(`${APP}/api/v1/products`, { headers: auth, data: { title: "API item", status: "active", tags: ["keep"], variants: [{ price: 500 }] } });
  expect(created.status()).toBe(201);
  const id = (await created.json()).data.id;
  const patched = await (await request.patch(`${APP}/api/v1/products/${id}`, { headers: auth, data: { title: "API item 2" } })).json();
  expect(patched.data).toMatchObject({ title: "API item 2", status: "active", tags: ["keep"] });
  expect((await request.delete(`${APP}/api/v1/products/${id}`, { headers: auth })).status()).toBe(204);
});

test("shopper reviews a product, merchant publishes and replies", async ({ page, browser }) => {
  // Note: the storefront allows 5 reviews per IP per hour, so rapid local re-runs can hit the limit.
  const body = `Lovely mug, keeps coffee warm ${unique()}`;
  const reply = `Thanks for the kind words! ${unique()}`;
  const shopper = await browser.newPage();
  await shopper.goto(`${DEMO}/products/ceramic-mug`, { waitUntil: "networkidle" });
  await shopper.click('button:has-text("Write a review")');
  // The form animates open: wait until the 5th star is really selected.
  await expect(async () => {
    await shopper.locator('label:has(input[name=rating][value="5"])').click();
    await expect(shopper.locator('input[name=rating][value="5"]')).toBeChecked({ timeout: 500 });
  }).toPass();
  await shopper.fill("input[name=name]", "E2E Reviewer");
  await shopper.fill("input[name=email]", `reviewer-${unique()}@example.com`);
  await shopper.fill("textarea[name=body]", body);
  await shopper.click('button:has-text("Submit review")');
  await expect(shopper.getByText("Your review will appear once it's approved.")).toBeVisible();

  await login(page, "demo@example.com", "demo12345");
  await page.goto(`${APP}/admin/demo/reviews?view=pending`, { waitUntil: "networkidle" });
  const item = page.locator("li", { hasText: body });
  await item.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.locator("li", { hasText: body }).getByText("Published", { exact: true })).toHaveCount(0); // left the pending view
  await page.goto(`${APP}/admin/demo/reviews?view=approved`, { waitUntil: "networkidle" });
  const published = page.locator("li", { hasText: body });
  await published.locator("summary").click();
  await published.locator("textarea[name=reply]").fill(reply);
  await published.locator('button:has-text("Save")').click();
  await expect(page.getByText("Reply published")).toBeVisible();

  await shopper.reload({ waitUntil: "networkidle" });
  await expect(shopper.getByText(body)).toBeVisible();
  await expect(shopper.getByText(reply)).toBeVisible();
  await shopper.close();
});
