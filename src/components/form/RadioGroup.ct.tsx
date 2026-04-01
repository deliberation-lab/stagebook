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
});
