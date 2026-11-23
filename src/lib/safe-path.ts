/**
 * True for same-origin relative paths only. Rejects protocol-relative URLs ("//evil.com"),
 * backslash variants that browsers normalise to them ("/\evil.com"), and control characters.
 */
export function isSafeRelativePath(p: string | null | undefined): p is string {
  if (!p || p.length > 2048 || p[0] !== "/") return false;
  if (p[1] === "/" || p.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(p);
}
