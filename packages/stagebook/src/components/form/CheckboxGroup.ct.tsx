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
});
