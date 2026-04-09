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

test("shows default helper text when helperText prop is omitted", async ({
  mount,
}) => {
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
  await expect(component).toContainText(
    "Link opens in a new tab. Return to this tab to complete the study.",
  );
});

test("renders custom helperText when provided", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      helperText="You'll need about 5 minutes. Return here when done."
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component).toContainText(
    "You'll need about 5 minutes. Return here when done.",
  );
  // Default text should not appear when custom helperText is provided
  await expect(component).not.toContainText(
    "Return to this tab to complete the study",
  );
});

test("empty helperText hides the helper line entirely", async ({ mount }) => {
  const component = await mount(
    <TrackedLink
      name="signup"
      url="https://example.org/form"
      displayText="Open form"
      helperText=""
      save={() => {}}
      getElapsedTime={() => 0}
      progressLabel="game_0_test"
    />,
  );
  await expect(component).not.toContainText("opens in a new tab");
  await expect(component.locator("p")).toHaveCount(0);
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
