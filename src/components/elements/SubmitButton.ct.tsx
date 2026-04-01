import { test, expect } from "@playwright/experimental-ct-react";
import { SubmitButton } from "./SubmitButton";
import { MockSubmitButton } from "../testing/MockSubmitButton";

test.describe("SubmitButton", () => {
  test("renders with default button text", async ({ mount }) => {
    const component = await mount(
      <SubmitButton
        onSubmit={() => {}}
        name="test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Next");
  });

  test("renders with custom button text", async ({ mount }) => {
    const component = await mount(
      <SubmitButton
        onSubmit={() => {}}
        name="test"
        buttonText="Continue"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Continue");
  });

  test("click triggers save with correct key and time", async ({ mount }) => {
    const component = await mount(
      <MockSubmitButton name="readiness" elapsedTime={42.5} />,
    );

    // Not submitted yet
    await expect(
      component.locator('[data-testid="submit-submitted"]'),
    ).toHaveText("false");

    // Click the button
    await component.locator("button").click();

    // onSubmit was called
    await expect(
      component.locator('[data-testid="submit-submitted"]'),
    ).toHaveText("true");

    // save was called with correct key
    await expect(
      component.locator('[data-testid="submit-saved-key"]'),
    ).toHaveText("submitButton_readiness");

    // save value includes elapsed time
    const savedValue = await component
      .locator('[data-testid="submit-saved-value"]')
      .textContent();
    const parsed = JSON.parse(savedValue!);
    expect(parsed.time).toBe(42.5);
  });
});
