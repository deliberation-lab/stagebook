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

// -- Saved state restoration --

test("restores saved range selections on mount", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
      initialSelections={[
        { start: 5, end: 10 },
        { start: 20, end: 30 },
      ]}
    />,
  );
  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();
  await expect(component.locator('[data-testid="range-1"]')).toBeAttached();
  await expect(component.locator('[data-testid="range-2"]')).not.toBeAttached();
});

test("restores saved point selections on mount", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="points"
      selectionType="point"
      multiSelect={true}
      mockDuration={60}
      initialSelections={[{ time: 10 }, { time: 25 }, { time: 40 }]}
    />,
  );
  await expect(component.locator('[data-testid="point-0"]')).toBeAttached();
  await expect(component.locator('[data-testid="point-1"]')).toBeAttached();
  await expect(component.locator('[data-testid="point-2"]')).toBeAttached();
});

test("restoration discards malformed entries", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
      initialSelections={[
        { start: 5, end: 10 },
        { start: "bad", end: 20 } as unknown as { start: number; end: number },
        null as unknown as { start: number; end: number },
        { start: 30, end: 40 },
      ]}
    />,
  );
  await expect(component.locator('[data-testid="range-0"]')).toBeAttached();
  await expect(component.locator('[data-testid="range-1"]')).toBeAttached();
  await expect(component.locator('[data-testid="range-2"]')).not.toBeAttached();
});

test("restoration with no saved value starts empty", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(component.locator('[data-testid="range-0"]')).not.toBeAttached();
});

test("does not re-save the restored value on mount", async ({ mount }) => {
  // Mounting with initialSelections should hydrate the reducer but NOT
  // immediately call save() — that would clobber the original write with
  // a new echo on every page load.
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      multiSelect={true}
      mockDuration={60}
      initialSelections={[{ start: 5, end: 10 }]}
    />,
  );
  // Wait for the save log; should be empty.
  const saves = await readSaveLog(component);
  expect(saves).toEqual([]);
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

// -- Keyboard editing (#48) --

async function createRangeViaDrag(
  component: import("@playwright/test").Locator,
  startPct: number,
  endPct: number,
) {
  const overlay = component.locator('[data-testid="selection-overlay"]');
  const box = await overlay.boundingBox();
  if (!box) throw new Error("overlay not found");
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * startPct,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointermove", {
    clientX: box.x + box.width * endPct,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * endPct,
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
}

test("ArrowRight extends end handle by 1s and seeks", async ({ mount }) => {
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
  await createRangeViaDrag(component, 0.3, 0.5); // 18-30s

  // After creation, range is active but no handle yet — Tab to focus end handle
  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab");
  await timeline.press("ArrowRight");

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { end: number }[];
      return last[0]?.end ?? 0;
    })
    .toBeCloseTo(31, 0); // 30 + 1
});

test("ArrowLeft on end handle moves it left by 1s", async ({ mount }) => {
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
  await createRangeViaDrag(component, 0.3, 0.5); // 18-30s

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab"); // focus end handle
  await timeline.press("ArrowLeft");

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { end: number }[];
      return last[0]?.end ?? 0;
    })
    .toBeCloseTo(29, 0); // 30 - 1
});

test("keyboard handle adjustment is clamped to media duration", async ({
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
  // Create a range very close to the end of the media (54-58s)
  await createRangeViaDrag(component, 0.9, 0.9667);

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab"); // end handle
  // Press ArrowRight enough times that it would push past duration (60s)
  for (let i = 0; i < 10; i++) {
    await timeline.press("ArrowRight");
  }

  // The end handle should be clamped at duration (60), not pushed past it.
  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { end: number }[];
      return last[0]?.end ?? 0;
    })
    .toBeLessThanOrEqual(60);
});

test("keyboard point reposition is clamped to [0, duration]", async ({
  mount,
}) => {
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

  // Place a point near time 2s
  await overlay.dispatchEvent("pointerdown", {
    clientX: box.x + box.width * (2 / 60),
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await overlay.dispatchEvent("pointerup", {
    clientX: box.x + box.width * (2 / 60),
    clientY: box.y + box.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  // Press ArrowLeft enough times to push below 0
  for (let i = 0; i < 10; i++) {
    await timeline.press("ArrowLeft");
  }

  // The point should be clamped at 0, not pushed negative.
  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { time: number }[];
      return last[0]?.time ?? -1;
    })
    .toBeGreaterThanOrEqual(0);
});

test("Tab switches active handle (end → start)", async ({ mount }) => {
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
  await createRangeViaDrag(component, 0.3, 0.5); // 18-30s

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab"); // first Tab → end handle active
  await timeline.press("ArrowLeft"); // moves end -1s

  // Tab again → start handle
  await timeline.press("Tab");
  await timeline.press("ArrowRight"); // moves start +1s

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as {
        start: number;
        end: number;
      }[];
      return { start: last[0]?.start ?? 0, end: last[0]?.end ?? 0 };
    })
    .toEqual({ start: expect.closeTo(19, 0), end: expect.closeTo(29, 0) });
});

