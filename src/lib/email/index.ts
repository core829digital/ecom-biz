import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtpUrl) return null;
  transporter ??= nodemailer.createTransport(env.smtpUrl);
  return transporter;
}

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Display name for the From header (store name for customer emails). */
  fromName?: string;
  replyTo?: string;
};

/** Sends an email. Never throws: failures are logged so they can't break checkout or orders. */
export async function sendEmail(email: Email): Promise<boolean> {
  const from = `"${(email.fromName ?? env.platformName).replace(/["\r\n]/g, "")}" <${env.emailFrom}>`;
  const t = getTransporter();
  if (!t) {
    if (env.isProduction) {
      // Never write message bodies to production logs: they contain sign-in and reset links.
      console.error(`[email] SMTP_URL is not configured: email to ${email.to} ("${email.subject}") was NOT sent`);
      return false;
    }
    console.info(`[email:dev] to=${email.to} subject="${email.subject}"\n${email.text}\n`);
    return true;
  }
  try {
    await t.sendMail({ from, to: email.to, subject: email.subject, html: email.html, text: email.text, replyTo: email.replyTo });
    return true;
  } catch (err) {
    console.error("[email] send failed", { to: email.to, subject: email.subject, err });
    return false;
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Minimal, client-safe email layout. Brand color comes from the store theme. */
export function emailLayout(opts: { heading: string; bodyHtml: string; brandColor?: string; footer?: string }) {
  const brand = /^#[0-9a-fA-F]{6}$/.test(opts.brandColor ?? "") ? opts.brandColor : "#111827";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:${brand}"></td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(opts.heading)}</h1>
${opts.bodyHtml}
</td></tr></table>
${opts.footer ? `<p style="color:#71717a;font-size:12px;margin-top:16px">${escapeHtml(opts.footer)}</p>` : ""}
</td></tr></table></body></html>`;
}

export function emailButton(href: string, label: string, brandColor = "#111827") {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:${brandColor};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(label)}</a></p>`;
}
