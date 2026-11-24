import { Fragment, type ReactNode } from "react";

/**
 * Safe "markdown-lite" renderer for merchant content (descriptions, pages).
 * Supports paragraphs, "## " headings, "- " bullet lists, **bold** and [links](https://…).
 * Never uses dangerouslySetInnerHTML: all text is rendered as React text nodes.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return <div className={className}>{toBlocks(text).map((b, i) => renderBlock(b, i))}</div>;
}

type Block = { kind: "h2"; text: string } | { kind: "ul"; items: string[] } | { kind: "p"; lines: string[] };

/**
 * Line-based parsing: a "## " line is a heading and consecutive "- " lines form a list, even
 * without blank lines around them (the way people naturally write). Blank lines separate paragraphs.
 */
function toBlocks(text: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: "p", lines: para });
    if (list.length) out.push({ kind: "ul", items: list });
    para = [];
    list = [];
  };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      out.push({ kind: "h2", text: line.slice(3) });
    } else if (/^[-*] /.test(line)) {
      if (para.length) {
        out.push({ kind: "p", lines: para });
        para = [];
      }
      list.push(line.slice(2));
    } else {
      if (list.length) {
        out.push({ kind: "ul", items: list });
        list = [];
      }
      para.push(line);
    }
  }
  flush();
  return out;
}

function renderBlock(b: Block, i: number) {
  if (b.kind === "h2") return <h2 key={i}>{inline(b.text)}</h2>;
  if (b.kind === "ul") return <ul key={i}>{b.items.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>;
  return (
    <p key={i}>
      {b.lines.map((l, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {inline(l)}
        </Fragment>
      ))}
    </p>
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
