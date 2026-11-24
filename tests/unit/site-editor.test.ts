import { describe, expect, it } from "vitest";
import { contrastRatio, dominantColors, fixContrast, generatePalettes, hexToHsl, hslToHex } from "@/lib/palette";
import { parseTheme, themeContrastIssues, themeCssVars, themeDraft } from "@/lib/theme";
import { blankBlock, blankSection, parseSections, SECTION_TYPES, BLOCK_TYPES, MAX_SECTIONS } from "@/lib/theme-sections";

describe("palette", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("round-trips HSL", () => {
    for (const c of ["#1f4e79", "#b4436c", "#c6f432", "#777777"]) {
      const back = hslToHex(hexToHsl(c));
      const diff = [1, 3, 5].map((i) => Math.abs(parseInt(back.slice(i, i + 2), 16) - parseInt(c.slice(i, i + 2), 16)));
      expect(Math.max(...diff)).toBeLessThanOrEqual(1);
    }
  });

  it("fixes unreadable text while keeping it unchanged when already fine", () => {
    expect(fixContrast("#111111", "#ffffff")).toBe("#111111");
    const fixed = fixContrast("#bbbbbb", "#ffffff");
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const onDark = fixContrast("#333333", "#0a0a0a");
    expect(contrastRatio(onDark, "#0a0a0a")).toBeGreaterThanOrEqual(4.5);
  });

  it("generates readable palettes for any brand color", () => {
    for (const brand of ["#ff0000", "#ffff00", "#0000ff", "#111111", "#fafafa", "#3a7d44"]) {
      const palettes = generatePalettes(brand);
      expect(palettes).toHaveLength(5);
      for (const p of palettes) {
        expect(contrastRatio(p.textColor, p.backgroundColor)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(p.primaryColor, p.backgroundColor)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("finds dominant colors and ignores white, black and transparent pixels", () => {
    const px = (r: number, g: number, b: number, a = 255, n = 1) => Array.from({ length: n }, () => [r, g, b, a]).flat();
    const pixels = [...px(255, 255, 255, 255, 50), ...px(0, 0, 0, 255, 50), ...px(200, 30, 30, 255, 20), ...px(30, 60, 200, 255, 10), ...px(10, 200, 10, 0, 99)];
    const colors = dominantColors(pixels);
    expect(colors[0]).toBe("#c81e1e");
    expect(colors[1]).toBe("#1e3cc8");
    expect(colors).toHaveLength(2);
  });
});

describe("sections", () => {
  it("every section and block type has valid defaults", () => {
    for (const type of SECTION_TYPES) expect(parseSections([blankSection(type)])).toHaveLength(1);
    for (const type of BLOCK_TYPES) expect(blankBlock(type).type).toBe(type);
  });

  it("drops unknown types, bad ids and duplicates, and caps the count", () => {
    const ok = blankSection("rich-text", "abcd1234");
    const parsed = parseSections([ok, { ...ok }, { id: "x", type: "hero" }, { id: "zzzz9999", type: "script" }, null, "hero"]);
    expect(parsed).toHaveLength(1);
    expect(parseSections(Array.from({ length: 40 }, (_, i) => blankSection("banner", `s${String(i).padStart(4, "0")}`)))).toHaveLength(MAX_SECTIONS);
    expect(parseSections("nope")).toBeNull();
  });

  it("sanitizes fields instead of failing", () => {
    const [s] = parseSections([{ id: "abcd1234", type: "hero", imageUrl: "javascript:alert(1)", overlay: 500, height: "huge" }])!;
    expect(s.type === "hero" && [s.imageUrl, s.overlay, s.height]).toEqual(["", 35, "medium"]);
    const [c] = parseSections([{ id: "abcd1235", type: "container", columns: 9, blocks: [{ id: "bbbb1111", type: "image", url: "http://evil.test/x.png" }, { id: "bbbb2222", type: "iframe" }] }])!;
    expect(c.type === "container" && c.columns).toBe(1);
    expect(c.type === "container" && c.blocks).toEqual([{ id: "bbbb1111", type: "image", url: "", alt: "", ratio: "auto", link: "" }]);
  });
});

describe("theme", () => {
  it("derives sections from themes saved before the site editor", () => {
    const t = parseTheme({ heroTitle: "Hello", featuredCollectionId: "col1" });
    expect(t.sections.map((s) => s.type)).toEqual(["hero", "featured-products", "collections"]);
    expect(t.sections[0].type === "hero" && t.sections[0].title).toBe("Hello");
  });

  it("keeps an explicitly empty homepage empty", () => {
    expect(parseTheme({ sections: [] }).sections).toEqual([]);
  });

  it("separates the draft from the published theme", () => {
    const json = { primaryColor: "#000000", draft: { primaryColor: "#ff0000" } };
    expect(parseTheme(json).primaryColor).toBe("#000000");
    expect(themeDraft(json)?.primaryColor).toBe("#ff0000");
    expect(themeDraft({ primaryColor: "#000000" })).toBeNull();
  });

  it("flags unreadable color combinations", () => {
    expect(themeContrastIssues(parseTheme({}))).toEqual([]);
    expect(themeContrastIssues(parseTheme({ textColor: "#eeeeee", backgroundColor: "#ffffff" }))).toContain("text");
  });

  it("exposes shapes and heading font as CSS variables", () => {
    const vars = themeCssVars(parseTheme({ buttonShape: "square", cornerStyle: "round", font: "inter", headingFont: "playfair" }));
    expect(vars["--btn-radius"]).toBe("0px");
    expect(vars["--card-radius"]).toBe("1.25rem");
    expect(vars["--store-heading-font"]).toContain("Playfair");
  });
});

describe("onboarding starters", () => {
  it("every starter builds a valid, localized homepage with every preset", async () => {
    const { STARTER_IDS, starterTheme } = await import("@/lib/theme-starters");
    const { THEME_PRESETS } = await import("@/lib/theme");
    for (const id of STARTER_IDS) {
      for (const locale of ["en", "it"]) {
        const t = parseTheme(JSON.parse(JSON.stringify(starterTheme(THEME_PRESETS[2].id, id, "Bottega Rossi", locale))));
        expect(t.sections.length).toBeGreaterThanOrEqual(3);
        expect(t.sections[0].type === "hero" && t.sections[0].title).toBe("Bottega Rossi");
        expect(new Set(t.sections.map((s) => s.id)).size).toBe(t.sections.length);
        expect(t.backgroundColor).toBe(THEME_PRESETS[2].backgroundColor);
      }
    }
    const it_ = JSON.stringify(starterTheme("minimal", "classic", "X", "it"));
    expect(it_).toContain("Spedizione rapida");
    expect(starterTheme("unknown", "minimal", "X", "en").primaryColor).toBe(THEME_PRESETS[0].primaryColor);
  });
});
