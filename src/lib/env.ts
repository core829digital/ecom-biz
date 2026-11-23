import "server-only";

function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  get platformName() {
    return read("PLATFORM_NAME", "Commerce");
  },
  get appUrl() {
    return read("APP_URL", "http://localhost:3000").replace(/\/$/, "");
  },
  get storefrontRootDomain() {
    return read("STOREFRONT_ROOT_DOMAIN", "localhost:3000").toLowerCase();
  },
  get storefrontProtocol() {
    return read("STOREFRONT_PROTOCOL", "http");
  },
  get appSecret() {
    const s = read("APP_SECRET");
    if (process.env.NODE_ENV === "production" && s.length < 32) {
      throw new Error("APP_SECRET must be at least 32 characters in production");
    }
    return s;
  },
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY || "";
  },
  get stripePublishableKey() {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || "";
  },
  get platformFeeBps() {
    return Math.max(0, parseInt(process.env.PLATFORM_FEE_BPS || "0", 10) || 0);
  },
  get testGatewayEnabled() {
    return process.env.ENABLE_TEST_GATEWAY === "true";
  },
  get billingEnforced() {
    return process.env.BILLING_ENFORCED === "true";
  },
  get smtpUrl() {
    return process.env.SMTP_URL || "";
  },
  get emailFrom() {
    return read("EMAIL_FROM", "no-reply@example.com");
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
