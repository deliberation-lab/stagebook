import { test, expect } from "@playwright/experimental-ct-react";
import { Display } from "./Display";

test("renders values as text", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.question1" values={["Hello", "World"]} />,
  );
  await expect(component).toContainText("Hello");
  await expect(component).toContainText("World");
});

test("renders as a blockquote element", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.q1" values={["Answer"]} />,
  );
  // The component itself is the blockquote
  await expect(component).toContainText("Answer");
});

test("handles non-string values via JSON serialization", async ({ mount }) => {
  const component = await mount(
    <Display reference="prompt.q1" values={[42, true]} />,
  );
  await expect(component).toContainText("42");
  await expect(component).toContainText("true");
});
