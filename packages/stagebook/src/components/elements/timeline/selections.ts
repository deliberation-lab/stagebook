// Selection data model for Timeline component.
// Pure TypeScript — no React/DOM dependencies.

/** Round to millisecond precision (3 decimal places). */
export function roundMs(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/**
 * Normalize all time values in a selections array to millisecond precision.
 * Applied before clamping operations so that rounding after clamping can't
 * violate neighbor boundaries established against full-precision values
 * (e.g. from restored saved state with pre-rounding data).
 */
export function normalizeSelections<T extends RangeSelection | PointSelection>(
  selections: T[],
): T[] {
  return selections.map((s) => {
    if ("start" in s && "end" in s) {
      return { ...s, start: roundMs(s.start), end: roundMs(s.end) } as T;
    }
    if ("time" in s) {
      return { ...s, time: roundMs(s.time) } as T;
    }
    return s;
  });
}

export interface RangeSelection {
  track?: number;
  start: number;
  end: number;
}

export interface PointSelection {
  track?: number;
  time: number;
}

export type TimelineValue = RangeSelection[] | PointSelection[];

export interface SelectionSnapshot {
  selections: TimelineValue;
}

const MAX_UNDO_DEPTH = 50;

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export function sortRanges(selections: RangeSelection[]): RangeSelection[] {
  return [...selections].sort((a, b) => a.start - b.start);
}

export function sortPoints(selections: PointSelection[]): PointSelection[] {
  return [...selections].sort((a, b) => a.time - b.time);
}

// ---------------------------------------------------------------------------
// Free-gap clamping (ranges only)
// ---------------------------------------------------------------------------

/** Filter to ranges on the same track (or all if track is undefined). */
function sameScope(
  existing: RangeSelection[],
  track: number | undefined,
): RangeSelection[] {
  if (track === undefined) return existing;
  return existing.filter((r) => r.track === track);
}

/**
 * Clamp a proposed [start, end] to the free gap in the given scope.
 * Returns { start, end } or null if no free space exists.
 */
export function clampToFreeGap(
  start: number,
  end: number,
  track: number | undefined,
  existing: RangeSelection[],
): { start: number; end: number } | null {
  const scoped = sortRanges(sameScope(existing, track));

  // Normalize so start <= end
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);

  // Find the tightest bounds: the latest-ending range that starts before our
  // midpoint (left neighbor) and the earliest-starting range that ends after
  // our midpoint (right neighbor).
  let leftBound = -Infinity;
  let rightBound = Infinity;

  for (const r of scoped) {
    // Range ends at or before our start — it's a left neighbor candidate
    if (r.end <= lo) {
      leftBound = Math.max(leftBound, r.end);
    }
    // Range starts at or after our end — it's a right neighbor candidate
    else if (r.start >= hi) {
      rightBound = Math.min(rightBound, r.start);
      break; // sorted, so first one is the closest
    }
    // Range overlaps our proposed interval — clamp to its edges
    else {
      if (r.start > lo) {
        rightBound = Math.min(rightBound, r.start);
      }
      if (r.end < hi) {
        leftBound = Math.max(leftBound, r.end);
      }
      if (r.start <= lo && r.end >= hi) {
        // Fully enclosed by an existing range — no space
        return null;
      }
    }
  }

  const clampedStart = Math.max(lo, leftBound);
  const clampedEnd = Math.min(hi, rightBound);

  if (clampedStart >= clampedEnd) return null;

  return { start: clampedStart, end: clampedEnd };
}

// ---------------------------------------------------------------------------
// Range creation
// ---------------------------------------------------------------------------

export function createRange(
  start: number,
  end: number,
  track: number | undefined,
  existing: RangeSelection[],
): RangeSelection | null {
  // Normalize existing selections to ms precision before clamping so that
  // rounding the result can't violate boundaries established against
  // full-precision neighbor values (e.g. from pre-rounding saved state).
  const clamped = clampToFreeGap(
    start,
    end,
    track,
    normalizeSelections(existing),
  );
  if (!clamped) return null;

  const range: RangeSelection = {
    start: roundMs(clamped.start),
    end: roundMs(clamped.end),
  };
  if (track !== undefined) range.track = track;
  return range;
}

// ---------------------------------------------------------------------------
// Handle adjustment
// ---------------------------------------------------------------------------

export function adjustHandle(
  selections: RangeSelection[],
  index: number,
  handle: "start" | "end",
  newTime: number,
): RangeSelection[] {
  // Normalize all selections to ms precision before computing neighbor
  // boundaries, so rounding the result can't create overlaps.
  const result = normalizeSelections(selections).map((s) => ({ ...s }));
  const target = result[index];
  if (!target) return result;

  const scoped = sameScope(
    result.filter((_, i) => i !== index),
    target.track,
  );
  const sorted = sortRanges(scoped);

  if (handle === "start") {
    let clampedTime = newTime;

    // Can't go past end handle
    clampedTime = Math.min(clampedTime, target.end);

    // Can't go into previous neighbor
    for (let i = sorted.length - 1; i >= 0; i--) {
      const neighbor = sorted[i];
      if (
        neighbor &&
        (neighbor.end <= target.start || neighbor.end <= clampedTime)
      ) {
        clampedTime = Math.max(clampedTime, neighbor.end);
        break;
      }
    }

    target.start = roundMs(clampedTime);
  } else {
    let clampedTime = newTime;

    // Can't go past start handle
    clampedTime = Math.max(clampedTime, target.start);

    // Can't go into next neighbor
    for (const r of sorted) {
      if (r.start >= target.end || r.start >= clampedTime) {
        clampedTime = Math.min(clampedTime, r.start);
        break;
      }
    }

    target.end = roundMs(clampedTime);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Point creation / repositioning
// ---------------------------------------------------------------------------

export function createPoint(
  time: number,
  track: number | undefined,
): PointSelection {
  const point: PointSelection = { time: roundMs(time) };
  if (track !== undefined) point.track = track;
  return point;
}

export function repositionPoint(
  selections: PointSelection[],
  index: number,
  newTime: number,
): PointSelection[] {
  return selections.map((s, i) =>
    i === index ? { ...s, time: roundMs(newTime) } : s,
  );
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

export function deleteSelection<T extends RangeSelection | PointSelection>(
  selections: T[],
  index: number,
): T[] {
  return selections.filter((_, i) => i !== index);
}

// ---------------------------------------------------------------------------
// multiSelect enforcement
// ---------------------------------------------------------------------------

export function enforceMultiSelect<T extends RangeSelection | PointSelection>(
  selections: T[],
  multiSelect: boolean,
): T[] {
  if (multiSelect || selections.length <= 1) return selections;
  // Keep only the last (newest) selection
  const last = selections[selections.length - 1];
  return last ? [last] : [];
}

// ---------------------------------------------------------------------------
// Undo stack
// ---------------------------------------------------------------------------

export function pushUndo(
  stack: SelectionSnapshot[],
  current: TimelineValue,
): SelectionSnapshot[] {
  const next = [...stack, { selections: [...current] }];
  if (next.length > MAX_UNDO_DEPTH) {
    return next.slice(next.length - MAX_UNDO_DEPTH);
  }
  return next;
}

export function popUndo(
  stack: SelectionSnapshot[],
): { restored: TimelineValue; newStack: SelectionSnapshot[] } | null {
  const last = stack[stack.length - 1];
  if (!last) return null;
  const newStack = stack.slice(0, -1);
  return { restored: last.selections, newStack };
}
