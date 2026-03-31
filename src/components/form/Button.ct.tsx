import { test, expect } from "@playwright/experimental-ct-react";
import { Button } from "./Button";

test("renders with children text", async ({ mount }) => {
  const component = await mount(<Button>Click me</Button>);
  await expect(component).toContainText("Click me");
});

test("calls onClick when clicked", async ({ mount }) => {
  let clicked = false;
  const component = await mount(
    <Button
      onClick={() => {
        clicked = true;
      }}
    >
      Submit
    </Button>,
  );
  await component.click();
  expect(clicked).toBe(true);
});

test("renders as disabled", async ({ mount }) => {
  const component = await mount(<Button disabled>Disabled</Button>);
  await expect(component).toBeDisabled();
});

test("applies secondary style when primary is false", async ({ mount }) => {
  const component = await mount(<Button primary={false}>Secondary</Button>);
  await expect(component).toHaveClass(/bg-white/);
});
