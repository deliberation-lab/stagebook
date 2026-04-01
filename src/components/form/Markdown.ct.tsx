import { test, expect } from "@playwright/experimental-ct-react";
import { Markdown } from "./Markdown";

test("renders markdown text", async ({ mount }) => {
  const component = await mount(<Markdown text="**Bold text**" />);
  await expect(component.locator("strong")).toContainText("Bold text");
});

test("renders links", async ({ mount }) => {
  const component = await mount(
    <Markdown text="[Click here](https://example.com)" />,
  );
  await expect(component.locator("a")).toHaveAttribute(
    "href",
    "https://example.com",
  );
});

test("passes through relative image paths without resolveURL", async ({
  mount,
}) => {
  const component = await mount(<Markdown text="![photo](images/test.png)" />);
  // Verify the src attribute is set correctly (image won't load — that's expected)
  await expect(component.locator("img")).toHaveAttribute(
    "src",
    "images/test.png",
  );
});

test("renders headings", async ({ mount }) => {
  const component = await mount(<Markdown text="## Section Title" />);
  await expect(component.locator("h2")).toContainText("Section Title");
});

test("renders lists", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"- Item A\n- Item B\n- Item C"} />,
  );
  await expect(component.locator("li")).toHaveCount(3);
});

test("renders GFM tables", async ({ mount }) => {
  const component = await mount(
    <Markdown text={"| A | B |\n|---|---|\n| 1 | 2 |"} />,
  );
  await expect(component.locator("table")).toBeVisible();
});
