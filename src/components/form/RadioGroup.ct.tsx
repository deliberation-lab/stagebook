import { test, expect } from "@playwright/experimental-ct-react";
import { RadioGroup } from "./RadioGroup";

const options = [
  { key: "a", value: "Option A" },
  { key: "b", value: "Option B" },
  { key: "c", value: "Option C" },
];

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
