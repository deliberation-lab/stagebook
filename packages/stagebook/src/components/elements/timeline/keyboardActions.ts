// Pure key-to-action mapping for Timeline keyboard editing.
// No React/DOM deps — used by Timeline.tsx's keydown handler.
//
// IMPORTANT: This is the arbitration point between Timeline and MediaPlayer.
// Returning `null` means "fall through to MediaPlayer". Returning an action
// means "the timeline handles this; preventDefault + stopPropagation".

/** Frame step for comma/period: 1/30s ≈ one video frame at 30fps. */
export const FRAME_STEP = 1 / 30;

/** Adjustment in seconds for arrow keys. */
const ARROW_STEP = 1;

export interface KeyContext {
  selectionType: "range" | "point";
  activeIndex: number | null;
  /** Range mode only: which handle is currently active. */
  activeHandle: "start" | "end" | null;
  /** Range mode only: the currently active range, if any. */
  currentRange: { start: number; end: number } | null;
  /** Point mode only: the currently active point, if any. */
  currentPoint: { time: number } | null;
}

export type KeyAction =
  | {
      type: "adjustHandle";
      index: number;
      handle: "start" | "end";
      time: number;
    }
  | { type: "repositionPoint"; index: number; time: number }
  | { type: "switchHandle"; handle: "start" | "end" }
  | { type: "delete" }
  | { type: "deselect" }
  | { type: "undo" };

/** Subset of KeyboardEvent that we care about — easier to test. */
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

/**
 * Map a keyboard event + selection context to an action, or null if the
 * event should fall through to the MediaPlayer.
 *
 * Rules:
 * - Space, K, J, L are NEVER intercepted (always belong to MediaPlayer)
 * - Ctrl+Z / Cmd+Z (without Shift) is undo, even when no selection is active
 * - All other actions require an active selection (`activeIndex !== null`)
 */
export function keyToAction(
  e: KeyEventLike,
  ctx: KeyContext,
): KeyAction | null {
  // Never intercept playback shortcuts — always fall through.
  if (e.key === " " || e.key === "k" || e.key === "K") return null;
  if (e.key === "j" || e.key === "J" || e.key === "l" || e.key === "L")
    return null;

  // Undo works regardless of active selection.
  if (
    (e.ctrlKey || e.metaKey) &&
    !e.shiftKey &&
    (e.key === "z" || e.key === "Z")
  ) {
    return { type: "undo" };
  }

  // Everything else requires an active selection.
  if (ctx.activeIndex === null) return null;

  if (e.key === "Delete" || e.key === "Backspace") {
    return { type: "delete" };
  }

  if (e.key === "Escape") {
    return { type: "deselect" };
  }

  // Range mode: arrows + comma/period adjust the active handle.
  if (ctx.selectionType === "range" && ctx.currentRange) {
    if (e.key === "Tab") {
      const next: "start" | "end" =
        ctx.activeHandle === "start" ? "end" : "start";
      // No active handle: default to end (the most common adjustment target)
      const handle = ctx.activeHandle === null ? "end" : next;
      return { type: "switchHandle", handle };
    }

    if (ctx.activeHandle === null) return null;

    let delta = 0;
    if (e.key === "ArrowLeft") delta = -ARROW_STEP;
    else if (e.key === "ArrowRight") delta = ARROW_STEP;
    else if (e.key === ",") delta = -FRAME_STEP;
    else if (e.key === ".") delta = FRAME_STEP;
    else return null;

    const currentTime =
      ctx.activeHandle === "start"
        ? ctx.currentRange.start
        : ctx.currentRange.end;
    return {
      type: "adjustHandle",
      index: ctx.activeIndex,
      handle: ctx.activeHandle,
      time: currentTime + delta,
    };
  }

  // Point mode: arrows + comma/period reposition the active point.
  if (ctx.selectionType === "point" && ctx.currentPoint) {
    let delta = 0;
    if (e.key === "ArrowLeft") delta = -ARROW_STEP;
    else if (e.key === "ArrowRight") delta = ARROW_STEP;
    else if (e.key === ",") delta = -FRAME_STEP;
    else if (e.key === ".") delta = FRAME_STEP;
    else return null;

    return {
      type: "repositionPoint",
      index: ctx.activeIndex,
      time: ctx.currentPoint.time + delta,
    };
  }

  return null;
}
