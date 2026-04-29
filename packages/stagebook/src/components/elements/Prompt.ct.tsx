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

test.describe("Multiple Choice layout", () => {
  test("default (no layout) renders RadioGroup options vertically", async ({
    mount,
  }) => {
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
    const optionsContainer = component.locator(
      '[data-testid="radioGroup"] > div',
    );
    await expect(optionsContainer).toHaveCSS("display", "grid");
  });

  test("layout: horizontal renders RadioGroup options horizontally", async ({
    mount,
  }) => {
    const horizontalMC = {
      ...multipleChoiceSingle,
      metadata: {
        ...multipleChoiceSingle.metadata,
        layout: "horizontal" as const,
      },
    };
    const component = await mount(
      <Prompt
        {...horizontalMC}
        name="testPrompt"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const optionsContainer = component.locator(
      '[data-testid="radioGroup"] > div',
    );
    await expect(optionsContainer).toHaveCSS("display", "flex");
  });

  test("layout: vertical renders RadioGroup options vertically", async ({
    mount,
  }) => {
    const verticalMC = {
      ...multipleChoiceSingle,
      metadata: {
        ...multipleChoiceSingle.metadata,
        layout: "vertical" as const,
      },
    };
    const component = await mount(
      <Prompt
        {...verticalMC}
        name="testPrompt"
        value={undefined}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const optionsContainer = component.locator(
      '[data-testid="radioGroup"] > div',
    );
    await expect(optionsContainer).toHaveCSS("display", "grid");
  });

  test("layout: horizontal on multi-select renders CheckboxGroup horizontally", async ({
    mount,
  }) => {
    const horizontalCheckbox = {
      ...multipleChoiceMultiple,
      metadata: {
        ...multipleChoiceMultiple.metadata,
        layout: "horizontal" as const,
      },
    };
    const component = await mount(
      <Prompt
        {...horizontalCheckbox}
        name="testColors"
        value={[]}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const optionsContainer = component.locator(
      '[data-testid="checkboxGroup"] > div',
    );
    await expect(optionsContainer).toHaveCSS("display", "flex");
  });

  test("default (no layout) on multi-select renders CheckboxGroup vertically", async ({
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
    const optionsContainer = component.locator(
      '[data-testid="checkboxGroup"] > div',
    );
    await expect(optionsContainer).toHaveCSS("display", "grid");
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
    await expect(component).toContainText("(5 / 50-200 chars)");
  });

  test("counter is gray when under minimum", async ({ mount }) => {
    const component = await mount(
      <Prompt
        {...openResponseWithLimits}
        name="testGray"
        value="Hi"
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    await expect(counter).toHaveCSS("color", "rgb(107, 114, 128)");
  });

  test("counter is green when in valid range", async ({ mount }) => {
    const longValue = "A".repeat(75);
    const component = await mount(
      <Prompt
        {...openResponseWithLimits}
        name="testGreen"
        value={longValue}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    await expect(counter).toHaveCSS("color", "rgb(22, 163, 74)");
  });

  test("counter is red at maximum", async ({ mount }) => {
    const maxValue = "A".repeat(200);
    const component = await mount(
      <Prompt
        {...openResponseWithLimits}
        name="testRed"
        value={maxValue}
        progressLabel="game_0_test"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const counter = component.locator('[data-testid="char-counter"]');
    await expect(counter).toHaveCSS("color", "rgb(220, 38, 38)");
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

// ================================================================
// Multiple Choice option order (shuffleOptions vs source order)
// ================================================================
//
// Pins the contract that:
//   - `shuffleOptions: true` produces a non-source-order rendering
//     while keeping the same option set
//   - the shuffled order is captured at first render and remains
//     stable across re-renders (the user's randomized labels don't
//     reshuffle on every parent state change)
//   - omitting `shuffleOptions` preserves yaml-declared order, even
//     when that order is intentionally non-alphabetical (e.g. mixed
//     numeric and string labels)
//
// Used by deliberation-empirica's cypress 01 omnibus (now retiring);
// this duplicates the assertions upstream so the upstream contract
// is locked in. (Issue #232.)

const SHUFFLE_OPTIONS = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
] as const;

const shuffledMultipleChoice = {
  metadata: {
    name: "projects/example/shuffled.md",
    type: "multipleChoice" as const,
    shuffleOptions: true,
  },
  body: "# Pick one",
  responseItems: [...SHUFFLE_OPTIONS],
};

const customOrderOptions = [
  "0",
  "0.5",
  "3",
  "4",
  "5.5",
  "six",
  "7",
  "8",
] as const;

const customOrderMultipleChoice = {
  metadata: {
    name: "projects/example/customOrder.md",
    type: "multipleChoice" as const,
  },
  body: "# Pick one",
  responseItems: [...customOrderOptions],
};

async function readRadioOrder(
  component: import("@playwright/test").Locator,
): Promise<string[]> {
  return component
    .locator('input[type="radio"]')
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLInputElement).value ?? ""),
    );
}

test.describe("Multiple Choice option order", () => {
  test("shuffleOptions: true produces a different order with the same set", async ({
    mount,
  }) => {
    const component = await mount(
      <Prompt
        {...shuffledMultipleChoice}
        name="testShuffle"
        value={undefined}
        progressLabel="game_0_shuffle"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const order = await readRadioOrder(component);
    // Same set membership.
    expect([...order].sort()).toEqual([...SHUFFLE_OPTIONS].sort());
    // Different from the source order. With 8 options, the chance of a
    // shuffle happening to land in source order is 1/40320 — vanishingly
    // small flake risk.
    expect(order).not.toEqual([...SHUFFLE_OPTIONS]);
  });

  test("shuffled order is stable across re-renders (no reshuffle on update)", async ({
    mount,
  }) => {
    const component = await mount(
      <Prompt
        {...shuffledMultipleChoice}
        name="testShuffleStable"
        value={undefined}
        progressLabel="game_0_shuffle_stable"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const firstOrder = await readRadioOrder(component);
    // Re-mount with the same props (different `value`) — the rendered
    // order must match what was captured on first render.
    await component.update(
      <Prompt
        {...shuffledMultipleChoice}
        name="testShuffleStable"
        value="alpha"
        progressLabel="game_0_shuffle_stable"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const secondOrder = await readRadioOrder(component);
    expect(secondOrder).toEqual(firstOrder);
  });

  test("without shuffleOptions, options render in declared yaml order", async ({
    mount,
  }) => {
    // Custom order: "0", "0.5", "3", "4", "5.5", "six", "7", "8" — not
    // alphabetical, not numeric. Pins the contract that the rendering
    // preserves source declaration order rather than re-sorting.
    const component = await mount(
      <Prompt
        {...customOrderMultipleChoice}
        name="testYamlOrder"
        value={undefined}
        progressLabel="game_0_yaml_order"
        save={() => {}}
        getElapsedTime={() => 0}
      />,
    );
    const order = await readRadioOrder(component);
    expect(order).toEqual([...customOrderOptions]);
  });
});
