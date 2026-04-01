import { test, expect } from "@playwright/experimental-ct-react";
import { Prompt } from "./Prompt";
import {
  multipleChoiceSingle,
  multipleChoiceMultiple,
  openResponse,
  openResponseWithLimits,
  noResponse,
  slider,
  listSorter,
} from "./fixtures/prompts";

// ================================================================
// Multiple Choice
// ================================================================

test.describe("Multiple Choice (single select)", () => {
  test("renders radio buttons for each option", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...multipleChoiceSingle}
        name="testPrompt"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Markdown or HTML?");
    await expect(component).toContainText("Which format is better");
    await expect(component.locator('input[type="radio"]')).toHaveCount(2);
    await expect(component).toContainText("Markdown");
    await expect(component).toContainText("HTML");
  });

  test("shows selected value as checked", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...multipleChoiceSingle}
        name="testPrompt"
        value="Markdown"
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component.locator('input[value="Markdown"]')).toBeChecked();
    await expect(component.locator('input[value="HTML"]')).not.toBeChecked();
  });
});

test.describe("Multiple Choice (multiple select)", () => {
  test("renders checkboxes for each option", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...multipleChoiceMultiple}
        name="testColors"
        value={[]}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component.locator('input[type="checkbox"]')).toHaveCount(5);
    await expect(component).toContainText("Octarine");
    await expect(component).toContainText("Plaid");
  });
});

// ================================================================
// Open Response
// ================================================================

test.describe("Open Response", () => {
  test("renders textarea", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...openResponse}
        name="testOpen"
        value=""
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Are there any other reasons");
    await expect(component.locator("textarea")).toBeVisible();
  });

  test("shows character counter with min/max limits", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...openResponseWithLimits}
        name="testOpenLimits"
        value="Hello"
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component.locator("textarea")).toBeVisible();
    await expect(component).toContainText("chars");
  });

  test("shared mode hides textarea (notepad slot)", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...openResponse}
        name="testShared"
        shared={true}
        value=""
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Are there any other reasons");
    await expect(component.locator("textarea")).toHaveCount(0);
  });
});

// ================================================================
// No Response
// ================================================================

test.describe("No Response", () => {
  test("renders prompt text without input controls", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...noResponse}
        name="testNoResponse"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("Discuss why markdown is the best");
    await expect(component.locator('input[type="radio"]')).toHaveCount(0);
    await expect(component.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(component.locator("textarea")).toHaveCount(0);
  });
});

// ================================================================
// Slider
// ================================================================

test.describe("Slider", () => {
  test("renders without thumb initially (anti-anchoring)", async ({
    mount,
  }) => {
    const component = await mount(
      <Prompt
        {...slider}
        name="testSlider"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("How warm is your love for avocados");
    await expect(component).toContainText("Very cold");
    await expect(component).toContainText("Super Hot");
    await expect(component.locator('input[type="range"]')).toHaveCount(0);
  });

  test("shows thumb when value is pre-set", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...slider}
        name="testSlider"
        value={50}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component.locator('input[type="range"]')).toHaveCount(1);
    await expect(component.locator('input[type="range"]')).toHaveValue("50");
  });
});

// ================================================================
// List Sorter
// ================================================================

test.describe("List Sorter", () => {
  test("renders draggable items", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...listSorter}
        name="testListSorter"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    await expect(component).toContainText("alphabetical order");
    await expect(component).toContainText("Harry Potter");
    await expect(component).toContainText("Hermione Granger");
    await expect(component).toContainText("Albus Dumbledore");
  });
});
