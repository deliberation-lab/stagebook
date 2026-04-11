import { describe, expect, test } from "vitest";
import {
  createRange,
  adjustHandle,
  createPoint,
  repositionPoint,
  deleteSelection,
  sortRanges,
  sortPoints,
  clampToFreeGap,
  enforceMultiSelect,
  pushUndo,
  popUndo,
  type RangeSelection,
  type PointSelection,
  type SelectionSnapshot,
} from "./selections.js";

// ----------- Range creation -----------

describe("createRange", () => {
  test("creates range with correct start/end", () => {
    const result = createRange(10, 20, undefined, []);
    expect(result).toEqual({ start: 10, end: 20 });
  });

  test("creates range with track when specified", () => {
    const result = createRange(10, 20, 0, []);
    expect(result).toEqual({ track: 0, start: 10, end: 20 });
  });

  test("swaps start/end if start > end", () => {
    const result = createRange(20, 10, undefined, []);
    expect(result).toEqual({ start: 10, end: 20 });
  });

  test("clamps range to free gap when neighbors exist", () => {
    const existing: RangeSelection[] = [
      { start: 5, end: 15 },
      { start: 25, end: 35 },
    ];
    const result = createRange(10, 30, undefined, existing);
    expect(result).toEqual({ start: 15, end: 25 });
  });

  test("adjacent ranges allowed (shared boundary)", () => {
    const existing: RangeSelection[] = [{ start: 0, end: 10 }];
    const result = createRange(10, 20, undefined, existing);
    expect(result).toEqual({ start: 10, end: 20 });
  });

  test("track-scoped: ranges on different tracks don't interfere", () => {
    const existing: RangeSelection[] = [{ track: 0, start: 5, end: 15 }];
    // Creating on track 1 — should not be clamped by track 0's range
    const result = createRange(5, 15, 1, existing);
    expect(result).toEqual({ track: 1, start: 5, end: 15 });
  });

  test("all-scoped: ranges share the same constraint space", () => {
    const existing: RangeSelection[] = [{ start: 5, end: 15 }];
    const result = createRange(10, 25, undefined, existing);
    expect(result).toEqual({ start: 15, end: 25 });
  });

  test("returns null when no free space in gap", () => {
    const existing: RangeSelection[] = [
      { start: 0, end: 15 },
      { start: 15, end: 30 },
    ];
    // Trying to create at a fully occupied position
    const result = createRange(10, 20, undefined, existing);
    expect(result).toBeNull();
  });
});

// ----------- clampToFreeGap -----------

describe("clampToFreeGap", () => {
  test("returns original range when no neighbors", () => {
    const result = clampToFreeGap(10, 20, undefined, []);
    expect(result).toEqual({ start: 10, end: 20 });
  });

  test("clamps to free gap between two ranges", () => {
    const existing: RangeSelection[] = [
      { start: 0, end: 8 },
      { start: 22, end: 30 },
    ];
    const result = clampToFreeGap(5, 25, undefined, existing);
    expect(result).toEqual({ start: 8, end: 22 });
  });

  test("returns null when gap is zero width", () => {
    const existing: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 10, end: 20 },
    ];
    const result = clampToFreeGap(5, 15, undefined, existing);
    expect(result).toBeNull();
  });

  test("respects track scope — only considers same track", () => {
    const existing: RangeSelection[] = [
      { track: 0, start: 0, end: 30 },
      { track: 1, start: 5, end: 10 },
    ];
    // On track 1, the gap is 0-5 and 10-end
    const result = clampToFreeGap(0, 8, 1, existing);
    expect(result).toEqual({ start: 0, end: 5 });
  });
});

// ----------- adjustHandle -----------

describe("adjustHandle", () => {
  test("adjusts start handle within free space", () => {
    const selections: RangeSelection[] = [{ start: 10, end: 20 }];
    const result = adjustHandle(selections, 0, "start", 5);
    expect(result[0]).toEqual({ start: 5, end: 20 });
  });

  test("adjusts end handle within free space", () => {
    const selections: RangeSelection[] = [{ start: 10, end: 20 }];
    const result = adjustHandle(selections, 0, "end", 25);
    expect(result[0]).toEqual({ start: 10, end: 25 });
  });

  test("clamps start handle at neighbor boundary", () => {
    const selections: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 15, end: 25 },
    ];
    const result = adjustHandle(selections, 1, "start", 5);
    expect(result[1]).toEqual({ start: 10, end: 25 });
  });

  test("clamps end handle at neighbor boundary", () => {
    const selections: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 15, end: 25 },
    ];
    const result = adjustHandle(selections, 0, "end", 20);
    expect(result[0]).toEqual({ start: 0, end: 15 });
  });

  test("start handle cannot cross end handle", () => {
    const selections: RangeSelection[] = [{ start: 10, end: 20 }];
    const result = adjustHandle(selections, 0, "start", 25);
    expect(result[0].start).toBeLessThanOrEqual(result[0].end);
  });

  test("end handle cannot cross start handle", () => {
    const selections: RangeSelection[] = [{ start: 10, end: 20 }];
    const result = adjustHandle(selections, 0, "end", 5);
    expect(result[0].end).toBeGreaterThanOrEqual(result[0].start);
  });
});

// ----------- Point creation/repositioning -----------

describe("createPoint", () => {
  test("creates point at specified time", () => {
    const result = createPoint(15.5, undefined);
    expect(result).toEqual({ time: 15.5 });
  });

  test("creates point with track when specified", () => {
    const result = createPoint(15.5, 1);
    expect(result).toEqual({ track: 1, time: 15.5 });
  });
});

