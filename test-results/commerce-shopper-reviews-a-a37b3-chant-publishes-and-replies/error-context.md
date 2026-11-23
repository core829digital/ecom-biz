# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: commerce.spec.ts >> shopper reviews a product, merchant publishes and replies
- Location: tests/e2e/commerce.spec.ts:131:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Your review will appear once it\'s approved.')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Your review will appear once it\'s approved.') with timeout 15000ms
  - waiting for getByText('Your review will appear once it\'s approved.')

```

```yaml
- link "Skip to content":
  - /url: "#main"
- text: Free shipping on orders over €50
- banner:
  - link "Atelier Demo":
    - /url: /
  - navigation "Menu":
    - link "Shop":
      - /url: /collections/all
    - link "Bestsellers":
      - /url: /collections/bestsellers
    - link "About":
      - /url: /pages/about
  - link "Search":
    - /url: /search
  - link "Account":
    - /url: /account
  - link "Cart (0)":
    - /url: /cart
- main:
  - img "Ceramic Mug"
  - paragraph: Atelier Demo
  - heading "Ceramic Mug" [level=1]
  - link "5.0 / 5 5.0 · 5 reviews":
    - /url: "#reviews"
    - img "5.0 / 5"
    - text: 5.0 · 5 reviews
  - paragraph: €16.00
  - text: Quantity
  - button "−"
  - textbox "Quantity": "1"
  - button "+"
  - button "Add to cart"
  - paragraph: Tax included. Shipping calculated at checkout.
  - paragraph: A ceramic mug you'll reach for every day.
  - list:
    - listitem: Thoughtfully made
    - listitem: Built to last
  - heading "Customer reviews" [level=2]
  - paragraph:
    - text: "5.0"
    - img "5.0 / 5"
  - paragraph: 5 reviews
  - list:
    - listitem: 5 5
    - listitem: 4 0
    - listitem: 3 0
    - listitem: 2 0
    - listitem: 1 0
  - group "Your rating":
    - text: Your rating
    - radio "1"
    - text: "1"
    - radio "2"
    - text: "2"
    - radio "3"
    - text: "3"
    - radio "4"
    - text: "4"
    - radio "5" [checked]
    - text: "5"
  - textbox "Your name": E2E Reviewer
  - textbox "Email": reviewer-179547603152940@example.com
  - paragraph: Your email isn't published. Sign in to your account to get a “Verified purchase” badge.
  - textbox "Title (optional)"
  - textbox "Tell others what you think (at least 10 characters)": Lovely mug, keeps coffee warm 1795476030661992
  - button "Submit review" [disabled]
  - list:
    - listitem:
      - img "5.0 / 5"
      - paragraph: Lovely mug, keeps coffee warm 1795475428390723
      - paragraph: E2E Reviewer · 24 Nov 2026
      - paragraph: Reply from Atelier Demo
      - paragraph: Thanks for the kind words! 1795475428390536
    - listitem:
      - img "5.0 / 5"
      - paragraph: Lovely mug, keeps coffee warm 179547301562356
      - paragraph: E2E Reviewer · 24 Nov 2026
      - paragraph: Reply from Atelier Demo
      - paragraph: Thanks for the kind words! 1795473015623584
    - listitem:
      - img "5.0 / 5"
      - paragraph: Lovely mug, keeps coffee warm 1795472555444759
      - paragraph: E2E Reviewer · 24 Nov 2026
      - paragraph: Reply from Atelier Demo
      - paragraph: Thanks for the kind words! 1795472555444968
    - listitem:
      - img "5.0 / 5"
      - paragraph: Lovely mug, keeps coffee warm 1795472530219513
      - paragraph: E2E Reviewer · 24 Nov 2026
      - paragraph: Reply from Atelier Demo
      - paragraph: Thanks for the kind words!
    - listitem:
      - img "5.0 / 5"
      - paragraph: Lovely mug, keeps coffee warm 1795472192216782
      - paragraph: E2E Reviewer · 24 Nov 2026
      - paragraph: Reply from Atelier Demo
      - paragraph: Thanks for the kind words!
- contentinfo:
  - paragraph: Atelier Demo
  - paragraph: Atelier Demo · Bucharest
  - list:
    - listitem:
      - link "About":
        - /url: /pages/about
    - listitem:
      - link "Search":
        - /url: /search
  - paragraph: © 2026 Atelier Demo
