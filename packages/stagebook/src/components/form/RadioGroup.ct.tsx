import { test, expect } from "@playwright/experimental-ct-react";
import { RadioGroup } from "./RadioGroup";
import { MockRadioGroup } from "../testing/MockRadioGroup";

const options = [
  { key: "a", value: "Option A" },
  { key: "b", value: "Option B" },
  { key: "c", value: "Option C" },
];

test.describe("RadioGroup", () => {
  test("renders all options", async ({ mount }) => {
    const component = await mount(
      <RadioGroup options={options} onChange={() => {}} />,
    );
    await expect(component.locator("label")).toHaveCount(3);
    await expect(component).toContainText("Option A");
    await expect(component).toContainText("Option B");
    await expect(component).toContainText("Option C");
  });

  test("shows selected option as checked", async ({ mount }) => {
    const component = await mount(
      <RadioGroup options={options} value="b" onChange={() => {}} />,
    );
    await expect(component.locator('input[value="b"]')).toBeChecked();
    await expect(component.locator('input[value="a"]')).not.toBeChecked();
  });

  test("renders label when provided", async ({ mount }) => {
    const component = await mount(
      <RadioGroup options={options} onChange={() => {}} label="Pick one" />,
    );
    await expect(component).toContainText("Pick one");
  });

  test("clicking an option updates selection", async ({ mount }) => {
    const component = await mount(<MockRadioGroup options={options} />);
    // Nothing selected initially
    await expect(
      component.locator('[data-testid="selected-value"]'),
    ).toHaveText("");

    // Click Option B
    await component.getByText("Option B").click();
    await expect(
      component.locator('[data-testid="selected-value"]'),
    ).toHaveText("b");

    // Click Option A — should switch
    await component.getByText("Option A").click();
    await expect(
      component.locator('[data-testid="selected-value"]'),
    ).toHaveText("a");
  });

  test("selecting one deselects others", async ({ mount }) => {
    const component = await mount(
      <MockRadioGroup options={options} initialValue="a" />,
    );
    await expect(component.locator('input[value="a"]')).toBeChecked();

    await component.getByText("Option C").click();
    await expect(component.locator('input[value="c"]')).toBeChecked();
    await expect(component.locator('input[value="a"]')).not.toBeChecked();
    await expect(component.locator('input[value="b"]')).not.toBeChecked();
  });

  // Issue #213: radio visual styling moved from styles.css to inline
  // styles so the radio renders with a visible dot + primary-color fill
  // on hosts that don't import stagebook/styles.
  test("unchecked radio has inline base styling (surface bg, bordered)", async ({
    mount,
  }) => {
    const component = await mount(
      <RadioGroup options={options} onChange={() => {}} />,
    );
    const { appearance, borderRadius, backgroundColor } = await component
      .locator('input[value="a"]')
      .evaluate((el) => ({
        appearance: (el as HTMLElement).style.appearance,
        borderRadius: (el as HTMLElement).style.borderRadius,
        backgroundColor: (el as HTMLElement).style.backgroundColor,
      }));
    expect(appearance).toBe("none");
    // 9999px = "fully rounded" — the radio shape
    expect(borderRadius).toBe("9999px");
    expect(backgroundColor).toContain("--stagebook-surface");
  });

  test("checked radio has inline primary fill + dot SVG", async ({ mount }) => {
    const component = await mount(
      <RadioGroup options={options} value="b" onChange={() => {}} />,
    );
    const { backgroundColor, backgroundImage } = await component
      .locator('input[value="b"]')
      .evaluate((el) => ({
        backgroundColor: (el as HTMLElement).style.backgroundColor,
        backgroundImage: (el as HTMLElement).style.backgroundImage,
      }));
    expect(backgroundColor).toContain("--stagebook-primary");
    expect(backgroundImage).toContain("data:image/svg+xml");
  });

  test("previously-checked radio reverts to gray border after deselection (no color bleed)", async ({
    mount,
  }) => {
    // Regression: when one radio was selected and then another was
    // clicked, the previously-selected radio's border stayed black
    // (browser default for appearance:none inputs) instead of
    // reverting to the gray default. Root cause: mixing the `border`
    // shorthand in base style with a `borderColor` longhand override
    // in the checked style — React's inline-style diff cleared the
    // longhand on deselect, blowing away the shorthand's expansion.
    // Fix: use border longhands consistently in base style.
    const component = await mount(
      <MockRadioGroup options={options} initialValue="a" />,
    );

    // Sanity: A starts checked
    await expect(component.locator('input[value="a"]')).toBeChecked();

    // Click B to deselect A
    await component.getByText("Option B").click();
    await expect(component.locator('input[value="b"]')).toBeChecked();
    await expect(component.locator('input[value="a"]')).not.toBeChecked();

    // The previously-checked A and never-clicked C should have the
    // same gray border. Pre-fix: A had rgb(0, 0, 0), C had rgb(209,
    // 213, 219).
    const aBorder = await component
      .locator('input[value="a"]')
      .evaluate((el) => window.getComputedStyle(el).borderColor);
    const cBorder = await component
      .locator('input[value="c"]')
      .evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(aBorder).toBe(cBorder);
  });

  test("focus ring appears inline on focus and disappears on blur", async ({
    mount,
  }) => {
    const component = await mount(
      <RadioGroup options={options} onChange={() => {}} />,
    );
    const input = component.locator('input[value="a"]');

    // Nothing before focus
    expect(
      await input.evaluate((el) => (el as HTMLElement).style.boxShadow),
    ).toBe("");

    await input.focus();
    expect(
      await input.evaluate((el) => (el as HTMLElement).style.boxShadow),
    ).toContain("--stagebook-focus-ring");

    await input.blur();
    expect(
      await input.evaluate((el) => (el as HTMLElement).style.boxShadow),
    ).toBe("");
  });

  test("inline styles survive an aggressive host CSS reset (issue #213)", async ({
    mount,
  }) => {
    // The point of moving these styles inline: survive hosts that reset
    // `input { appearance: auto; background: ...; border: ... }` without
    // !important. Inline styles win on specificity.
    const resetCSS = `
      input[type="radio"] {
        appearance: auto;
        border: 2px solid red;
        background: yellow;
        border-radius: 0;
      }
    `;
    const component = await mount(
      <div>
        <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
        <RadioGroup options={options} value="a" onChange={() => {}} />
      </div>,
    );
    const { appearance, borderRadius } = await component
      .locator('input[value="a"]')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { appearance: cs.appearance, borderRadius: cs.borderRadius };
      });
    expect(appearance).toBe("none");
    // 9999px typically resolves to the half-height in computed pixels —
    // but the key thing is that the reset's `0` didn't win.
    expect(borderRadius).not.toBe("0px");
  });
});
