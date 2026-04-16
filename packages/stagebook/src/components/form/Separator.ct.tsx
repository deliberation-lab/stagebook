import { test, expect } from "@playwright/experimental-ct-react";
import { Separator } from "./Separator";

test("renders regular separator by default", async ({ mount }) => {
  const component = await mount(<Separator />);
  const hr = component.locator("hr");
  await expect(hr).toBeVisible();
  await expect(hr).toHaveCSS("height", "3px");
});

test("renders thin separator", async ({ mount }) => {
  const component = await mount(<Separator style="thin" />);
  await expect(component.locator("hr")).toHaveCSS("height", "1px");
});

test("renders thick separator", async ({ mount }) => {
  const component = await mount(<Separator style="thick" />);
  await expect(component.locator("hr")).toHaveCSS("height", "5px");
});
