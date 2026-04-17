import { test, expect } from "@playwright/experimental-ct-react";
import {
  BoundaryTestHarness,
  CrashingChild,
  SiblingLayout,
} from "./testing/BoundaryTestHarness";

const FALLBACK_TEXT = "Part of this page couldn't load";

test("renders happy-path children with no visible wrapper", async ({
  mount,
}) => {
  const component = await mount(
    <BoundaryTestHarness elementType="prompt" elementName="ok">
      <p data-testid="happy-child">hello</p>
    </BoundaryTestHarness>,
  );
  await expect(component.locator('[data-testid="happy-child"]')).toBeVisible();
  await expect(component).toContainText("hello");
  await expect(component).not.toContainText(FALLBACK_TEXT);
});

test("renders a participant-friendly fallback when a child throws", async ({
  mount,
  page,
}) => {
  // Swallow the async-rethrown error so the test doesn't fail on page error
  page.on("pageerror", () => {});

  const component = await mount(
    <BoundaryTestHarness elementType="prompt" elementName="secretPromptName">
      <CrashingChild message="secret-internal-reason" />
    </BoundaryTestHarness>,
  );

  const fallback = component.locator('[data-testid="element-error-fallback"]');
  await expect(fallback).toBeVisible();
  await expect(component).toContainText(FALLBACK_TEXT);
});

test("fallback UI leaks no technical detail to the participant", async ({
  mount,
  page,
}) => {
  page.on("pageerror", () => {});

  const component = await mount(
    <BoundaryTestHarness elementType="prompt" elementName="secretPromptName">
      <CrashingChild message="secret-internal-reason" />
    </BoundaryTestHarness>,
  );

  await expect(
    component.locator('[data-testid="element-error-fallback"]'),
  ).toBeVisible();

  // None of these may appear in the DOM presented to the participant
  await expect(component).not.toContainText("secret-internal-reason");
  await expect(component).not.toContainText("secretPromptName");
  // The raw element type string shouldn't leak either — the fallback copy
  // intentionally does not reference the element's kind.
  await expect(component).not.toContainText("prompt:");
});

test("sibling elements still render when the middle one crashes", async ({
  mount,
  page,
}) => {
  page.on("pageerror", () => {});

  const component = await mount(
    <SiblingLayout
      leftText="LEFT-OK"
      rightText="RIGHT-OK"
      crashMessage="middle-boom"
      elementNames={["left", "middle", "right"]}
    />,
  );

  await expect(component.locator('[data-testid="sibling-left"]')).toBeVisible();
  await expect(
    component.locator('[data-testid="sibling-right"]'),
  ).toBeVisible();
  await expect(
    component.locator('[data-testid="element-error-fallback"]'),
  ).toHaveCount(1);
  await expect(component).toContainText("LEFT-OK");
  await expect(component).toContainText("RIGHT-OK");
  await expect(component).toContainText(FALLBACK_TEXT);
});

test("emits a single console.error with the full technical payload", async ({
  mount,
  page,
}) => {
  page.on("pageerror", () => {});

  const stagebookErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("[Stagebook]")) {
      stagebookErrors.push(msg.text());
    }
  });

  await mount(
    <BoundaryTestHarness elementType="prompt" elementName="promptForDebug">
      <CrashingChild message="debug-visible-to-researcher" />
    </BoundaryTestHarness>,
  );

  await expect.poll(() => stagebookErrors.length, { timeout: 2000 }).toBe(1);

  const logged = stagebookErrors[0];
  expect(logged).toContain("prompt");
  expect(logged).toContain("promptForDebug");
});

test("async re-throws original error to window.onerror", async ({
  mount,
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  await mount(
    <BoundaryTestHarness elementType="display" elementName="xyz">
      <CrashingChild message="rethrown-to-window-onerror" />
    </BoundaryTestHarness>,
  );

  await expect
    .poll(() => pageErrors.length, { timeout: 2000 })
    .toBeGreaterThanOrEqual(1);

  expect(pageErrors).toContain("rethrown-to-window-onerror");
});

test("calls onElementError with structured payload when provided", async ({
  mount,
  page,
}) => {
  page.on("pageerror", () => {});

  // Clear any leftover from previous tests just in case.
  await page.evaluate(() => {
    delete window.__stagebookElementErrors;
  });

  await mount(
    <BoundaryTestHarness
      elementType="timer"
      elementName="countdownA"
      withCallback
    >
      <CrashingChild message="callback-error" />
    </BoundaryTestHarness>,
  );

  await expect
    .poll(
      () => page.evaluate(() => window.__stagebookElementErrors?.length ?? 0),
      { timeout: 2000 },
    )
    .toBe(1);

  const recorded = await page.evaluate(
    () => window.__stagebookElementErrors?.[0],
  );
  expect(recorded).toMatchObject({
    elementType: "timer",
    elementName: "countdownA",
    errorMessage: "callback-error",
    errorName: "Error",
    hasErrorInfo: true,
  });
});

test("without onElementError, console.error and window.onerror still fire", async ({
  mount,
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  const stagebookErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && msg.text().includes("[Stagebook]")) {
      stagebookErrors.push(msg.text());
    }
  });

  await mount(
    <BoundaryTestHarness elementType="display" elementName="noCallback">
      <CrashingChild message="no-callback-provided" />
    </BoundaryTestHarness>,
  );

  await expect
    .poll(() => pageErrors.length, { timeout: 2000 })
    .toBeGreaterThanOrEqual(1);
  expect(pageErrors).toContain("no-callback-provided");
  expect(stagebookErrors.length).toBeGreaterThanOrEqual(1);
});
