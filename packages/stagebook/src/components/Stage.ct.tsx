import { test, expect } from "@playwright/experimental-ct-react";
import { MockStageRenderer } from "./testing/MockStageRenderer";
import type { StageConfig } from "./Stage";

// ----------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------

const simpleStage: StageConfig = {
  name: "SimplePrompts",
  duration: 30,
  elements: [
    { type: "prompt", file: "projects/example/multipleChoice.md" },
    { type: "separator" },
    { type: "submitButton", buttonText: "Continue" },
  ],
};

const timedElementsStage: StageConfig = {
  name: "TimedElements",
  duration: 600,
  elements: [
    { type: "separator", style: "thin", displayTime: 0, hideTime: 100 },
    {
      type: "timer",
      startTime: 0,
      endTime: 60,
      warnTimeRemaining: 10,
    },
    { type: "prompt", file: "projects/example/intro.md" },
    {
      type: "prompt",
      file: "projects/example/delayed.md",
      displayTime: 15,
    },
    { type: "submitButton", displayTime: 10 },
  ],
};

const positionVisibilityStage: StageConfig = {
  name: "PositionVisibility",
  duration: 600,
  elements: [
    {
      type: "prompt",
      file: "projects/example/everyone.md",
      name: "everyone",
    },
    {
      type: "prompt",
      file: "projects/example/position0only.md",
      name: "pos0only",
      showToPositions: [0],
    },
    {
      type: "prompt",
      file: "projects/example/position1only.md",
      name: "pos1only",
      hideFromPositions: [0],
    },
    { type: "submitButton", buttonText: "Continue" },
  ],
};

const discussionStage: StageConfig = {
  name: "Discussion",
  duration: 600,
  discussion: {
    chatType: "video",
    showNickname: true,
    showTitle: true,
  },
  elements: [
    { type: "prompt", file: "projects/example/discuss.md" },
    { type: "submitButton", buttonText: "End Discussion", displayTime: 30 },
  ],
};

const mixedElementsStage: StageConfig = {
  name: "MixedElements",
  duration: 120,
  elements: [
    { type: "separator", style: "thick" },
    {
      type: "timer",
      startTime: 0,
      endTime: 120,
      warnTimeRemaining: 30,
    },
    { type: "prompt", file: "projects/example/question.md", name: "q1" },
    { type: "separator", style: "thin" },
    {
      type: "image",
      file: "shared/diagram.png",
    },
    { type: "submitButton", buttonText: "Submit Answer" },
  ],
};

// ----------------------------------------------------------------
// Simple stage tests
// ----------------------------------------------------------------

test("simple stage renders all elements", async ({ mount }) => {
  const component = await mount(<MockStageRenderer stage={simpleStage} />);
  // Prompt loads as mock content
  await expect(component).toContainText("Mock content");
  // Separator is visible (an <hr> element)
  await expect(component.locator("hr")).toBeVisible();
  // Submit button
  await expect(component).toContainText("Continue");
});

test("simple stage elements are vertically stacked", async ({ mount }) => {
  const component = await mount(<MockStageRenderer stage={simpleStage} />);
  // All three elements should be in the DOM
  // The container should use flex column layout
  await expect(component.locator("button")).toContainText("Continue");
  await expect(component.locator("hr")).toBeVisible();
});

// ----------------------------------------------------------------
// Timed elements
// ----------------------------------------------------------------

test("timed stage shows elements at elapsed=0", async ({ mount }) => {
  const component = await mount(
    <MockStageRenderer stage={timedElementsStage} elapsedTime={0} />,
  );
  // Separator with displayTime=0 should be visible
  await expect(component.locator("hr")).toBeVisible();
  // Timer should be visible
  await expect(component).toContainText("01:00");
  // Prompt with no displayTime should be visible
  await expect(component).toContainText(
    "Mock content for projects/example/intro.md",
  );
  // Prompt with displayTime=15 should NOT be visible yet
  await expect(component).not.toContainText(
    "Mock content for projects/example/delayed.md",
  );
  // Submit button with displayTime=10 should NOT be visible yet
  await expect(component.locator("button")).toHaveCount(0);
});

// Time-advancing tests pin the show-after / hide-after branches that were
// only covered by deliberation-empirica's cypress 01 omnibus. (Issue #232.)

test("displayTime: element appears after elapsed >= displayTime", async ({
  mount,
}) => {
  const stage: StageConfig = {
    name: "DisplayTimeOnly",
    duration: 60,
    elements: [
      {
        type: "prompt",
        file: "projects/example/delayed.md",
        displayTime: 3,
      },
    ],
  };
  const component = await mount(
    <MockStageRenderer stage={stage} elapsedTime={0} />,
  );
  await expect(component).not.toContainText(
    "Mock content for projects/example/delayed.md",
  );
  // Advance to exactly displayTime — the boundary is `elapsed < displayTime`,
  // so at elapsed === displayTime the element MUST be visible.
  await component.update(<MockStageRenderer stage={stage} elapsedTime={3} />);
  await expect(component).toContainText(
    "Mock content for projects/example/delayed.md",
  );
  // And stays visible after.
  await component.update(<MockStageRenderer stage={stage} elapsedTime={10} />);
  await expect(component).toContainText(
    "Mock content for projects/example/delayed.md",
  );
});

