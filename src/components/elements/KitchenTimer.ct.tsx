import { test, expect } from "@playwright/experimental-ct-react";
import { MockKitchenTimer } from "../testing/MockKitchenTimer";

// Uses MockKitchenTimer wrapper so getElapsedTime works in the browser.

// -- Time display --

test("shows full time at start", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={0} />,
  );
  await expect(component).toContainText("01:00");
});

test("shows remaining time at 50%", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={30} />,
  );
  await expect(component).toContainText("00:30");
});

test("shows 00:00 when expired", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={120} />,
  );
  await expect(component).toContainText("00:00");
});

test("formats time with hours when over 60 minutes", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={7200} elapsedTime={0} />,
  );
  await expect(component).toContainText("02:00:00");
});

// -- Progress bar fill --

test("progress bar at 0% when not started", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={0} />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  await expect(fill).toHaveCSS("width", "0px");
});

test("progress bar partially filled at 50%", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={30} />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  const width = await fill.evaluate((el) => el.style.width);
  expect(width).toBe("50%");
});

test("progress bar at 75%", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={100} elapsedTime={75} />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  const width = await fill.evaluate((el) => el.style.width);
  expect(width).toBe("75%");
});

test("progress bar capped at 100% when expired", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer startTime={0} endTime={60} elapsedTime={120} />,
  );
  const fill = component.locator('[data-testid="timer-fill"]');
  const width = await fill.evaluate((el) => el.style.width);
  expect(width).toBe("100%");
});

// -- Warning state & colors --

test("blue fill when not in warning zone", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer
      startTime={0}
      endTime={60}
      warnTimeRemaining={10}
      elapsedTime={30}
    />,
  );
  await expect(component).toHaveAttribute("data-warning", "false");
  const fill = component.locator('[data-testid="timer-fill"]');
  await expect(fill).toHaveCSS("background-color", "rgb(96, 165, 250)");
});

test("red fill when in warning zone", async ({ mount }) => {
  const component = await mount(
    <MockKitchenTimer
      startTime={0}
      endTime={60}
      warnTimeRemaining={15}
      elapsedTime={50}
    />,
  );
  // remaining = 10, which is <= 15
  await expect(component).toHaveAttribute("data-warning", "true");
  const fill = component.locator('[data-testid="timer-fill"]');
  await expect(fill).toHaveCSS("background-color", "rgb(239, 68, 68)");
});

test("transition from blue to red at warning boundary", async ({ mount }) => {
  // remaining = 10, warn = 10 → exactly at boundary, should be warning
  const component = await mount(
    <MockKitchenTimer
      startTime={0}
      endTime={60}
      warnTimeRemaining={10}
      elapsedTime={50}
    />,
  );
  await expect(component).toHaveAttribute("data-warning", "true");
});

// -- Delayed start --

test("timer with delayed start shows full time before startTime", async ({
  mount,
}) => {
  const component = await mount(
    <MockKitchenTimer startTime={30} endTime={90} elapsedTime={10} />,
  );
  // Stage elapsed=10, but timer starts at 30, so timer hasn't started yet
  await expect(component).toContainText("01:00");
  const fill = component.locator('[data-testid="timer-fill"]');
  await expect(fill).toHaveCSS("width", "0px");
});

test("timer with delayed start shows progress after startTime", async ({
  mount,
}) => {
  const component = await mount(
    <MockKitchenTimer startTime={30} endTime={90} elapsedTime={60} />,
  );
  // 30 seconds into a 60-second timer → 50%
  await expect(component).toContainText("00:30");
  const fill = component.locator('[data-testid="timer-fill"]');
  const width = await fill.evaluate((el) => el.style.width);
  expect(width).toBe("50%");
});
