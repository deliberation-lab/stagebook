import { test, expect } from "@playwright/experimental-ct-react";
import { ScrollIndicator } from "./ScrollIndicator";

test.describe("ScrollIndicator", () => {
  test("renders when visible", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toBeVisible();
  });

  test("renders nothing when not visible", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={false} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toHaveCount(0);
  });

  test("has aria-hidden for accessibility", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(
      component.locator('[data-testid="scroll-indicator"]'),
    ).toHaveAttribute("aria-hidden", "true");
  });

  test("renders down-arrow SVG", async ({ mount }) => {
    const component = await mount(<ScrollIndicator visible={true} />);
    await expect(component.locator("svg")).toBeVisible();
  });
});
