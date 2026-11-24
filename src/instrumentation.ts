/**
 * Runs once when the server starts. In production, refuse to boot with an unsafe configuration
 * instead of failing later on a customer's request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { env } = await import("@/lib/env");
  const problems: string[] = [];
  try {
    void env.appSecret;
  } catch (e) {
    problems.push((e as Error).message);
  }
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is missing");
  if (env.appUrl.startsWith("https://")) {
    if (!env.smtpUrl) {
      // Temporary escape hatch for test deployments without a mail domain yet. Never for real customers.
      if (process.env.ALLOW_MISSING_SMTP === "true") {
        console.warn("WARNING: SMTP_URL is missing and ALLOW_MISSING_SMTP=true: NO emails are sent (verification, password reset, orders). Test use only.");
      } else {
        problems.push("SMTP_URL is missing: order, password-reset and verification emails would not be sent (set ALLOW_MISSING_SMTP=true only for a test deployment)");
      }
    }
    if (!env.cronSecret) problems.push("CRON_SECRET is missing or weak (24+ random characters): scheduled jobs would be disabled");
    if (env.testGatewayEnabled) problems.push("ENABLE_TEST_GATEWAY must be false in production");
    if (env.stripeSecretKey && !env.stripeWebhookSecret) problems.push("STRIPE_WEBHOOK_SECRET is missing: payments would never be confirmed");
  }
  if (problems.length) {
    const msg = `Unsafe production configuration:\n - ${problems.join("\n - ")}`;
    console.error(msg);
    throw new Error(msg);
  }
}