- alert
```

# Test source

```ts
  43  |   }
  44  |   await expect(page.locator("tbody tr")).toHaveCount(2);
  45  |   await page.locator('input[aria-label="S Price"]').fill("49,90");
  46  |   await page.locator('input[aria-label="M Price"]').fill("49.90");
  47  |   await page.locator('input[aria-label="S Available"]').fill("3");
  48  |   await page.selectOption('select[aria-label="Status"]', "ACTIVE");
  49  |   await page.click('button:has-text("Save")');
  50  |   await page.waitForURL(/\/products\/[a-z0-9]+\?created=1/);
  51  | 
  52  |   const sf = await page.context().newPage();
  53  |   await sf.goto(`http://${slug}.${ROOT}/products/e2e-hoodie`, { waitUntil: "networkidle" });
  54  |   await expect(sf.locator("h1")).toHaveText("E2E Hoodie");
  55  |   await expect(sf.locator("p[aria-live]")).toContainText("49.90");
  56  | });
  57  | 
  58  | test("shopper checks out on the demo store with a discount (cash on delivery)", async ({ page }) => {
  59  |   await page.goto(`${DEMO}/products/wool-beanie`, { waitUntil: "networkidle" });
  60  |   await page.fill("#qty", "2");
  61  |   await page.click('button:has-text("Add to cart")');
  62  |   await expect(page.getByText("Added to your cart.")).toBeVisible();
  63  | 
  64  |   await page.goto(`${DEMO}/checkout`, { waitUntil: "networkidle" });
  65  |   await page.fill("input[aria-label=Email]", `shopper-${unique()}@example.com`);
  66  |   await page.fill('input[aria-label="First name"]', "Ana");
  67  |   await page.fill('input[aria-label="Last name"]', "Pop");
  68  |   await page.fill("input[aria-label=Address]", "Str. Test 1");
  69  |   await page.fill('input[aria-label="Postal code"]', "010101");
  70  |   await page.fill("input[aria-label=City]", "Bucharest");
  71  |   await page.waitForSelector("input[name=rate]");
  72  |   // 2 × 24.00 = 48.00 < 50 → standard courier 15.00
  73  |   await expect(page.getByTestId("checkout-total")).toHaveText("€63.00");
  74  |   await page.fill('input[aria-label="Discount code"]', "welcome10");
  75  |   await page.click('button:has-text("Apply")');
  76  |   await expect(page.getByText("(WELCOME10)")).toBeVisible();
  77  |   // 48.00 − 4.80 + 15.00
  78  |   await expect(page.getByTestId("checkout-total")).toHaveText("€58.20");
  79  |   await page.locator('label:has-text("Cash on delivery") input').check();
  80  |   await page.click('button:has-text("Complete order")');
  81  |   await page.waitForURL(/\/orders\/[A-Za-z0-9_-]+$/);
  82  |   await expect(page.locator("h1")).toHaveText("Thank you, Ana!");
  83  |   await expect(page.getByText("Pay the courier")).toBeVisible();
  84  | });
  85  | 
  86  | test("merchant marks the order paid, fulfils it and refunds one item", async ({ page }) => {
  87  |   await login(page, "demo@example.com", "demo12345");
  88  |   await page.goto(`${APP}/admin/demo/orders?view=unpaid`, { waitUntil: "networkidle" });
  89  |   await page.locator("tbody tr a").first().click();
  90  |   await page.waitForURL(/\/orders\/[a-z0-9]+$/);
  91  |   const orderUrl = page.url();
  92  |   await page.click('button:has-text("Mark as paid")');
  93  |   // Confirmation happens in the app's own accessible dialog.
  94  |   await page.locator('[role=dialog] button[data-autofocus]').click();
  95  |   await expect(page.locator("h1")).toContainText("Paid");
  96  |   await page.goto(`${orderUrl}?action=fulfill`, { waitUntil: "networkidle" });
  97  |   await page.fill("input[name=trackingNumber]", "TRK123");
  98  |   await page.click('form button:has-text("Fulfill items")');
  99  |   await page.waitForURL(orderUrl);
  100 |   await expect(page.locator("h1")).toContainText("Fulfilled");
  101 |   await page.goto(`${orderUrl}?action=refund`, { waitUntil: "networkidle" });
  102 |   await page.fill('input[name^="qty:"]', "1");
  103 |   await expect(page.locator("input[name=amount]")).toHaveValue("21.60"); // 24.00 − 10%
  104 |   await page.click('form button:has-text("Refund")');
  105 |   await page.waitForURL(orderUrl);
  106 |   await expect(page.locator("h1")).toContainText("Partially refunded");
  107 | });
  108 | 
  109 | test("API: scopes, validation and CRUD", async ({ page, request }) => {
  110 |   await login(page, "demo@example.com", "demo12345");
  111 |   await page.goto(`${APP}/admin/demo/settings/developers`, { waitUntil: "networkidle" });
  112 |   const form = page.locator("form", { has: page.locator("input[name=name]") });
  113 |   await form.locator("input[name=name]").fill(`e2e ${unique()}`);
  114 |   await form.locator("input[value=write_products]").check();
  115 |   await form.locator('button:has-text("Create token")').click();
  116 |   const token = (await page.getByTestId("secret").innerText()).trim();
  117 |   const auth = { Authorization: `Bearer ${token}` };
  118 | 
  119 |   expect((await request.get(`${APP}/api/v1/shop`)).status()).toBe(401);
  120 |   expect((await request.get(`${APP}/api/v1/orders`, { headers: auth })).status()).toBe(200);
  121 |   const bad = await request.post(`${APP}/api/v1/products`, { headers: auth, data: { title: "x", variants: [{ price: -1 }] } });
  122 |   expect(bad.status()).toBe(422);
  123 |   const created = await request.post(`${APP}/api/v1/products`, { headers: auth, data: { title: "API item", status: "active", tags: ["keep"], variants: [{ price: 500 }] } });
  124 |   expect(created.status()).toBe(201);
  125 |   const id = (await created.json()).data.id;
  126 |   const patched = await (await request.patch(`${APP}/api/v1/products/${id}`, { headers: auth, data: { title: "API item 2" } })).json();
  127 |   expect(patched.data).toMatchObject({ title: "API item 2", status: "active", tags: ["keep"] });
  128 |   expect((await request.delete(`${APP}/api/v1/products/${id}`, { headers: auth })).status()).toBe(204);
  129 | });
  130 | 
  131 | test("shopper reviews a product, merchant publishes and replies", async ({ page, browser }) => {
  132 |   // Note: the storefront allows 5 reviews per IP per hour, so rapid local re-runs can hit the limit.
  133 |   const body = `Lovely mug, keeps coffee warm ${unique()}`;
  134 |   const reply = `Thanks for the kind words! ${unique()}`;
  135 |   const shopper = await browser.newPage();
  136 |   await shopper.goto(`${DEMO}/products/ceramic-mug`, { waitUntil: "networkidle" });
  137 |   await shopper.click('button:has-text("Write a review")');
  138 |   await shopper.locator('label:has(input[name=rating][value="5"])').click();
  139 |   await shopper.fill("input[name=name]", "E2E Reviewer");
  140 |   await shopper.fill("input[name=email]", `reviewer-${unique()}@example.com`);
  141 |   await shopper.fill("textarea[name=body]", body);
  142 |   await shopper.click('button:has-text("Submit review")');
> 143 |   await expect(shopper.getByText("Your review will appear once it's approved.")).toBeVisible();
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  144 | 
  145 |   await login(page, "demo@example.com", "demo12345");
  146 |   await page.goto(`${APP}/admin/demo/reviews?view=pending`, { waitUntil: "networkidle" });
  147 |   const item = page.locator("li", { hasText: body });
  148 |   await item.getByRole("button", { name: "Publish", exact: true }).click();
  149 |   await expect(page.locator("li", { hasText: body }).getByText("Published", { exact: true })).toHaveCount(0); // left the pending view
  150 |   await page.goto(`${APP}/admin/demo/reviews?view=approved`, { waitUntil: "networkidle" });
  151 |   const published = page.locator("li", { hasText: body });
  152 |   await published.locator("summary").click();
  153 |   await published.locator("textarea[name=reply]").fill(reply);
  154 |   await published.locator('button:has-text("Save")').click();
  155 |   await expect(page.getByText("Reply published")).toBeVisible();
  156 | 
  157 |   await shopper.reload({ waitUntil: "networkidle" });
  158 |   await expect(shopper.getByText(body)).toBeVisible();
  159 |   await expect(shopper.getByText(reply)).toBeVisible();
  160 |   await shopper.close();
  161 | });
  162 | 
```