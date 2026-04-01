import { test, expect } from "@playwright/experimental-ct-react";
import { TextArea } from "./TextArea";
import { MockTextArea } from "../testing/MockTextArea";

// -- Basic rendering --

test("renders with placeholder text", async ({ mount }) => {
  const component = await mount(<TextArea defaultText="Type here..." />);
  await expect(component.locator("textarea")).toHaveAttribute(
    "placeholder",
    "Type here...",
  );
});

test("displays current value", async ({ mount }) => {
  const component = await mount(<TextArea value="Hello world" />);
  await expect(component.locator("textarea")).toHaveValue("Hello world");
});

test("textarea renders full width", async ({ mount }) => {
  const component = await mount(<TextArea value="" rows={3} />);
  const textarea = component.locator("textarea");
  await expect(textarea).toHaveCSS("width", /[4-9]\d\d|[1-9]\d{3}/);
  await expect(textarea).toHaveAttribute("rows", "3");
});

// -- Character counter: min only --

test("min only: shows required count in gray when under", async ({ mount }) => {
  const component = await mount(
    <MockTextArea value="Hi" showCharacterCount minLength={50} />,
  );
  await expect(component).toContainText("(2 / 50+ characters required)");
  // Gray color when under minimum
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(107, 114, 128)");
});

test("min only: shows green when at minimum", async ({ mount }) => {
  const component = await mount(
    <MockTextArea
      value="This is exactly fifty characters long, believe me!!"
      showCharacterCount
      minLength={50}
    />,
  );
  await expect(component).toContainText("50+ characters required");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(22, 163, 74)");
});

// -- Character counter: max only --

test("max only: shows count in gray when under", async ({ mount }) => {
  const component = await mount(
    <MockTextArea value="Hello" showCharacterCount maxLength={200} />,
  );
  await expect(component).toContainText("(5 / 200 chars max)");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(107, 114, 128)");
});

test("max only: shows red at max", async ({ mount }) => {
  const component = await mount(
    <MockTextArea value="12345" showCharacterCount maxLength={5} />,
  );
  await expect(component).toContainText("(5 / 5 chars max)");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(220, 38, 38)");
});

// -- Character counter: min and max --

test("min+max: gray when under minimum", async ({ mount }) => {
  const component = await mount(
    <MockTextArea
      value="Hi"
      showCharacterCount
      minLength={10}
      maxLength={50}
    />,
  );
  await expect(component).toContainText("(2 / 10-50 chars)");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(107, 114, 128)");
});

test("min+max: green when in range", async ({ mount }) => {
  const component = await mount(
    <MockTextArea
      value="Hello World!!"
      showCharacterCount
      minLength={10}
      maxLength={50}
    />,
  );
  await expect(component).toContainText("(13 / 10-50 chars)");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(22, 163, 74)");
});

test("min+max: red at maximum", async ({ mount }) => {
  const component = await mount(
    <MockTextArea
      value="1234567890"
      showCharacterCount
      minLength={5}
      maxLength={10}
    />,
  );
  await expect(component).toContainText("(10 / 5-10 chars)");
  const counter = component.locator("div").last();
  await expect(counter).toHaveCSS("color", "rgb(220, 38, 38)");
});

// -- No min/max --

test("no limits: shows plain character count", async ({ mount }) => {
  const component = await mount(
    <MockTextArea value="Hello" showCharacterCount />,
  );
  await expect(component).toContainText("(5 characters)");
});

// -- Counter hidden when not requested --

test("no counter when showCharacterCount is false", async ({ mount }) => {
  const component = await mount(<MockTextArea value="Hello" minLength={10} />);
  await expect(component).not.toContainText("characters");
  await expect(component).not.toContainText("chars");
});
