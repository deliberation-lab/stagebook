import { test, expect } from "@playwright/experimental-ct-react";
import { SubmitButton } from "./SubmitButton";

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