describe("repositionPoint", () => {
  test("repositions point correctly", () => {
    const selections: PointSelection[] = [{ time: 10 }, { time: 20 }];
    const result = repositionPoint(selections, 0, 15);
    expect(result[0]).toEqual({ time: 15 });
  });

  test("preserves track on reposition", () => {
    const selections: PointSelection[] = [{ track: 0, time: 10 }];
    const result = repositionPoint(selections, 0, 15);
    expect(result[0]).toEqual({ track: 0, time: 15 });
  });
});

// ----------- Deletion -----------

describe("deleteSelection", () => {
  test("removes correct selection by index (ranges)", () => {
    const selections: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 15, end: 25 },
      { start: 30, end: 40 },
    ];
    const result = deleteSelection(selections, 1);
    expect(result).toEqual([
      { start: 0, end: 10 },
      { start: 30, end: 40 },
    ]);
  });

  test("removes correct selection by index (points)", () => {
    const selections: PointSelection[] = [
      { time: 5 },
      { time: 15 },
      { time: 25 },
    ];
    const result = deleteSelection(selections, 0);
    expect(result).toEqual([{ time: 15 }, { time: 25 }]);
  });

  test("returns empty list when removing last item", () => {
    const selections: RangeSelection[] = [{ start: 0, end: 10 }];
    const result = deleteSelection(selections, 0);
    expect(result).toEqual([]);
  });
});

// ----------- Sorting -----------

describe("sortRanges", () => {
  test("sorts ranges by start ascending", () => {
    const selections: RangeSelection[] = [
      { start: 20, end: 30 },
      { start: 5, end: 15 },
      { start: 10, end: 25 },
    ];
    const result = sortRanges(selections);
    expect(result[0].start).toBe(5);
    expect(result[1].start).toBe(10);
    expect(result[2].start).toBe(20);
  });

  test("stable sort: equal start values maintain order", () => {
    const selections: RangeSelection[] = [
      { track: 0, start: 10, end: 20 },
      { track: 1, start: 10, end: 25 },
    ];
    const result = sortRanges(selections);
    expect(result[0].track).toBe(0);
    expect(result[1].track).toBe(1);
  });
});

describe("sortPoints", () => {
  test("sorts points by time ascending", () => {
    const selections: PointSelection[] = [
      { time: 30 },
      { time: 5 },
      { time: 15 },
    ];
    const result = sortPoints(selections);
    expect(result[0].time).toBe(5);
    expect(result[1].time).toBe(15);
    expect(result[2].time).toBe(30);
  });
});

// ----------- multiSelect enforcement -----------

describe("enforceMultiSelect", () => {
  test("multiSelect false keeps only latest range", () => {
    const selections: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ];
    const result = enforceMultiSelect(selections, false);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ start: 20, end: 30 });
  });

  test("multiSelect true allows accumulation", () => {
    const selections: RangeSelection[] = [
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ];
    const result = enforceMultiSelect(selections, true);
    expect(result).toHaveLength(2);
  });

  test("empty list stays empty regardless of multiSelect", () => {
    const result = enforceMultiSelect([], false);
    expect(result).toEqual([]);
  });
});

// ----------- Undo -----------

describe("undo stack", () => {
  test("push adds snapshot to stack", () => {
    const stack: SelectionSnapshot[] = [];
    const current: RangeSelection[] = [{ start: 0, end: 10 }];
    const newStack = pushUndo(stack, current);
    expect(newStack).toHaveLength(1);
    expect(newStack[0].selections).toEqual(current);
  });

  test("pop restores previous state", () => {
    const snapshot: RangeSelection[] = [{ start: 0, end: 10 }];
    const stack: SelectionSnapshot[] = [{ selections: snapshot }];
    const result = popUndo(stack);
    expect(result).not.toBeNull();
    expect(result!.restored).toEqual(snapshot);
    expect(result!.newStack).toHaveLength(0);
  });

  test("pop on empty stack returns null", () => {
    const result = popUndo([]);
    expect(result).toBeNull();
  });

  test("stack respects max depth (50)", () => {
    let stack: SelectionSnapshot[] = [];
    for (let i = 0; i < 60; i++) {
      stack = pushUndo(stack, [{ start: i, end: i + 1 }]);
    }
    expect(stack.length).toBe(50);
  });

  test("stack drops the OLDEST entry when overflowing", () => {
    // Push 60 distinct snapshots; the trimmed stack should keep entries
    // 10–59 (the most recent 50), not 0–49.
    let stack: SelectionSnapshot[] = [];
    for (let i = 0; i < 60; i++) {
      stack = pushUndo(stack, [{ start: i, end: i + 1 }]);
    }
    expect(stack.length).toBe(50);
    // First (oldest) surviving entry should be the i=10 push
    expect(stack[0]?.selections).toEqual([{ start: 10, end: 11 }]);
    // Last (newest) surviving entry should be the i=59 push
    expect(stack[stack.length - 1]?.selections).toEqual([
      { start: 59, end: 60 },
    ]);
  });
});

// ----------- Edge cases -----------

describe("edge cases", () => {
  test("range at time 0", () => {
    const result = createRange(0, 5, undefined, []);
    expect(result).toEqual({ start: 0, end: 5 });
  });

  test("empty selection list", () => {
    const result = sortRanges([]);
    expect(result).toEqual([]);
  });

  test("single selection in list", () => {
    const selections: RangeSelection[] = [{ start: 5, end: 10 }];
    const result = sortRanges(selections);
    expect(result).toEqual([{ start: 5, end: 10 }]);
  });

  test("deleteSelection with empty list does not throw", () => {
    // Index out of bounds should not crash
    const result = deleteSelection([], 0);
    expect(result).toEqual([]);
  });
});
