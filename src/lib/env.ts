import "server-only";

function read(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/** A production build served over https: a real deployment (local prod-mode runs use http). */
function isRealDeployment() {
  return process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https://");
}

/** Values copied from .env.example or obviously not random. */
function isPlaceholder(v: string) {
  return /change-?me|example|placeholder|secret123|your[-_]/i.test(v);
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
    if (process.env.NODE_ENV === "production" && (s.length < 32 || (isRealDeployment() && isPlaceholder(s)))) {
      throw new Error("APP_SECRET must be a unique random value of at least 32 characters in production (e.g. `openssl rand -base64 48`)");
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
  /** Empty (cron endpoints disabled) when missing, short, or a placeholder on a real deployment. */
  get cronSecret() {
    const s = process.env.CRON_SECRET || "";
    if (isRealDeployment() && (s.length < 24 || isPlaceholder(s))) {
      if (s) console.error("[env] CRON_SECRET is too weak for production: cron endpoints are disabled until it is replaced");
      return "";
    }
    return s;
  },
  /** Admin cookies are Secure only when the app is served over https (lets http://localhost work). */
  get secureAppCookies() {
    return this.appUrl.startsWith("https://");
  },
  /** Storefront cookies are Secure when storefronts are served over https. */
  get secureStoreCookies() {
    return this.storefrontProtocol === "https";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
