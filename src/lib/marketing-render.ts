/** Email-safe rendering of the "markdown-lite" used in campaigns (shared by server and preview). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Paragraphs, line breaks, "- " lists, "## " headings and **bold**. Everything else is escaped. */
export function bodyToHtml(body: string): string {
  const blocks = body.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul style="padding-left:20px;margin:0 0 16px">${lines.map((l) => `<li style="margin:0 0 6px">${inline(l.trim().slice(2))}</li>`).join("")}</ul>`;
      }
      if (b.startsWith("## ")) return `<h2 style="font-size:17px;margin:20px 0 8px">${inline(b.slice(3))}</h2>`;
      return `<p style="margin:0 0 16px;line-height:1.6">${lines.map(inline).join("<br>")}</p>`;
    })
    .join("");
}

export function bodyToText(body: string) {
  return body.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^## /gm, "");
}
