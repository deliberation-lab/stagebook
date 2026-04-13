import { test, expect } from "@playwright/experimental-ct-react";
import { Separator } from "./Separator";

test("renders regular separator by default", async ({ mount }) => {
  const component = await mount(<Separator />);
  await expect(component.locator("hr")).toBeVisible();
  await expect(component.locator("hr")).toHaveClass(/h-3px/);
});

test("renders thin separator", async ({ mount }) => {
  const component = await mount(<Separator style="thin" />);
  await expect(component.locator("hr")).toHaveClass(/h-1px/);
});

test("renders thick separator", async ({ mount }) => {
  const component = await mount(<Separator style="thick" />);
  await expect(component.locator("hr")).toHaveClass(/h-5px/);
});
