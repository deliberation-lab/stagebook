import { test, expect } from "@playwright/experimental-ct-react";
import { CheckboxGroup } from "./CheckboxGroup";

const options = [
  { key: "x", value: "Choice X" },
  { key: "y", value: "Choice Y" },
  { key: "z", value: "Choice Z" },
];

test("renders all options", async ({ mount }) => {
  const component = await mount(
    <CheckboxGroup options={options} value={[]} onChange={() => {}} />,
  );
  await expect(component.locator('input[type="checkbox"]')).toHaveCount(3);
});

test("shows selected options as checked", async ({ mount }) => {
  const component = await mount(
    <CheckboxGroup options={options} value={["x", "z"]} onChange={() => {}} />,
  );
  await expect(component.locator('input[value="x"]')).toBeChecked();
  await expect(component.locator('input[value="y"]')).not.toBeChecked();
  await expect(component.locator('input[value="z"]')).toBeChecked();
});
