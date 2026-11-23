import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges (IPv4 + IPv6). */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}

/** SSRF guard for merchant-supplied URLs (webhooks): https only, public DNS resolution only. */
export async function isPublicHttpsUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return process.env.NODE_ENV !== "production" && url.protocol === "http:" && process.env.ALLOW_HTTP_WEBHOOKS === "true";
  if (url.username || url.password) return false;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}
