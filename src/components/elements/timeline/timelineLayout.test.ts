import { describe, it, expect } from "vitest";
import {
  timeToPixel,
  pixelToTime,
  computeTickInterval,
  generateTicks,
} from "./timelineLayout.js";

describe("timeToPixel", () => {
  it("maps time 0 to offset 0 at zoom 1", () => {
    expect(timeToPixel(0, 60, 600, 1, 0)).toBe(0);
  });

  it("maps end of duration to container width at zoom 1", () => {
    expect(timeToPixel(60, 60, 600, 1, 0)).toBe(600);
  });

  it("maps midpoint correctly", () => {
    expect(timeToPixel(30, 60, 600, 1, 0)).toBe(300);
  });

  it("applies zoom factor", () => {
    // zoom 2 means we see half the duration, so 30s maps to full width
    expect(timeToPixel(30, 60, 600, 2, 0)).toBe(600);
  });

  it("applies viewport offset", () => {
    // viewportStart=10, zoom 1: time 10 maps to pixel 0
    expect(timeToPixel(10, 60, 600, 1, 10)).toBe(0);
    expect(timeToPixel(70, 60, 600, 1, 10)).toBe(600);
  });

  it("returns negative for times before viewport", () => {
    expect(timeToPixel(0, 60, 600, 1, 10)).toBe(-100);
  });
});

describe("pixelToTime", () => {
  it("inverts timeToPixel at zoom 1", () => {
    expect(pixelToTime(300, 60, 600, 1, 0)).toBe(30);
  });

  it("inverts with zoom", () => {
    expect(pixelToTime(600, 60, 600, 2, 0)).toBe(30);
  });

  it("inverts with viewport offset", () => {
    expect(pixelToTime(0, 60, 600, 1, 10)).toBe(10);
  });
});

describe("computeTickInterval", () => {
  it("returns 60s for very zoomed-out view", () => {
    // 1 px/s → 60*1=60px spacing, just meets threshold
    expect(computeTickInterval(1)).toBe(60);
  });

  it("returns 30s for moderately zoomed-out view", () => {
    // 3 px/s → 30*3=90px, 60*3=180px (both meet threshold, pick smaller)
    expect(computeTickInterval(3)).toBe(30);
  });

  it("returns 10s for moderate zoom", () => {
    // 8 px/s → 10*8=80px meets threshold
    expect(computeTickInterval(8)).toBe(10);
  });

  it("returns 5s for closer zoom", () => {
    // 15 px/s → 5*15=75px meets threshold
    expect(computeTickInterval(15)).toBe(5);
  });

  it("returns 1s for zoomed-in view", () => {
    // 80 px/s → 1*80=80px meets threshold
    expect(computeTickInterval(80)).toBe(1);
  });

  it("returns sub-second for very zoomed-in view", () => {
    // 200 px/s → 0.5*200=100px meets threshold
    expect(computeTickInterval(200)).toBe(0.5);
  });

  it("always returns the finest interval that still has adequate spacing", () => {
    // Higher px/s → finer intervals
    const coarse = computeTickInterval(1);
    const fine = computeTickInterval(200);
    expect(fine).toBeLessThan(coarse);
  });
});

describe("generateTicks", () => {
  it("generates ticks within the visible range", () => {
    const ticks = generateTicks(0, 10, 5);
    expect(ticks).toEqual([0, 5, 10]);
  });

  it("aligns to interval boundaries", () => {
    const ticks = generateTicks(3, 17, 5);
    expect(ticks).toEqual([5, 10, 15]);
  });

  it("returns empty for zero-length range", () => {
    expect(generateTicks(5, 5, 1)).toEqual([5]);
  });

  it("includes start if aligned", () => {
    const ticks = generateTicks(0, 5, 1);
    expect(ticks[0]).toBe(0);
    expect(ticks).toHaveLength(6);
  });
});
