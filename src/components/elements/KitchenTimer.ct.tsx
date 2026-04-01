import { test, expect } from "@playwright/experimental-ct-react";
import { KitchenTimer } from "./KitchenTimer";

// Note: Playwright CT serializes function props, so getElapsedTime always
// returns 0 in these tests. We test different timer states by varying
// startTime/endTime/warnTimeRemaining relative to elapsed=0.

test("renders time remaining at start", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer startTime={0} endTime={60} getElapsedTime={() => 0} />,
  );
  await expect(component).toContainText("01:00");
});

test("renders progress bar track and fill", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer startTime={0} endTime={60} getElapsedTime={() => 0} />,
  );
  // The fill div exists (may be 0px wide at elapsed=0)
  await expect(component.locator('[data-testid="timer-fill"]')).toBeAttached();
});

test("not in warning state at start of 60s timer", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer
      startTime={0}
      endTime={60}
      warnTimeRemaining={10}
      getElapsedTime={() => 0}
    />,
  );
  // The root component has data-warning attribute
  await expect(component).toHaveAttribute("data-warning", "false");
});

test("in warning state when remaining <= warnTimeRemaining", async ({
  mount,
}) => {
  // endTime=10, warnTimeRemaining=15 → at elapsed=0, remaining=10 which is <= 15
  const component = await mount(
    <KitchenTimer
      startTime={0}
      endTime={10}
      warnTimeRemaining={15}
      getElapsedTime={() => 0}
    />,
  );
  await expect(component).toHaveAttribute("data-warning", "true");
});

test("warning state uses red fill color", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer
      startTime={0}
      endTime={10}
      warnTimeRemaining={15}
      getElapsedTime={() => 0}
    />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  // Red fill when in warning
  await expect(fill).toHaveCSS("background-color", "rgb(239, 68, 68)");
});

test("normal state uses blue fill color", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer
      startTime={0}
      endTime={60}
      warnTimeRemaining={10}
      getElapsedTime={() => 0}
    />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  // Blue fill when not warning
  await expect(fill).toHaveCSS("background-color", "rgb(96, 165, 250)");
});

test("formats time with hours when over 60 minutes", async ({ mount }) => {
  const component = await mount(
    <KitchenTimer startTime={0} endTime={7200} getElapsedTime={() => 0} />,
  );
  await expect(component).toContainText("02:00:00");
});
