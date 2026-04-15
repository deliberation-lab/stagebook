import { test, expect } from "@playwright/experimental-ct-react";
import { ImageElement } from "./ImageElement";

// 1x1 red pixel as a data URI — gives us a real image to render
const testImage =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

test("renders image with src", async ({ mount }) => {
  const component = await mount(<ImageElement src={testImage} />);
  await expect(component.locator("img")).toBeVisible();
});

test("renders with custom width via style", async ({ mount }) => {
  const component = await mount(<ImageElement src={testImage} width={50} />);
  const img = component.locator("img");
  await expect(img).toBeVisible();
  const style = await img.getAttribute("style");
  expect(style).toContain("50%");
});

test("defaults to 100% width via style", async ({ mount }) => {
  const component = await mount(<ImageElement src={testImage} />);
  const img = component.locator("img");
  await expect(img).toBeVisible();
  const style = await img.getAttribute("style");
  expect(style).toContain("100%");
});

test("renders nothing when src is empty", async ({ mount }) => {
  const component = await mount(<ImageElement src="" />);
  await expect(component.locator("img")).toHaveCount(0);
});
