import { test, expect } from "@playwright/experimental-ct-react";
import { ThemedButton } from "../testing/ThemedButton";
import { ThemedKitchenTimer } from "../testing/ThemedKitchenTimer";
import { ThemedTextArea } from "../testing/ThemedTextArea";
import { SideBySideButtons } from "../testing/SideBySideButtons";

// Orange theme — deliberately very different from the default blue
// to make visual differences obvious in the Playwright UI
const orangeTheme = {
  "--score-primary": "#ea580c", // orange-600
  "--score-timer-fill": "#f97316", // orange-500
  "--score-danger": "#dc2626", // red-600
  "--score-border": "#fb923c", // orange-400
  "--score-success": "#ea580c", // orange-600 (green → orange)
  "--score-warning": "#f97316", // orange-500 (red → orange)
};

test.describe("CSS Variable Theme Override", () => {
  test("Button uses overridden primary color (blue → orange)", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedButton themeOverrides={orangeTheme}>Themed Button</ThemedButton>,
    );
    const button = component.locator("button");
    // #ea580c = rgb(234, 88, 12)
    await expect(button).toHaveCSS("background-color", "rgb(234, 88, 12)");
  });

  test("Button secondary uses overridden border color", async ({ mount }) => {
    const component = await mount(
      <ThemedButton themeOverrides={orangeTheme} primary={false}>
        Secondary
      </ThemedButton>,
    );
    const button = component.locator("button");
    // #fb923c = rgb(251, 146, 60)
    await expect(button).toHaveCSS("border-color", "rgb(251, 146, 60)");
  });

  test("KitchenTimer uses overridden fill color (blue → orange)", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedKitchenTimer
        startTime={0}
        endTime={60}
        elapsedTime={30}
        themeOverrides={orangeTheme}
      />,
    );
    const fill = component.locator('[data-testid="timer-fill"]');
    // #f97316 = rgb(249, 115, 22)
    await expect(fill).toHaveCSS("background-color", "rgb(249, 115, 22)");
  });

  test("KitchenTimer warning uses overridden danger color", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedKitchenTimer
        startTime={0}
        endTime={60}
        warnTimeRemaining={15}
        elapsedTime={50}
        themeOverrides={orangeTheme}
      />,
    );
    const fill = component.locator('[data-testid="timer-fill"]');
    // #dc2626 = rgb(220, 38, 38)
    await expect(fill).toHaveCSS("background-color", "rgb(220, 38, 38)");
  });

  test("TextArea counter uses overridden success color (green → orange)", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedTextArea
        value={"A".repeat(75)}
        showCharacterCount
        minLength={50}
        maxLength={200}
        themeOverrides={orangeTheme}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    // #ea580c = rgb(234, 88, 12)
    await expect(counter).toHaveCSS("color", "rgb(234, 88, 12)");
  });

  test("TextArea counter uses overridden warning color (red → orange)", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedTextArea
        value="12345"
        showCharacterCount
        maxLength={5}
        themeOverrides={orangeTheme}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    // #f97316 = rgb(249, 115, 22)
    await expect(counter).toHaveCSS("color", "rgb(249, 115, 22)");
  });

  test("side-by-side: blue default vs orange override", async ({ mount }) => {
    const component = await mount(<SideBySideButtons />);
    await expect(component).toContainText("Default Blue");
    await expect(component).toContainText("Custom Orange");
    // Both buttons should be visible
    const buttons = component.locator("button");
    await expect(buttons).toHaveCount(2);
  });
});
