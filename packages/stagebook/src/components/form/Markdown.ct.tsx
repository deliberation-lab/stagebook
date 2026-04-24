import type { CSSProperties } from "react";
import { test, expect } from "@playwright/experimental-ct-react";
import { Markdown } from "./Markdown";

test("renders markdown text", async ({ mount }) => {
  const component = await mount(<Markdown text="**Bold text**" />);
  await expect(component.locator("strong")).toContainText("Bold text");
});

test("renders links", async ({ mount }) => {
  const component = await mount(
    <Markdown text="[Click here](https://example.com)" />,
  );
  await expect(component.locator("a")).toHaveAttribute(
    "href",
    "https://example.com",
  );
});

test("passes through relative image paths without resolveURL", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="![photo](images/test.png)" />);
  // Verify the src attribute is set correctly (image won't load — that's expected)
  await expect(component.locator("img")).toHaveAttribute(
    "src",
    "images/test.png",
  );
});

test("img renders with inline max-width: 100% and height: auto so it can't overflow the prompt (issue #211)", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="![photo](images/test.png)" />);
  const { maxWidth, height } = await component
    .locator("img")
    .evaluate((el) => ({
      maxWidth: (el as HTMLElement).style.maxWidth,
      height: (el as HTMLElement).style.height,
    }));
  expect(maxWidth).toBe("100%");
  expect(height).toBe("auto");
});

test("renders headings", async ({ mount }) => {
  const component = await mount(<Markdown text="## Section Title" />);
  await expect(component.locator("h2")).toContainText("Section Title");
});

test("renders lists", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"- Item A\n- Item B\n- Item C"} />,
  );
  await expect(component.locator("li")).toHaveCount(3);
});

test("renders GFM tables", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  await expect(component.locator("table")).toBeVisible();
});

test("table uses collapsed borders and visible cell borders", async ({
  mount,
}) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  const borderCollapse = await component
    .locator("table")
    .evaluate((el) => getComputedStyle(el).borderCollapse);
  expect(borderCollapse).toBe("collapse");

  const cellBorderWidth = await component
    .locator("td")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(cellBorderWidth).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// Inline table styling — issue #214
//
// Tables were historically styled via styles.css, which loses on hosts that
// don't import the stylesheet. These tests assert the styles are now INLINE
// (read el.style.*, not getComputedStyle) so a dropped rule or unloaded
// sheet can't regress table rendering.
// ---------------------------------------------------------------------------

test("table has inline border-collapse: collapse", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  const borderCollapse = await component
    .locator("table")
    .evaluate((el) => (el as HTMLElement).style.borderCollapse);
  expect(borderCollapse).toBe("collapse");
});

test("td has inline border", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  const borderStyle = await component
    .locator("td")
    .first()
    .evaluate((el) => (el as HTMLElement).style.border);
  // style.border is a shorthand; inline value should be non-empty
  expect(borderStyle.length).toBeGreaterThan(0);
});

test("th has inline background and border", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  const { border, background } = await component
    .locator("th")
    .first()
    .evaluate((el) => ({
      border: (el as HTMLElement).style.border,
      background: (el as HTMLElement).style.backgroundColor,
    }));
  expect(border.length).toBeGreaterThan(0);
  expect(background.length).toBeGreaterThan(0);
});

test("table inline styles survive an aggressive host CSS reset (issue #214)", async ({
  mount,
}) => {
  // Mirrors the "inline styles beat a host CSS reset" pattern for tables.
  // A Tailwind-style preflight routinely zeroes table borders and
  // collapses cell padding. Inline styles win on specificity without
  // !important.
  const resetCSS = `
    table { border-collapse: separate; border-spacing: 2px; }
    th, td { border: 0; padding: 0; background: transparent; }
    th { font-weight: 400; }
  `;
  const component = await mount(
    <div>
      <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
      <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />
    </div>,
  );

  // Table still collapses borders
  const borderCollapse = await component
    .locator("table")
    .evaluate((el) => getComputedStyle(el).borderCollapse);
  expect(borderCollapse).toBe("collapse");

  // td still has a visible border
  const borderWidth = await component
    .locator("td")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(borderWidth).toBeGreaterThan(0);

  // td still has padding
  const padding = await component
    .locator("td")
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
  expect(padding).toBeGreaterThan(0);
});