test("hideTime: element disappears after elapsed > hideTime", async ({
  mount,
}) => {
  const stage: StageConfig = {
    name: "HideTimeOnly",
    duration: 60,
    elements: [
      {
        type: "prompt",
        file: "projects/example/early.md",
        hideTime: 3,
      },
    ],
  };
  const component = await mount(
    <MockStageRenderer stage={stage} elapsedTime={0} />,
  );
  await expect(component).toContainText(
    "Mock content for projects/example/early.md",
  );
  // hideTime check is `elapsed > hideTime`, so at elapsed === hideTime the
  // element is still rendered…
  await component.update(<MockStageRenderer stage={stage} elapsedTime={3} />);
  await expect(component).toContainText(
    "Mock content for projects/example/early.md",
  );
  // …and at elapsed > hideTime it disappears.
  await component.update(<MockStageRenderer stage={stage} elapsedTime={5} />);
  await expect(component).not.toContainText(
    "Mock content for projects/example/early.md",
  );
});

test("displayTime works for elements inside a discussion stage", async ({
  mount,
}) => {
  // Mirrors cypress 01 lines 750–753 (a `displayTime` prompt that appears
  // after the discussion-stage starts).
  const stage: StageConfig = {
    name: "DiscussionWithDelayed",
    duration: 600,
    discussion: {
      chatType: "video",
      showNickname: true,
      showTitle: true,
    },
    elements: [
      { type: "prompt", file: "projects/example/intro.md" },
      {
        type: "prompt",
        file: "projects/example/late.md",
        displayTime: 5,
      },
    ],
  };
  const component = await mount(
    <MockStageRenderer stage={stage} elapsedTime={0} />,
  );
  // intro.md is unconditional, late.md isn't visible yet.
  await expect(component).toContainText(
    "Mock content for projects/example/intro.md",
  );
  await expect(component).not.toContainText(
    "Mock content for projects/example/late.md",
  );
  await component.update(<MockStageRenderer stage={stage} elapsedTime={5} />);
  await expect(component).toContainText(
    "Mock content for projects/example/late.md",
  );
});

// ----------------------------------------------------------------
// Position-based visibility
// ----------------------------------------------------------------

test("position 0 sees position-0 elements, not position-1 elements", async ({
  mount,
}) => {
  const component = await mount(
    <MockStageRenderer stage={positionVisibilityStage} position={0} />,
  );
  // Everyone element
  await expect(component).toContainText(
    "Mock content for projects/example/everyone.md",
  );
  // Position 0 only element (showToPositions: [0])
  await expect(component).toContainText(
    "Mock content for projects/example/position0only.md",
  );
  // Position 1 only element (hideFromPositions: [0]) — should NOT be visible
  await expect(component).not.toContainText(
    "Mock content for projects/example/position1only.md",
  );
});

test("position 1 sees position-1 elements, not position-0 elements", async ({
  mount,
}) => {
  const component = await mount(
    <MockStageRenderer stage={positionVisibilityStage} position={1} />,
  );
  // Everyone element
  await expect(component).toContainText(
    "Mock content for projects/example/everyone.md",
  );
  // Position 0 only — NOT visible to position 1
  await expect(component).not.toContainText(
    "Mock content for projects/example/position0only.md",
  );
  // Position 1 only — visible
  await expect(component).toContainText(
    "Mock content for projects/example/position1only.md",
  );
});

// ----------------------------------------------------------------
// Discussion stage
// ----------------------------------------------------------------

test("discussion stage renders two-column layout", async ({ mount }) => {
  const component = await mount(
    <MockStageRenderer stage={discussionStage} position={0} />,
  );
  // Mock discussion should be visible
  await expect(
    component.locator('[data-testid="mock-discussion"]'),
  ).toBeVisible();
  await expect(component).toContainText("Mock video discussion");
  // Elements should also be visible
  await expect(component).toContainText(
    "Mock content for projects/example/discuss.md",
  );
});

test("discussion hidden from excluded positions", async ({ mount }) => {
  const stageWithHidden: StageConfig = {
    ...discussionStage,
    discussion: {
      chatType: "video",
      showNickname: true,
      showTitle: true,
      hideFromPositions: [1],
    },
  };
  const component = await mount(
    <MockStageRenderer stage={stageWithHidden} position={1} />,
  );
  // Discussion should NOT be visible for excluded position
  await expect(
    component.locator('[data-testid="mock-discussion"]'),
  ).toHaveCount(0);
  // Elements should still render
  await expect(component).toContainText(
    "Mock content for projects/example/discuss.md",
  );
});

// ----------------------------------------------------------------
// Mixed elements
// ----------------------------------------------------------------

test("mixed elements stage renders all element types", async ({ mount }) => {
  const component = await mount(
    <MockStageRenderer stage={mixedElementsStage} />,
  );
  // Separators (thick + thin)
  await expect(component.locator("hr").first()).toBeVisible();
  // Timer
  await expect(component).toContainText("02:00");
  // Prompt content
  await expect(component).toContainText("Mock content");
  // Image (mock CDN URL)
  await expect(component.locator("img")).toHaveAttribute(
    "src",
    "https://mock-cdn.test/shared/diagram.png",
  );
  // Submit button
  await expect(component).toContainText("Submit Answer");
});

// ----------------------------------------------------------------
// Submission state
// ----------------------------------------------------------------

test("shows waiting message when submitted in multiplayer", async ({
  mount,
}) => {
  const component = await mount(
    <MockStageRenderer
      stage={simpleStage}
      isSubmitted={true}
      playerCount={3}
    />,
  );
  await expect(component).toContainText("Please wait");
  // Elements should be hidden
  await expect(component.locator("button")).toHaveCount(0);
});

test("shows loading when submitted in single player", async ({ mount }) => {
  const component = await mount(
    <MockStageRenderer
      stage={simpleStage}
      isSubmitted={true}
      playerCount={1}
    />,
  );
  await expect(component.locator('[aria-label="Loading"]')).toBeVisible();
});
