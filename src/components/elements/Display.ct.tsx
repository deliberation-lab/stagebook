import { test, expect } from "@playwright/experimental-ct-react";
import { Display } from "./Display";

test("renders values as text", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.question1" values={["Hello", "World"]} />,
  );
  await expect(component).toContainText("Hello");
  await expect(component).toContainText("World");
});

test("renders as a blockquote element", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.q1" values={["Answer"]} />,
  );
  // The component itself is the blockquote
  await expect(component).toContainText("Answer");
});

test("handles non-string values via JSON serialization", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.q1" values={[42, true]} />,
  );
  await expect(component).toContainText("42");
  await expect(component).toContainText("true");
});

// ---------------------------------------------------------------------------
// Inline blockquote styling — issue #33
// ---------------------------------------------------------------------------

test("renders with default left border and background (no Tailwind needed)", async ({
  mount,
}) => {
  const component = await mount(
    <Display reference="prompt.q1" values={["styled"]} />,
  );
  const styles = await component.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      borderLeftWidth: cs.borderLeftWidth,
      borderLeftStyle: cs.borderLeftStyle,
      backgroundColor: cs.backgroundColor,
    };
  });
  expect(parseFloat(styles.borderLeftWidth)).toBeGreaterThan(0);
  expect(styles.borderLeftStyle).toBe("solid");
  expect(styles.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
});

test("CSS variable override changes background", async ({ mount }) => {
  const component = await mount(
    <div
      style={
        { "--score-blockquote-bg": "rgb(0, 0, 255)" } as React.CSSProperties
      }
    >
      <Display reference="prompt.q1" values={["blue bg"]} />
    </div>,
  );
  const bg = await component
    .locator("blockquote")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe("rgb(0, 0, 255)");
});

test("CSS variable override changes left border color", async ({ mount }) => {
  const component = await mount(
    <div
      style={
        {
          "--score-blockquote-border": "rgb(255, 0, 255)",
        } as React.CSSProperties
      }
    >
      <Display reference="prompt.q1" values={["magenta border"]} />
    </div>,
  );
  const borderColor = await component
    .locator("blockquote")
    .evaluate((el) => getComputedStyle(el).borderLeftColor);
  expect(borderColor).toBe("rgb(255, 0, 255)");
});