test("renders GFM strikethrough", async ({ mount }) => {
  const component = await mount(<Markdown text="~~crossed out~~" />);
  await expect(component.locator("del")).toContainText("crossed out");
});

// ---------------------------------------------------------------------------
// Inline styling — issue #33
//
// These tests verify that markdown elements ship with default visual
// hierarchy as inline styles, NOT as a stylesheet rule the host might
// override or never load. The whole point is that prompts render
// correctly even when the host applies an aggressive CSS reset.
// ---------------------------------------------------------------------------

test("h1 renders with default size larger than body text", async ({
  mount,
}) => {
  const component = await mount(<Markdown text={"# Big\n\nSmall body."} />);
  const h1FontSize = await component
    .locator("h1")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const pFontSize = await component
    .locator("p")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(h1FontSize).toBeGreaterThan(pFontSize);
});

test("h1 > h2 > h3 > h4 > body in font size", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"# H1\n\n## H2\n\n### H3\n\n#### H4\n\nBody paragraph."} />,
  );
  const sizes = await Promise.all(
    ["h1", "h2", "h3", "h4", "p"].map((sel) =>
      component
        .locator(sel)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ),
  );
  // Strictly decreasing: h1 > h2 > h3 > h4 > p
  for (let i = 0; i < sizes.length - 1; i++) {
    expect(sizes[i]).toBeGreaterThan(sizes[i + 1]);
  }
});

test("h1 has bold weight", async ({ mount }) => {
  const component = await mount(<Markdown text="# Heading" />);
  const weight = await component
    .locator("h1")
    .evaluate((el) => parseInt(getComputedStyle(el).fontWeight, 10));
  expect(weight).toBeGreaterThanOrEqual(700);
});

test("strong renders with bold weight (matches browser default)", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="Some **bold** text" />);
  const weight = await component
    .locator("strong")
    .evaluate((el) => parseInt(getComputedStyle(el).fontWeight, 10));
  expect(weight).toBe(700);
});

test("em renders with italic style (matches browser default)", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="Some *italic* text" />);
  const style = await component
    .locator("em")
    .evaluate((el) => getComputedStyle(el).fontStyle);
  expect(style).toBe("italic");
});

test("ul renders with disc bullets, not none", async ({ mount }) => {
  const component = await mount(<Markdown text={"- alpha\n- beta\n- gamma"} />);
  const listStyleType = await component
    .locator("ul")
    .evaluate((el) => getComputedStyle(el).listStyleType);
  expect(listStyleType).toBe("disc");
});

test("ol renders with decimal numbering", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"1. first\n2. second\n3. third"} />,
  );
  const listStyleType = await component
    .locator("ol")
    .evaluate((el) => getComputedStyle(el).listStyleType);
  expect(listStyleType).toBe("decimal");
});

test("nested ol uses flat decimal numbering at every level", async ({
  mount,
}) => {
  // Locks in the intentional regression from the previous styles.css
  // implementation, which used CSS counters to render nested ordered
  // lists as 1., 1.1, 1.1.1. The new inline approach can't express
  // counter-based nested numbering (no ::before in inline styles), so
  // every level uses decimal "1., 2., 3.". If a researcher needs
  // counter-style nesting they can override --stagebook-prompt-* via a
  // host stylesheet that targets `#markdown ol > li::before`.
  const component = await mount(
    <Markdown text={"1. outer\n   1. inner\n   2. inner two"} />,
  );
  const outer = await component
    .locator("ol")
    .first()
    .evaluate((el) => getComputedStyle(el).listStyleType);
  const inner = await component
    .locator("ol ol")
    .first()
    .evaluate((el) => getComputedStyle(el).listStyleType);
  expect(outer).toBe("decimal");
  expect(inner).toBe("decimal");
});

