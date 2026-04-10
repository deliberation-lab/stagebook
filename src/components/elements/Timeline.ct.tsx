import { test, expect } from "@playwright/experimental-ct-react";
import { MockTimeline } from "../testing/MockTimeline.js";

// -- Rendering structure --

test("renders with data-testid when source player exists", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="coding_video"
      playerName="coding_video"
      name="interruptions"
      selectionType="range"
    />,
  );
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toBeAttached();
});

test("renders with correct ARIA region", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="coding_video"
      playerName="coding_video"
      name="interruptions"
      selectionType="range"
    />,
  );
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toHaveAttribute("role", "region");
  await expect(timeline).toHaveAttribute(
    "aria-label",
    "Timeline: interruptions",
  );
});

test("renders data attributes from config", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="coding_video"
      playerName="coding_video"
      name="interruptions"
      selectionType="range"
      selectionScope="track"
      multiSelect={true}
      showWaveform={false}
    />,
  );
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toHaveAttribute("data-source", "coding_video");
  await expect(timeline).toHaveAttribute("data-name", "interruptions");
  await expect(timeline).toHaveAttribute("data-selection-type", "range");
  await expect(timeline).toHaveAttribute("data-selection-scope", "track");
  await expect(timeline).toHaveAttribute("data-multi-select", "true");
  await expect(timeline).toHaveAttribute("data-show-waveform", "false");
});

// -- Error state --

test("renders error when source player not found", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="nonexistent_player"
      name="interruptions"
      selectionType="range"
    />,
  );
  // No timeline should render
  await expect(
    component.locator('[data-testid="timeline"]'),
  ).not.toBeAttached();
  // Error message should be visible
  const error = component.locator('[data-testid="timeline-error"]');
  await expect(error).toBeAttached();
  await expect(error).toContainText("nonexistent_player");
});

// -- PlaybackHandle connection --

test("connects to PlaybackHandle via PlaybackProvider", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="my_player"
      playerName="my_player"
      name="annotations"
      selectionType="point"
    />,
  );
  // Should render the timeline (not the error)
  await expect(component.locator('[data-testid="timeline"]')).toBeAttached();
  await expect(
    component.locator('[data-testid="timeline-error"]'),
  ).not.toBeAttached();
});

test("shows error when source name does not match player name", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="wrong_name"
      playerName="actual_player"
      name="annotations"
      selectionType="point"
    />,
  );
  await expect(
    component.locator('[data-testid="timeline"]'),
  ).not.toBeAttached();
  await expect(
    component.locator('[data-testid="timeline-error"]'),
  ).toBeAttached();
});

// -- Point mode --

test("renders in point mode", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="moments"
      selectionType="point"
    />,
  );
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toHaveAttribute("data-selection-type", "point");
});
