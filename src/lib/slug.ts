/** Shopify-style handle: lowercase, ASCII, dash-separated. */
export function handleize(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const RESERVED_SLUGS = new Set([
  "www", "app", "admin", "api", "mail", "smtp", "ftp", "static", "assets", "cdn",
  "help", "support", "status", "docs", "blog", "platform", "store", "stores", "shop",
  "checkout", "billing", "login", "signup", "account", "dashboard", "dev", "test", "staging",
]);

export function isValidStoreSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
