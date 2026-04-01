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

// -- Multiple choice (single select) --

test("renders multiple choice prompt with radio buttons", async ({ mount }) => {
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
  // Radio inputs for each option
  await expect(component.locator('input[type="radio"]')).toHaveCount(2);
  await expect(component).toContainText("Markdown");
  await expect(component).toContainText("HTML");
});

test("multiple choice shows selected value", async ({ mount }) => {
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

// -- Multiple choice (multiple select) --

test("renders multiple choice with checkboxes when select is multiple", async ({
  mount,
}) => {
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

// -- Open response --

test("renders open response with textarea", async ({ mount }) => {
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

test("open response shows character counter with limits", async ({ mount }) => {
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
  // Character count should be displayed
  await expect(component).toContainText("chars");
});

// -- No response --

test("renders no response prompt without input controls", async ({ mount }) => {
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
  // No input controls
  await expect(component.locator('input[type="radio"]')).toHaveCount(0);
  await expect(component.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(component.locator("textarea")).toHaveCount(0);
});

// -- Slider --

test("renders slider without thumb initially", async ({ mount }) => {
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
  // Labels should be visible
  await expect(component).toContainText("Very cold");
  await expect(component).toContainText("Super Hot");
  // No range input until clicked (anti-anchoring)
  await expect(component.locator('input[type="range"]')).toHaveCount(0);
});

test("renders slider with pre-set value showing thumb", async ({ mount }) => {
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

// -- List sorter --

test("renders list sorter with draggable items", async ({ mount }) => {
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
  // All items should be visible
  await expect(component).toContainText("Harry Potter");
  await expect(component).toContainText("Hermione Granger");
  await expect(component).toContainText("Albus Dumbledore");
});

// -- Shared prompt --
// Note: renderSharedNotepad is a function prop that doesn't survive
// Playwright CT serialization. We test that shared=true hides the textarea.
// The render slot integration is tested via vitest or e2e tests.

test("shared open response hides textarea", async ({ mount }) => {
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
  // No textarea for shared prompts (notepad slot would go here)
  await expect(component.locator("textarea")).toHaveCount(0);
});
