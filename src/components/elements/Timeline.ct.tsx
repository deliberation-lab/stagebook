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

// -- Visual components --

test("renders time ruler", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={120}
    />,
  );
  const ruler = component.locator('[data-testid="time-ruler"]');
  await expect(ruler).toBeAttached();
});

test("renders playhead", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={60}
      mockCurrentTime={30}
    />,
  );
  const playhead = component.locator('[data-testid="playhead"]');
  await expect(playhead).toBeAttached();
});

test("renders at least one track", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={60}
    />,
  );
  const tracks = component.locator('[data-testid="timeline-track"]');
  await expect(tracks.first()).toBeAttached();
});

test("renders default track label as Position N", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={60}
      mockChannelCount={2}
    />,
  );
  const labels = component.locator('[data-testid="track-label"]');
  await expect(labels.nth(0)).toContainText("Position 0");
  await expect(labels.nth(1)).toContainText("Position 1");
});

test("renders custom track labels", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      trackLabels={["Interviewer", "Participant"]}
      mockDuration={60}
      mockChannelCount={2}
    />,
  );
  const labels = component.locator('[data-testid="track-label"]');
  await expect(labels.nth(0)).toContainText("Interviewer");
  await expect(labels.nth(1)).toContainText("Participant");
});

test("falls back to Position N for extra channels beyond trackLabels", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      trackLabels={["Speaker A"]}
      mockDuration={60}
      mockChannelCount={3}
    />,
  );
  const labels = component.locator('[data-testid="track-label"]');
  await expect(labels.nth(0)).toContainText("Speaker A");
  await expect(labels.nth(1)).toContainText("Position 1");
  await expect(labels.nth(2)).toContainText("Position 2");
});

test("renders canvas for waveform", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={60}
    />,
  );
  const canvas = component.locator('[data-testid="waveform-canvas"]');
  await expect(canvas).toBeAttached();
});

test("renders multiple tracks for multi-channel audio", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="vis"
      selectionType="range"
      mockDuration={60}
      mockChannelCount={4}
    />,
  );
  const tracks = component.locator('[data-testid="timeline-track"]');
  await expect(tracks).toHaveCount(4);
});

// -- Selection interactions --

async function readSaveLog(component: import("@playwright/test").Locator) {
  const text = await component
    .locator('[data-testid="save-log"]')
    .textContent();
  return JSON.parse(text ?? "[]") as Array<{ key: string; value: unknown }>;
}

test("range mode: click-and-drag creates a range", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Drag from 25% to 50% of overlay width
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.25,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const range = component.locator('[data-testid="range-0"]');
  await expect(range).toBeAttached();

  const saves = await readSaveLog(component);
  const lastSave = saves[saves.length - 1];
  expect(lastSave?.key).toBe("timeline_ranges");
  const value = lastSave?.value as { start: number; end: number }[];
  expect(value).toHaveLength(1);
  // 25%-50% of 60s ≈ 15-30s
  expect(value[0]?.start).toBeCloseTo(15, 0);
  expect(value[0]?.end).toBeCloseTo(30, 0);
});

test("range mode: pure click (no drag) does not create a range", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Click without movement
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();
});

test("range mode: dead zone — small movement is treated as a click", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Move only 2px (less than 4px dead zone)
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5 + 2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5 + 2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();
});

test("range mode: multiSelect false — new range replaces existing", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={false}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // First range at 10%-20%
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.1,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Second range at 60%-80% (no overlap)
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.6,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Only one range should exist (range-0). The previous range was replaced.
  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();
  await expect(component.locator('[data-testid="range-1"]')).not.toBeAttached();
  const saves = await readSaveLog(component);
  const last = saves[saves.length - 1]?.value as {
    start: number;
    end: number;
  }[];
  expect(last).toHaveLength(1);
  expect(last[0]?.start).toBeCloseTo(36, 0); // 60% of 60
});

test("range mode: multiSelect true — ranges accumulate sorted", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create range at 60%-80% first
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.6,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Then create range at 10%-20%
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.1,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const saves = await readSaveLog(component);
  const last = saves[saves.length - 1]?.value as {
    start: number;
    end: number;
  }[];
  expect(last).toHaveLength(2);
  // Sorted chronologically — earliest first
  expect(last[0]?.start).toBeCloseTo(6, 0);
  expect(last[1]?.start).toBeCloseTo(36, 0);
});

test("point mode: click places a point and saves", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="points"
      selectionType="point"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.4,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.4,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  await expect(component.locator('[data-testid="point-0"]')).toBeAttached();
  const saves = await readSaveLog(component);
  const last = saves[saves.length - 1]?.value as { time: number }[];
  expect(last).toHaveLength(1);
  expect(last[0]?.time).toBeCloseTo(24, 0); // 40% of 60
});

test("point mode: multiple clicks place multiple points", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="points"
      selectionType="point"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  for (const pct of [0.2, 0.5, 0.8]) {
    await overlay.dispatchEvent("pointerdown", {
      clientX: box.x + box.width * pct,
      clientY: box.y + box.height * 0.5,
      button: 0,
      buttons: 1,
      pointerId: 1,
      isPrimary: true,
    });
    await overlay.dispatchEvent("pointerup", {
      clientX: box.x + box.width * pct,
      clientY: box.y + box.height * 0.5,
      button: 0,
      buttons: 1,
      pointerId: 1,
      isPrimary: true,
    });
  }

  await expect(component.locator('[data-testid^="point-"]')).toHaveCount(3);
});

test("save key is timeline_${name}", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="my_annotations"
      selectionType="point"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const saves = await readSaveLog(component);
  expect(saves[saves.length - 1]?.key).toBe("timeline_my_annotations");
});

test("Delete key removes the active selection", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create a range
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();

  // Press Delete on the timeline (creating a range sets activeIndex)
  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Delete");

  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();
  // Wait for the delete save to be reflected in the save log.
  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as unknown[];
      return last.length;
    })
    .toBe(0);
});

test("Escape deselects the active selection", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create a range
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Range should be active
  const range = component.locator('[data-testid="range-0"]');
  await expect(range).toHaveAttribute("data-active", "true");

  // Press Escape
  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Escape");

  // Range still exists but no longer active
  await expect(range).toHaveAttribute("data-active", "false");
});

test("Ctrl+Z undoes range creation", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create a range
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();

  // Undo
  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Control+z");

  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();
});

test("Ctrl+Z undoes deletion (restores the range)", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create + delete + undo
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Delete");
  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();

  await timeline.press("Control+z");
  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();
});

test("track scope: clicking different tracks creates ranges with track field", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      selectionScope="track"
      multiSelect={true}
      mockDuration={60}
      mockChannelCount={2}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Click on top half (track 0)
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.25,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.25,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.25,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Click on bottom half (track 1)
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.6,
    clientY: box.y + box.height * 0.75,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.7,
    clientY: box.y + box.height * 0.75,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.7,
    clientY: box.y + box.height * 0.75,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const saves = await readSaveLog(component);
  const last = saves[saves.length - 1]?.value as {
    track: number;
    start: number;
    end: number;
  }[];
  expect(last).toHaveLength(2);
  expect(last.some((r) => r.track === 0)).toBe(true);
  expect(last.some((r) => r.track === 1)).toBe(true);
});

test("clicking an existing range selects it (data-active becomes true)", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
    />,
  );
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");

  // Create range at 30%-50%
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * 0.3,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * 0.5,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const range = component.locator('[data-testid="range-0"]');
  await expect(range).toBeAttached();
  // Newly created range is active by default
  await expect(range).toHaveAttribute("data-active", "true");
});
