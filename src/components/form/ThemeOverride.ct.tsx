import { test, expect } from "@playwright/experimental-ct-react";
import { ThemedButton } from "../testing/ThemedButton";
import { ThemedKitchenTimer } from "../testing/ThemedKitchenTimer";
import { ThemedTextArea } from "../testing/ThemedTextArea";

const purpleTheme = {
  "--score-primary": "#7c3aed",
  "--score-timer-fill": "#a855f7",
  "--score-danger": "#b91c1c",
  "--score-border": "#818cf8",
  "--score-success": "#065f46",
  "--score-warning": "#92400e",
};

test.describe("CSS Variable Theme Override", () => {
  test("Button uses overridden primary color", async ({ mount }) => {
    const component = await mount(
      <ThemedButton themeOverrides={purpleTheme}>Themed Button</ThemedButton>,
    );
    const button = component.locator("button");
    await expect(button).toHaveCSS("background-color", "rgb(124, 58, 237)");
  });

  test("Button secondary uses overridden border color", async ({ mount }) => {
    const component = await mount(
      <ThemedButton themeOverrides={purpleTheme} primary={false}>
        Secondary
      </ThemedButton>,
    );
    const button = component.locator("button");
    await expect(button).toHaveCSS("border-color", "rgb(129, 140, 248)");
  });

  test("KitchenTimer uses overridden fill color", async ({ mount }) => {
    const component = await mount(
      <ThemedKitchenTimer
        startTime={0}
        endTime={60}
        elapsedTime={30}
        themeOverrides={purpleTheme}
      />,
    );
    const fill = component.locator('[data-testid="timer-fill"]');
    await expect(fill).toHaveCSS("background-color", "rgb(168, 85, 247)");
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
        themeOverrides={purpleTheme}
      />,
    );
    const fill = component.locator('[data-testid="timer-fill"]');
    await expect(fill).toHaveCSS("background-color", "rgb(185, 28, 28)");
  });

  test("TextArea counter uses overridden success color", async ({ mount }) => {
    const component = await mount(
      <ThemedTextArea
        value={"A".repeat(75)}
        showCharacterCount
        minLength={50}
        maxLength={200}
        themeOverrides={purpleTheme}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    await expect(counter).toHaveCSS("color", "rgb(6, 95, 70)");
  });

  test("TextArea counter uses overridden warning color at max", async ({
    mount,
  }) => {
    const component = await mount(
      <ThemedTextArea
        value="12345"
        showCharacterCount
        maxLength={5}
        themeOverrides={purpleTheme}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    await expect(counter).toHaveCSS("color", "rgb(146, 64, 14)");
  });
});
