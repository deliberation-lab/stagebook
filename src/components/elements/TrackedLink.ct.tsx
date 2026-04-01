import { test, expect } from "@playwright/experimental-ct-react";
import { TrackedLink } from "./TrackedLink";

test("renders link with display text", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Complete the signup form"
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component).toContainText("Complete the signup form");
  await expect(component.locator("a")).toHaveAttribute(
    "href",
    "https://example.org/form",
  );
});

test("link opens in new tab", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component.locator("a")).toHaveAttribute("target", "_blank");
  await expect(component.locator("a")).toHaveAttribute("rel", /noreferrer/);
});

test("shows helper text about new tab", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component).toContainText("opens in a new tab");
});

test("appends resolved params to URL", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      resolvedParams={[
        { key: "source", value: "deliberation_lab" },
        { key: "id", value: "abc123" },
      ]}
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component.locator("a")).toHaveAttribute(
    "href",
    "https://example.org/form?source=deliberation_lab&id=abc123",
  );
});

test("renders external link icon", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component.locator("svg")).toBeVisible();
});
