import { Fragment, type ReactNode } from "react";

/**
 * Safe "markdown-lite" renderer for merchant content (descriptions, pages).
 * Supports paragraphs, "## " headings, "- " bullet lists, **bold** and [links](https://…).
 * Never uses dangerouslySetInnerHTML: all text is rendered as React text nodes.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) return <h2 key={i}>{inline(block.slice(3))}</h2>;
        const lines = block.split("\n");
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else out.push(<a key={m.index} href={m[3]} className="underline" rel="noopener">{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Plain-text excerpt for meta descriptions. */
export function plainExcerpt(text: string, max = 160): string {
  const s = text.replace(/\*\*|##\s|[-*]\s/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
