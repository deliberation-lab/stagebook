import { test, expect } from "@playwright/experimental-ct-react";
import { MockSurveyStage } from "../testing/MockSurveyStage";

test.describe("Survey render slot", () => {
  test("renders the mock survey component", async ({ mount }) => {
    const component = await mount(<MockSurveyStage />);
    await expect(
      component.locator('[data-testid="mock-survey"]'),
    ).toBeVisible();
    await expect(component).toContainText("Mock Survey: TIPI");
  });

  test("shows complete button", async ({ mount }) => {
    const component = await mount(<MockSurveyStage />);
    await expect(
      component.locator('[data-testid="complete-survey-btn"]'),
    ).toBeVisible();
  });

  test("clicking complete saves results under survey_${name}", async ({
    mount,
  }) => {
    const component = await mount(<MockSurveyStage />);

    // Verify no saves yet
    const savedBefore = await component
      .locator('[data-testid="saved-entries"]')
      .textContent();
    expect(JSON.parse(savedBefore!)).toEqual([]);

    // Click the complete button
    await component.locator('[data-testid="complete-survey-btn"]').click();

    // Verify save was called with correct key and results
    const savedAfter = await component
      .locator('[data-testid="saved-entries"]')
      .textContent();
    const entries = JSON.parse(savedAfter!);

    // Find the survey save entry (there may also be a submitButton save)
    const surveyEntry = entries.find(
      (e: { key: string }) => e.key === "survey_preTIPI",
    );
    expect(surveyEntry).toBeDefined();
    expect(surveyEntry.value.result.normAgreeableness).toBe(0.82);
    expect(surveyEntry.value.result.normExtraversion).toBe(0.65);
    expect(surveyEntry.value.responses.q1).toBe("agree");
  });

  test("survey name from element config is used as storage key", async ({
    mount,
  }) => {
    const component = await mount(<MockSurveyStage />);
    await component.locator('[data-testid="complete-survey-btn"]').click();

    const saved = await component
      .locator('[data-testid="saved-entries"]')
      .textContent();
    const entries = JSON.parse(saved!);
    // Key should be survey_preTIPI (from element.name), not survey_TIPI
    const keys = entries.map((e: { key: string }) => e.key);
    expect(keys).toContain("survey_preTIPI");
  });
});