test("links render with the stagebook-link color (default blue)", async ({
  mount,
}) => {
  const component = await mount(
    <Markdown text="[click](https://example.com)" />,
  );
  const color = await component
    .locator("a")
    .evaluate((el) => getComputedStyle(el).color);
  // Default is #2563eb = rgb(37, 99, 235)
  expect(color).toBe("rgb(37, 99, 235)");
});

test("blockquote has left border and background", async ({ mount }) => {
  const component = await mount(<Markdown text="> A quoted line." />);
  const styles = await component.locator("blockquote").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      borderLeftWidth: cs.borderLeftWidth,
      borderLeftStyle: cs.borderLeftStyle,
      backgroundColor: cs.backgroundColor,
    };
  });
  // 0.25rem = 4px (assuming 16px root)
  expect(parseFloat(styles.borderLeftWidth)).toBeGreaterThan(0);
  expect(styles.borderLeftStyle).toBe("solid");
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
});

test("CSS variable override changes h1 size", async ({ mount }) => {
  // Wrap in a div that sets the variable; the inline-styled h1 should pick
  // it up via var(--stagebook-prompt-h1-size, ...). This proves the override
  // mechanism works on hosts that don't ship the styles.css file.
  // Use an absolute unit so the assertion isn't sensitive to the host's
  // root font-size.
  const component = await mount(
    <div style={{ "--stagebook-prompt-h1-size": "48px" } as CSSProperties}>
      <Markdown text="# Override me" />
    </div>,
  );
  const fontSize = await component
    .locator("h1")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBe(48);
});

test("CSS variable override changes link color", async ({ mount }) => {
  const component = await mount(
    <div style={{ "--stagebook-link": "rgb(255, 0, 0)" } as CSSProperties}>
      <Markdown text="[red link](https://example.com)" />
    </div>,
  );
  const color = await component
    .locator("a")
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe("rgb(255, 0, 0)");
});

test("inline styles beat a host CSS reset (the load-bearing claim)", async ({
  mount,
}) => {
  // The whole point of inline styles: a host stylesheet that resets
  // h1 { font-size: 16px } should LOSE to our inline style. This is what
  // fails on hosts that ship Tailwind preflight or normalize.css and is
  // the core motivation for issue #33.
  //
  // We mount Markdown alongside an aggressive <style> tag that targets
  // h1/p/blockquote with the same kind of selector a host reset would.
  // It does NOT use !important — so this test only passes if Stagebook's
  // inline styles win on specificity grounds (which they always do
  // against selector-based rules). If someone refactors back to a
  // stylesheet-based approach, this test catches it.
  const resetCSS = `
    h1, h2, h3, h4 { font-size: 16px; font-weight: 400; }
    p { font-size: 16px; }
    blockquote { background: transparent; border-left: 0; }
  `;
  const component = await mount(
    <div>
      <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
      <Markdown text={"# Big heading\n\nBody.\n\n> Quote"} />
    </div>,
  );

  // h1 should still be larger than 16px (default 1.875rem ≈ 30px)
  const h1Size = await component
    .locator("h1")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(h1Size).toBeGreaterThan(16);

  // h1 should still be bold (default 700), not the reset's 400
  const h1Weight = await component
    .locator("h1")
    .evaluate((el) => parseInt(getComputedStyle(el).fontWeight, 10));
  expect(h1Weight).toBeGreaterThanOrEqual(700);

  // blockquote should still have a left border, not the reset's 0
  const borderWidth = await component
    .locator("blockquote")
    .evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
  expect(borderWidth).toBeGreaterThan(0);
});

test("CSS variable override changes blockquote background", async ({
  mount,
}) => {
  const component = await mount(
    <div
      style={{ "--stagebook-blockquote-bg": "rgb(0, 255, 0)" } as CSSProperties}
    >
      <Markdown text="> green" />
    </div>,
  );
  const bg = await component
    .locator("blockquote")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(0, 255, 0)");
});

// ---------------------------------------------------------------------------
// <hr> and <pre> — issue #215
//
// `---` in markdown renders as <hr>, which Tailwind preflight and similar
// resets collapse with `border: 0`. Fenced code blocks wrap in <pre>; with
// no handler they render as naked pre-formatted text (no background, no
// monospace font, no overflow scroll). These tests lock in the inline
// styling that makes both render portably on any host.
// ---------------------------------------------------------------------------

