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

test("links render with the score-link color (default blue)", async ({
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
  // It does NOT use !important — so this test only passes if SCORE's
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
