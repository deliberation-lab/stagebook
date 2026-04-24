import { test, expect } from "@playwright/experimental-ct-react";
import { CheckboxGroup } from "./CheckboxGroup";
import { MockCheckboxGroup } from "../testing/MockCheckboxGroup";

const options = [
  { key: "x", value: "Choice X" },
  { key: "y", value: "Choice Y" },
  { key: "z", value: "Choice Z" },
];

test.describe("CheckboxGroup", () => {
  test("renders all options", async ({ mount }) => {
    const component = await mount(
      <CheckboxGroup options={options} value={[]} onChange={() => {}} />,
    );
    await expect(component.locator('input[type="checkbox"]')).toHaveCount(3);
  });

  test("shows selected options as checked", async ({ mount }) => {
    const component = await mount(
      <CheckboxGroup
        options={options}
        value={["x", "z"]}
        onChange={() => {}}
      />,
    );
    await expect(component.locator('input[value="x"]')).toBeChecked();
    await expect(component.locator('input[value="y"]')).not.toBeChecked();
    await expect(component.locator('input[value="z"]')).toBeChecked();
  });

  test("clicking an unchecked option selects it", async ({ mount }) => {
    const component = await mount(<MockCheckboxGroup options={options} />);
    await expect(
      component.locator('[data-testid="selected-values"]'),
    ).toHaveText("");

    await component.getByText("Choice Y").click();
    await expect(
      component.locator('[data-testid="selected-values"]'),
    ).toHaveText("y");
  });

  test("clicking a checked option deselects it", async ({ mount }) => {
    const component = await mount(
      <MockCheckboxGroup options={options} initialValue={["x", "z"]} />,
    );
    await expect(
      component.locator('[data-testid="selected-values"]'),
    ).toHaveText("x|z");

    await component.getByText("Choice X").click();
    await expect(
      component.locator('[data-testid="selected-values"]'),
    ).toHaveText("z");
  });

  test("multiple selections accumulate", async ({ mount }) => {
    const component = await mount(<MockCheckboxGroup options={options} />);

    await component.getByText("Choice X").click();
    await component.getByText("Choice Z").click();
    await expect(
      component.locator('[data-testid="selected-values"]'),
    ).toHaveText("x|z");
  });

  // Issue #213: checkbox visual styling moved from styles.css to inline
  // so the checkbox renders with a visible check + primary-color fill on
  // hosts that don't import stagebook/styles.
  test("unchecked checkbox has inline base styling (surface bg, bordered)", async ({
    mount,
  }) => {
    const component = await mount(
      <CheckboxGroup options={options} value={[]} onChange={() => {}} />,
    );
    const { appearance, borderRadius, backgroundColor } = await component
      .locator('input[value="x"]')
      .evaluate((el) => ({
        appearance: (el as HTMLElement).style.appearance,
        borderRadius: (el as HTMLElement).style.borderRadius,
        backgroundColor: (el as HTMLElement).style.backgroundColor,
      }));
    expect(appearance).toBe("none");
    // Small rounded square (not radio's 9999px)
    expect(borderRadius).toBe("0.125rem");
    expect(backgroundColor).toContain("--stagebook-surface");
  });

  test("checked checkbox has inline primary fill + check SVG", async ({
    mount,
  }) => {
    const component = await mount(
      <CheckboxGroup options={options} value={["x"]} onChange={() => {}} />,
    );
    const { backgroundColor, backgroundImage } = await component
      .locator('input[value="x"]')
      .evaluate((el) => ({
        backgroundColor: (el as HTMLElement).style.backgroundColor,
        backgroundImage: (el as HTMLElement).style.backgroundImage,
      }));
    expect(backgroundColor).toContain("--stagebook-primary");
    expect(backgroundImage).toContain("data:image/svg+xml");
  });

  test("focus ring appears inline on focus and disappears on blur", async ({
    mount,
  }) => {
    const component = await mount(
      <CheckboxGroup options={options} value={[]} onChange={() => {}} />,
    );
    const input = component.locator('input[value="x"]');

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
    const resetCSS = `
      input[type="checkbox"] {
        appearance: auto;
        border: 2px solid red;
        background: yellow;
        border-radius: 0;
      }
    `;
    const component = await mount(
      <div>
        <style dangerouslySetInnerHTML={{ __html: resetCSS }} />
        <CheckboxGroup options={options} value={["x"]} onChange={() => {}} />
      </div>,
    );
    const { appearance, borderRadius } = await component
      .locator('input[value="x"]')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { appearance: cs.appearance, borderRadius: cs.borderRadius };
      });
    expect(appearance).toBe("none");
    expect(borderRadius).not.toBe("0px");
  });
});
