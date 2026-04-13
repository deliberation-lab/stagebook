import { describe, it, expect } from "vitest";
import {
  computeViewportAfterZoom,
  computeViewportAfterScroll,
  computeViewportAfterSeek,
  clampViewportStart,
  isPlayheadPastThreshold,
  zoomIn,
  zoomOut,
  MIN_ZOOM,
} from "./viewport.js";

describe("clampViewportStart", () => {
  it("never goes below 0", () => {
    expect(clampViewportStart(-5, 60, 1)).toBe(0);
  });

  it("never lets the viewport extend past duration", () => {
    // At zoom 2, visible duration = 30. So max start = 60 - 30 = 30.
    expect(clampViewportStart(50, 60, 2)).toBe(30);
  });

  it("returns input if within bounds", () => {
    expect(clampViewportStart(10, 60, 2)).toBe(10);
  });

  it("clamps to 0 at zoom 1 (full duration visible)", () => {
    expect(clampViewportStart(20, 60, 1)).toBe(0);
  });
});

describe("computeViewportAfterZoom", () => {
  it("centers on playhead when zooming in", () => {
    // Zoom in from level 1 to level 2 with playhead at 30s, duration 60s
    // Visible duration goes from 60 to 30. Centered on 30 → start = 30 - 15 = 15
    const result = computeViewportAfterZoom({
      currentZoom: 1,
      newZoom: 2,
      duration: 60,
      currentViewportStart: 0,
      playheadTime: 30,
    });
    expect(result).toBe(15);
  });

  it("clamps when playhead is near the end", () => {
    // Playhead near end, zoom 2 → centering would put start past max
    const result = computeViewportAfterZoom({
      currentZoom: 1,
      newZoom: 2,
      duration: 60,
      currentViewportStart: 0,
      playheadTime: 55,
    });
    // Visible duration = 30. Centered on 55 = start 40. Max = 60 - 30 = 30. Clamp to 30.
    expect(result).toBe(30);
  });

  it("clamps when playhead is near the start", () => {
    const result = computeViewportAfterZoom({
      currentZoom: 1,
      newZoom: 2,
      duration: 60,
      currentViewportStart: 0,
      playheadTime: 5,
    });
    // Visible = 30, centered on 5 = start -10. Clamp to 0.
    expect(result).toBe(0);
  });

  it("uses viewport center when playhead is off-screen", () => {
    // Zoom 2, viewport [10, 40]. Playhead at 50 (off-screen).
    // Use viewport center (25) instead. Zooming to 4 → visible 15, centered on 25 = start 17.5
    const result = computeViewportAfterZoom({
      currentZoom: 2,
      newZoom: 4,
      duration: 60,
      currentViewportStart: 10,
      playheadTime: 50, // off-screen (viewport ends at 40)
    });
    expect(result).toBe(17.5);
  });

  it("returns 0 when zooming out to level 1", () => {
    expect(
      computeViewportAfterZoom({
        currentZoom: 4,
        newZoom: 1,
        duration: 60,
        currentViewportStart: 30,
        playheadTime: 35,
      }),
    ).toBe(0);
  });
});

describe("zoomIn / zoomOut", () => {
  it("zoomIn doubles", () => {
    expect(zoomIn(1)).toBe(2);
    expect(zoomIn(2)).toBe(4);
  });

  it("zoomOut halves", () => {
    expect(zoomOut(2)).toBe(1);
    expect(zoomOut(4)).toBe(2);
  });

  it("zoomOut never goes below MIN_ZOOM", () => {
    expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM);
  });

  it("zoomIn caps at a reasonable maximum (e.g., 32)", () => {
    expect(zoomIn(32)).toBe(32);
  });
});

describe("isPlayheadPastThreshold", () => {
  it("returns false when playhead is within first 90% of viewport", () => {
    // Viewport [10, 40], playhead at 25 (50% of viewport)
    expect(isPlayheadPastThreshold(25, 10, 30, 0.9)).toBe(false);
  });

  it("returns true when playhead is past 90% of viewport", () => {
    // Viewport [10, 40], playhead at 38 (93% of viewport)
    expect(isPlayheadPastThreshold(38, 10, 30, 0.9)).toBe(true);
  });

  it("returns true when playhead is at exactly 90%", () => {
    // 10 + 30*0.9 = 37
    expect(isPlayheadPastThreshold(37, 10, 30, 0.9)).toBe(true);
  });
});

describe("computeViewportAfterScroll", () => {
  it("keeps playhead pinned at threshold position", () => {
    // Playhead at 38, viewport [10, 40], threshold 0.9
    // We want playhead at 90% of viewport: viewportStart + visibleDuration*0.9 = playheadTime
    // → viewportStart = playheadTime - visibleDuration*0.9 = 38 - 27 = 11
    const result = computeViewportAfterScroll(38, 30, 60, 0.9);
    expect(result).toBe(11);
  });

  it("clamps to duration boundary", () => {
    // Near end, large viewport: would scroll past duration
    const result = computeViewportAfterScroll(58, 30, 60, 0.9);
    // playhead - 30*0.9 = 58 - 27 = 31. Max = 60 - 30 = 30. Clamp to 30.
    expect(result).toBe(30);
  });
});

describe("computeViewportAfterSeek", () => {
  it("snaps viewport so playhead is at ~25% from left", () => {
    // Playhead at 30, visible 20, duration 60, snap target 0.25
    // → start = 30 - 20*0.25 = 25 (within bounds: max = 60-20 = 40)
    const result = computeViewportAfterSeek(30, 20, 60, 0.25);
    expect(result).toBeCloseTo(25, 5);
  });

  it("clamps to 0", () => {
    // Playhead at 5, visible 30, snap 0.25 → start = -2.5. Clamp to 0.
    const result = computeViewportAfterSeek(5, 30, 60, 0.25);
    expect(result).toBe(0);
  });

  it("clamps to max", () => {
    // Playhead at 58, visible 30, snap 0.25 → start = 50.5. Max = 60 - 30 = 30. Clamp to 30.
    const result = computeViewportAfterSeek(58, 30, 60, 0.25);
    expect(result).toBe(30);
  });
});
