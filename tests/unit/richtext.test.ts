import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RichText } from "@/lib/richtext";

const html = (text: string) => renderToStaticMarkup(createElement(RichText, { text }));

describe("RichText (markdown-lite, no raw HTML)", () => {
  it("parses headings and lists without blank lines around them", () => {
    expect(html("## Title\n- one\n- two\nAfter")).toBe("<div><h2>Title</h2><ul><li>one</li><li>two</li></ul><p>After</p></div>");
  });
  it("keeps paragraphs, line breaks, bold and safe links", () => {
    const out = html("Hello **you**\nline two\n\n[docs](/legal/terms)");
    expect(out).toContain("<p>Hello <strong>you</strong><br/>line two</p>");
    expect(out).toMatch(/<p><a href="\/legal\/terms"[^>]*>docs<\/a><\/p>/);
  });
  it("never renders HTML or unsafe links", () => {
    const out = html('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(out).not.toContain("<script>");
    expect(out).not.toContain('href="javascript');
  });
});
