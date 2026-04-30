import { test, expect } from "@playwright/experimental-ct-react";
import { MockStageRenderer } from "../testing/MockStageRenderer";

// A minimal stage with one element — submitButton is an advancement
// element and keeps the stage schema-valid in both passing and failing
// condition cases.
const elements = [{ type: "submitButton" as const }];

test.describe("StageConditionGate (#183)", () => {
  test("renders stage body when all conditions pass", async ({
    mount,
    page,
  }) => {
    await mount(
      <MockStageRenderer
        stage={{
          name: "r2",
          duration: 60,
          conditions: [
            {
              reference: "survey.continueVote.result.keepGoing",
              comparator: "equals",
              value: "yes",
              position: "shared",
            },
          ],
          elements,
        }}
        stateValues={{
          "survey.continueVote.result.keepGoing": "yes",
        }}
      />,
    );
    await expect(page.locator('[data-testid="stageContent"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="stage-condition-gate"]'),
    ).not.toBeVisible();
  });

  test("shows the advancing state when a stage-level condition fails", async ({
    mount,
    page,
  }) => {
    await mount(
      <MockStageRenderer
        stage={{
          name: "r2",
          duration: 60,
          conditions: [
            {
              reference: "survey.continueVote.result.keepGoing",
              comparator: "equals",
              value: "yes",
              position: "shared",
            },
          ],
          elements,
        }}
        stateValues={{
          "survey.continueVote.result.keepGoing": "no",
        }}
      />,
    );
    const gate = page.locator('[data-testid="stage-condition-gate"]');
    await expect(gate).toBeVisible();
    await expect(gate).toHaveAttribute("data-state", "advancing");
    // Stage body should not be rendered.
    await expect(
      page.locator('[data-testid="stageContent"]'),
    ).not.toBeVisible();
  });

  test("shows the advancing state when the referenced data is absent (skip-at-load)", async ({
    mount,
    page,
  }) => {
    // `equals "yes"` evaluates false against undefined data — classic
    // skip-at-load pattern when the prior-stage value was never set.
    await mount(
      <MockStageRenderer
        stage={{
          name: "r2",
          duration: 60,
          conditions: [
            {
              reference: "survey.continueVote.result.keepGoing",
              comparator: "equals",
              value: "yes",
              position: "shared",
            },
          ],
          elements,
        }}
        // no stateValues — references are undefined
      />,
    );
    await expect(
      page.locator('[data-testid="stage-condition-gate"]'),
    ).toBeVisible();
  });

  test("renders stage body when early-termination condition holds (data not yet present)", async ({
    mount,
    page,
  }) => {
    // Early-termination pattern: condition is true while the referenced
    // value is undefined; flips to false once data arrives.
    await mount(
      <MockStageRenderer
        stage={{
          name: "speed_round",
          duration: 60,
          conditions: [
            {
              reference: "submitButton.speedSubmit",
              comparator: "doesNotExist",
              position: "shared",
            },
          ],
          elements: [{ type: "submitButton" as const, name: "speedSubmit" }],
        }}
        // no stateValues — submitButton.speedSubmit is undefined →
        // doesNotExist is true → stage renders.
      />,
    );
    await expect(page.locator('[data-testid="stageContent"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="stage-condition-gate"]'),
    ).not.toBeVisible();
  });

  test("no gate overhead when stage has no conditions", async ({
    mount,
    page,
  }) => {
    await mount(
      <MockStageRenderer
        stage={{
          name: "plain",
          duration: 60,
          elements,
        }}
      />,
    );
    await expect(page.locator('[data-testid="stageContent"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="stage-condition-gate"]'),
    ).not.toBeAttached();
  });
});
