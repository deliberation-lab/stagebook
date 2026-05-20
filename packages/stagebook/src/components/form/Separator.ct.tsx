import { test, expect } from "@playwright/experimental-ct-react";
import { Separator } from "./Separator";

// The Separator renders a single <hr> as its root element, so the
// Playwright `mount` locator IS the <hr> — assert against `component`
// directly rather than locator("hr") (which would search for a nested
// hr inside the hr, which doesn't exist).

test("renders regular separator by default", async ({ mount }) => {
  const component = await mount(<Separator />);
  await expect(component).toBeVisible();
  await expect(component).toHaveCSS("height", "3px");
});

test("renders thin separator", async ({ mount }) => {
  const component = await mount(<Separator style="thin" />);
  await expect(component).toHaveCSS("height", "1px");
});

test("renders thick separator", async ({ mount }) => {
  const component = await mount(<Separator style="thick" />);
  await expect(component).toHaveCSS("height", "5px");
});

// ----------- UI polish (#350 tier 2) -----------

test("legacy empty-string style resolves to regular (back-compat)", async ({
  mount,
}) => {
  // The prompt-file schema historically accepted `style: ""` to mean
  // "unspecified" and that resolved to regular. The refactor switched
  // from three ternaries to a single lookup; this locks in the same
  // back-compat behavior.
  const component = await mount(<Separator style="" />);
  await expect(component).toHaveCSS("height", "3px");
});

test("renders <hr> directly (no wrapper div)", async ({ mount }) => {
  // Polish: the previous implementation wrapped <hr> in a structurally
  // pointless <div>. <hr> is already block-level, so the wrapper added
  // a DOM node for no rendering reason. Asserts the mounted root IS
  // an <hr>; guards against accidental reintroduction of a wrapper.
  const component = await mount(<Separator />);
  const tagName = await component.evaluate((el) => el.tagName);
  expect(tagName).toBe("HR");
});

test("uses border longhands, not the border shorthand (#367 defense)", async ({
  mount,
}) => {
  // React's inline-style diff has been observed to clear `border` (a
  // shorthand) without re-emitting the longhand expansion when
  // switching between styles — surfaces as a stray default border
  // stripe overlapping the colored bar. The fix is to use the
  // longhand `borderStyle: "none"` (not the shorthand `border:
  // "none"`). Reads the inline style attribute to confirm we ship
  // longhands.
  const component = await mount(<Separator />);
  const inlineStyle = await component.evaluate(
    (el) => el.getAttribute("style") ?? "",
  );
  // We want `border-style: none` (the longhand) and NO bare `border`
  // shorthand. Regex excludes `border-style`, `border-color`, etc.
  expect(inlineStyle).toMatch(/border-style:\s*none/);
  expect(inlineStyle).not.toMatch(/(?:^|;)\s*border\s*:/);
});

test("inline styles survive an aggressive host CSS reset", async ({
  mount,
}) => {
  // Mirror of the table inline-style test (#214) and the <hr> test
  // in Markdown.ct.tsx. A Tailwind-style preflight ships:
  //   hr { border-top-width: 1px; color: inherit; background: transparent; }
  // The Separator's inline `backgroundColor` and `height` must beat
  // those resets so the rule stays visible regardless of host.
  const resetCSS = `
    hr {
      border-top-width: 1px;
      background-color: transparent;
      height: 0;
    }
  `;
  const component = await mount(
    <div>
      <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
      <Separator style="thick" />
    </div>,
  );
  const hr = component.locator("hr");
  // height stays at 5px (the thick variant), not 0
  const height = await hr.evaluate((el) =>
    parseFloat(getComputedStyle(el).height),
  );
  expect(height).toBeGreaterThanOrEqual(5);
  // background-color stays the muted token, not transparent
  const bg = await hr.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");
});
