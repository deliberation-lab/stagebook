import { test, expect } from "@playwright/experimental-ct-react";
import { ImageElement } from "./ImageElement";

test("renders image with src", async ({ mount }) => {
  const component = await mount(
    <ImageElement src="https://example.com/photo.png" />,
  );
  await expect(component.locator("img")).toHaveAttribute(
    "src",
    "https://example.com/photo.png",
  );
});

test("renders with custom width", async ({ mount }) => {
  const component = await mount(
    <ImageElement src="https://example.com/photo.png" width={50} />,
  );
  await expect(component.locator("img")).toHaveAttribute("width", "50%");
});

test("defaults to 100% width", async ({ mount }) => {
  const component = await mount(
    <ImageElement src="https://example.com/photo.png" />,
  );
  await expect(component.locator("img")).toHaveAttribute("width", "100%");
});

test("renders nothing when src is empty", async ({ mount }) => {
  const component = await mount(<ImageElement src="" />);
  await expect(component.locator("img")).toHaveCount(0);
});