test("hr renders with visible top border (survives UA stripping)", async ({
  mount,
}) => {
  const component = await mount(<Markdown text={"above\n\n---\n\nbelow"} />);
  const borderTopWidth = await component
    .locator("hr")
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(borderTopWidth).toBeGreaterThan(0);
});

test("hr survives a host CSS reset that sets hr { border: 0 }", async ({
  mount,
}) => {
  // Mirrors the "inline styles beat a host CSS reset" pattern: Tailwind
  // preflight ships `hr { border: 0 }` which collapses the default UA
  // border. Our inline border-top must win on specificity.
  const resetCSS = `hr { border: 0; }`;
  const component = await mount(
    <div>
      <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
      <Markdown text={"above\n\n---\n\nbelow"} />
    </div>,
  );
  const borderTopWidth = await component
    .locator("hr")
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));
  expect(borderTopWidth).toBeGreaterThan(0);
});

test("fenced code block renders with background, monospace font, and horizontal overflow", async ({
  mount,
}) => {
  const component = await mount(<Markdown text={"```js\nconst x = 1;\n```"} />);
  const styles = await component.locator("pre").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      fontFamily: cs.fontFamily,
      overflowX: cs.overflowX,
    };
  });
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.backgroundColor).not.toBe("transparent");
  expect(styles.fontFamily.toLowerCase()).toMatch(/mono|menlo|consolas|sfmono/);
  expect(styles.overflowX).toBe("auto");
});

test("fenced code block does not double-wrap background on the inner code", async ({
  mount,
}) => {
  // The <pre> carries the chip styling; the inner <code class="language-*">
  // must NOT also apply its own background/padding, or the block looks
  // like a nested box.
  const component = await mount(<Markdown text={"```js\nconst x = 1;\n```"} />);
  const innerCodeInline = await component
    .locator("pre > code")
    .evaluate((el) => ({
      background: (el as HTMLElement).style.background,
      padding: (el as HTMLElement).style.padding,
    }));
  expect(innerCodeInline.background).toBe("");
  expect(innerCodeInline.padding).toBe("");
});

test("inline code renders as a styled chip with background and padding", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="Use `npm test` to run." />);
  const styles = await component.locator("code").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      backgroundColor: cs.backgroundColor,
      fontFamily: cs.fontFamily,
    };
  });
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.backgroundColor).not.toBe("transparent");
  expect(styles.fontFamily.toLowerCase()).toMatch(/mono|menlo|consolas|sfmono/);
});

// Issue #213: GFM task-list checkboxes are disabled <input type="checkbox">
// emitted by remark-gfm. They need the same inline primary-fill + check
// SVG as RadioGroup/CheckboxGroup so they render on hosts without
// styles.css loaded. Focus ring not needed (the inputs are disabled).
test("GFM task-list checkbox has inline base + check SVG when checked", async ({
  mount,
}) => {
  const component = await mount(<Markdown text={"- [x] done\n- [ ] todo"} />);
  const checked = component.locator('input[type="checkbox"]').first();
  const unchecked = component.locator('input[type="checkbox"]').nth(1);

  const checkedStyle = await checked.evaluate((el) => ({
    appearance: (el as HTMLElement).style.appearance,
    backgroundColor: (el as HTMLElement).style.backgroundColor,
    backgroundImage: (el as HTMLElement).style.backgroundImage,
  }));
  expect(checkedStyle.appearance).toBe("none");
  expect(checkedStyle.backgroundColor).toContain("--stagebook-primary");
  expect(checkedStyle.backgroundImage).toContain("data:image/svg+xml");

  const uncheckedStyle = await unchecked.evaluate((el) => ({
    appearance: (el as HTMLElement).style.appearance,
    backgroundColor: (el as HTMLElement).style.backgroundColor,
    backgroundImage: (el as HTMLElement).style.backgroundImage,
  }));
  expect(uncheckedStyle.appearance).toBe("none");
  expect(uncheckedStyle.backgroundColor).toContain("--stagebook-surface");
  expect(uncheckedStyle.backgroundImage).toBe("");
});
