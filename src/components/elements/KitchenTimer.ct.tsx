import { test, expect } from "@playwright/experimental-ct-react";
import { KitchenTimer } from "./KitchenTimer";

// Note: Playwright CT serializes function props, so getElapsedTime always
// returns 0 in these tests. Time-dependent behavior (countdown, warning state)
// should be tested via vitest or Playwright e2e tests with a real provider.

test("renders timer display", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer startTime={0} endTime={60} getElapsedTime={() => 0} />,
  );
  // Shows formatted time
  await expect(component).toContainText("01:00");
});

test("renders progress bar", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer startTime={0} endTime={60} getElapsedTime={() => 0} />,
  );
  // Has the progress bar structure
  await expect(component.locator(".rounded-full")).toHaveCount(2);
});