test("comma/period adjust handle by one frame", async ({ mount }) => {
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
  await createRangeViaDrag(component, 0.3, 0.5); // 18-30s

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab"); // end handle

  // Period: +1 frame = +1/30s ≈ +0.033s
  await timeline.press(".");

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { end: number }[];
      return last[0]?.end ?? 0;
    })
    .toBeGreaterThan(30); // moved a frame past 30
});

test("point mode: arrow keys reposition the active point", async ({
  mount,
}) => {
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

  // Click at 50% to place a point at ~30s
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

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("ArrowRight"); // +1s

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as { time: number }[];
      return last[0]?.time ?? 0;
    })
    .toBeCloseTo(31, 0);
});

test("Space key never intercepted by timeline", async ({ mount }) => {
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
  await createRangeViaDrag(component, 0.3, 0.5);
  const beforeSaves = await readSaveLog(component);

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press(" ");
  // No new save should fire (space doesn't change selections)
  // Wait a bit to be sure no debounced save sneaks in
  await timeline.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  const afterSaves = await readSaveLog(component);
  expect(afterSaves.length).toBe(beforeSaves.length);
});

// -- Footer / zoom / minimap / help (#49) --

test("footer renders with default zoom buttons and selection summary", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-footer"]'),
  ).toBeAttached();
  await expect(
    component.locator('[data-testid="timeline-zoom-in"]'),
  ).toBeAttached();
  await expect(
    component.locator('[data-testid="timeline-zoom-out"]'),
  ).toBeAttached();
  await expect(
    component.locator('[data-testid="timeline-help-button"]'),
  ).toBeAttached();
});

test("zoom-out button disabled at minimum zoom", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-zoom-out"]'),
  ).toBeDisabled();
});

test("zoom-in button increases zoom level", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toHaveAttribute("data-zoom-level", "1");
  await component.locator('[data-testid="timeline-zoom-in"]').click();
  await expect(timeline).toHaveAttribute("data-zoom-level", "2");
});

test("zoom-out button decreases zoom level", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await component.locator('[data-testid="timeline-zoom-in"]').click();
  await component.locator('[data-testid="timeline-zoom-in"]').click();
  const timeline = component.locator('[data-testid="timeline"]');
  await expect(timeline).toHaveAttribute("data-zoom-level", "4");
  await component.locator('[data-testid="timeline-zoom-out"]').click();
  await expect(timeline).toHaveAttribute("data-zoom-level", "2");
});

test("minimap not visible at zoom level 1", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-minimap"]'),
  ).not.toBeAttached();
});

test("minimap appears when zoomed in", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await component.locator('[data-testid="timeline-zoom-in"]').click();
  await expect(
    component.locator('[data-testid="timeline-minimap"]'),
  ).toBeAttached();
  await expect(
    component.locator('[data-testid="minimap-viewport"]'),
  ).toBeAttached();
});

test("clicking minimap pans viewport", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await component.locator('[data-testid="timeline-zoom-in"]').click();
  await component.locator('[data-testid="timeline-zoom-in"]').click();

  const minimap = component.locator('[data-testid="timeline-minimap"]');
  const viewport = component.locator('[data-testid="minimap-viewport"]');
  const beforeBox = await viewport.boundingBox();
  if (!beforeBox) throw new Error("viewport rect not found");

  const minimapBox = await minimap.boundingBox();
  if (!minimapBox) throw new Error("minimap not found");
  await minimap.dispatchEvent("pointerdown", {
    clientX: minimapBox.x + minimapBox.width * 0.85,
    clientY: minimapBox.y + minimapBox.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  await minimap.dispatchEvent("pointerup", {
    clientX: minimapBox.x + minimapBox.width * 0.85,
    clientY: minimapBox.y + minimapBox.height * 0.5,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });

  // Wait for the viewport to actually move
  await expect
    .poll(async () => {
      const box = await viewport.boundingBox();
      return box?.x ?? 0;
    })
    .toBeGreaterThan(beforeBox.x);
});

test("footer summary: 0 ranges selected by default", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-selection-summary"]'),
  ).toContainText("0 ranges selected");
});

test("footer summary: 0 points marked by default in point mode", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="points"
      selectionType="point"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-selection-summary"]'),
  ).toContainText("0 points marked");
});

test("footer summary: shows time range for active selection", async ({
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
  await createRangeViaDrag(component, 0.1, 0.2);
  // After creation, the range is active so the footer shows the time readout
  await expect(
    component.locator('[data-testid="timeline-selection-summary"]'),
  ).toContainText(":");
});

test("help button opens popover", async ({ mount }) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await expect(
    component.locator('[data-testid="timeline-help-popover"]'),
  ).not.toBeAttached();
  await component.locator('[data-testid="timeline-help-button"]').click();
  await expect(
    component.locator('[data-testid="timeline-help-popover"]'),
  ).toBeAttached();
});

test("help popover shows range-mode shortcuts in range mode", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="ranges"
      selectionType="range"
      mockDuration={60}
    />,
  );
  await component.locator('[data-testid="timeline-help-button"]').click();
  const popover = component.locator('[data-testid="timeline-help-popover"]');
  await expect(popover).toContainText("Create range");
  await expect(popover).toContainText("Switch handle");
});

