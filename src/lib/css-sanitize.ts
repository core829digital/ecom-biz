/**
 * Makes merchant CSS safe to inline in the storefront.
 *
 * The threat is not the merchant styling their own shop, it is CSS used as a side channel:
 * selectors like input[value^="a"] combined with url(...) can leak what shoppers type
 * (e.g. passwords) to another server, and "</style>" could break out into HTML. So every
 * construct that loads a resource or escapes the stylesheet is neutralised.
 */
export const MAX_CUSTOM_CSS = 20000;

export function sanitizeCss(input: string): string {
  let css = input.slice(0, MAX_CUSTOM_CSS);
  css = css.replace(/</g, "");                       // no "</style>" breakout, no HTML
  css = css.replace(/\\/g, "");                      // no escape sequences hiding the patterns below
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");         // comments could split keywords
  css = css.replace(/@(import|namespace|charset)\b[^;]*;?/gi, "");
  css = css.replace(/\b(url|image-set|-webkit-image-set|cross-fade|element|image|src)\s*\(/gi, "blocked(");
  css = css.replace(/\bexpression\s*\(/gi, "blocked(");
  css = css.replace(/\b(behavior|-moz-binding)\s*:/gi, "blocked:");
  css = css.replace(/javascript\s*:/gi, "");
  return css.trim();
}