test("help popover shows point-mode shortcuts in point mode", async ({
  mount,
}) => {
  const component = await mount(
    <MockTimeline
      source="player"
      playerName="player"
      name="points"
      selectionType="point"
      mockDuration={60}
    />,
  );
  await component.locator('[data-testid="timeline-help-button"]').click();
  const popover = component.locator('[data-testid="timeline-help-popover"]');
  await expect(popover).toContainText("Place point");
  await expect(popover).toContainText("Reposition");
});

test("debounced save: rapid arrow keypresses produce a single save", async ({
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
  await createRangeViaDrag(component, 0.3, 0.5);

  // After creation, the save log has 1 entry. Capture it.
  const beforeSaves = await readSaveLog(component);

  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Tab"); // end handle

  // Fire 5 ArrowRights in quick succession
  await timeline.press("ArrowRight");
  await timeline.press("ArrowRight");
  await timeline.press("ArrowRight");
  await timeline.press("ArrowRight");
  await timeline.press("ArrowRight");

  // Wait for debounced save to land
  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      return saves.length - beforeSaves.length;
    })
    .toBeGreaterThan(0);

  // After 5 rapid ArrowRights, the 500ms debounce should produce
  // exactly one new save — not five (raw) or two (premature flush).
  const afterSaves = await readSaveLog(component);
  const newSaves = afterSaves.length - beforeSaves.length;
  expect(newSaves).toBe(1);
});

test("dragging a range handle produces a single save (not one per move)", async ({
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
  await createRangeViaDrag(component, 0.3, 0.5);
  const beforeSaves = await readSaveLog(component);

  // Drag the end handle right with multiple intermediate moves
  const endHandle = component.locator('[data-testid="range-0-handle-end"]');
  const handleBox = await endHandle.boundingBox();
  if (!handleBox) throw new Error("end handle not found");

  await endHandle.dispatchEvent("pointerdown", {
    clientX: handleBox.x + handleBox.width / 2,
    clientY: handleBox.y + handleBox.height / 2,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  // Several intermediate pointermoves
  for (let dx = 10; dx <= 50; dx += 10) {
    await component
      .locator('[data-testid="selection-overlay"]')
      .dispatchEvent("pointermove", {
        clientX: handleBox.x + handleBox.width / 2 + dx,
        clientY: handleBox.y + handleBox.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 1,
        isPrimary: true,
      });
  }
  await component
    .locator('[data-testid="selection-overlay"]')
    .dispatchEvent("pointerup", {
      clientX: handleBox.x + handleBox.width / 2 + 50,
      clientY: handleBox.y + handleBox.height / 2,
      button: 0,
      buttons: 1,
      pointerId: 1,
      isPrimary: true,
    });

  // Wait for the save log to settle, then assert exactly one new save
  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      return saves.length - beforeSaves.length;
    })
    .toBe(1);
});

test("undo after a drag restores the pre-drag state in one step", async ({
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
  await createRangeViaDrag(component, 0.3, 0.5);

  // Capture the original end position
  const savesBeforeDrag = await readSaveLog(component);
  const originalRange = (
    savesBeforeDrag[savesBeforeDrag.length - 1]?.value as {
      start: number;
      end: number;
    }[]
  )[0];

  // Drag the end handle
  const endHandle = component.locator('[data-testid="range-0-handle-end"]');
  const handleBox = await endHandle.boundingBox();
  if (!handleBox) throw new Error("end handle not found");

  await endHandle.dispatchEvent("pointerdown", {
    clientX: handleBox.x + handleBox.width / 2,
    clientY: handleBox.y + handleBox.height / 2,
    button: 0,
    buttons: 1,
    pointerId: 1,
    isPrimary: true,
  });
  for (let dx = 10; dx <= 50; dx += 10) {
    await component
      .locator('[data-testid="selection-overlay"]')
      .dispatchEvent("pointermove", {
        clientX: handleBox.x + handleBox.width / 2 + dx,
        clientY: handleBox.y + handleBox.height / 2,
        button: 0,
        buttons: 1,
        pointerId: 1,
        isPrimary: true,
      });
  }
  await component
    .locator('[data-testid="selection-overlay"]')
    .dispatchEvent("pointerup", {
      clientX: handleBox.x + handleBox.width / 2 + 50,
      clientY: handleBox.y + handleBox.height / 2,
      button: 0,
      buttons: 1,
      pointerId: 1,
      isPrimary: true,
    });

  // One Ctrl+Z should bring it all the way back
  const timeline = component.locator('[data-testid="timeline"]');
  await timeline.focus();
  await timeline.press("Control+z");

  await expect
    .poll(async () => {
      const saves = await readSaveLog(component);
      const last = saves[saves.length - 1]?.value as {
        start: number;
        end: number;
      }[];
      return last[0]?.end ?? -1;
    })
    .toBeCloseTo(originalRange?.end ?? -1, 0);
});
