import { describe, it, expect } from "vitest";
import { keyToAction, FRAME_STEP, type KeyContext } from "./keyboardActions.js";

function ctx(overrides: Partial<KeyContext> = {}): KeyContext {
  return {
    selectionType: "range",
    activeIndex: 0,
    activeHandle: "end",
    currentRange: { start: 10, end: 20 },
    currentPoint: null,
    ...overrides,
  };
}

describe("keyToAction", () => {
  describe("when no selection is active", () => {
    it("arrow keys return seekPlayhead when no selection", () => {
      expect(
        keyToAction(
          { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toEqual({ type: "seekPlayhead", delta: -1 });
      expect(
        keyToAction(
          {
            key: "ArrowRight",
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
          },
          ctx({ activeIndex: null }),
        ),
      ).toEqual({ type: "seekPlayhead", delta: 1 });
    });

    it("comma/period return seekPlayhead when no selection", () => {
      expect(
        keyToAction(
          { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toEqual({ type: "seekPlayhead", delta: -FRAME_STEP });
    });

    it("returns null for Tab", () => {
      expect(
        keyToAction(
          { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toBe(null);
    });

    it("returns null for Delete", () => {
      expect(
        keyToAction(
          { key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toBe(null);
    });

    it("returns null for Escape", () => {
      expect(
        keyToAction(
          { key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toBe(null);
    });

    it("Ctrl+Z returns undo even with no selection", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: false },
        ctx({ activeIndex: null }),
      );
      expect(action).toEqual({ type: "undo" });
    });
  });

  describe("Space and K handling", () => {
    it("Space returns togglePlayPause with active selection", () => {
      expect(
        keyToAction(
          { key: " ", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toEqual({ type: "togglePlayPause" });
    });

    it("returns null for k", () => {
      expect(
        keyToAction(
          { key: "k", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
    });

    it("returns null for K", () => {
      expect(
        keyToAction(
          { key: "K", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
    });

    it("returns null for J and L (MediaPlayer shortcuts)", () => {
      expect(
        keyToAction(
          { key: "j", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
      expect(
        keyToAction(
          { key: "l", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
    });
  });

  describe("range mode: handle adjustment", () => {
    it("ArrowRight extends end handle by ARROW_STEP", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 21,
      });
    });

    it("ArrowLeft moves end handle left", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 19,
      });
    });

    it("comma steps back by FRAME_STEP", () => {
      const action = keyToAction(
        { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 20 - FRAME_STEP,
      });
    });

    it("period steps forward by FRAME_STEP", () => {
      const action = keyToAction(
        { key: ".", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 20 + FRAME_STEP,
      });
    });

    it("adjusts start handle when activeHandle is start", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "start" }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "start",
        time: 11,
      });
    });

    it("returns null for arrow keys when no handle is active", () => {
      expect(
        keyToAction(
          {
            key: "ArrowRight",
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
          },
          ctx({ activeHandle: null }),
        ),
      ).toBe(null);
    });
  });

  describe("range mode: Tab switches handle", () => {
    it("Tab switches from end to start", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end" }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "start" });
    });

    it("Tab switches from start to end", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "start" }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "end" });
    });

    it("Tab defaults to end when no handle is active", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: null }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "end" });
    });
  });

  describe("point mode: repositioning", () => {
    it("ArrowRight moves point forward", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(action).toEqual({
        type: "repositionPoint",
        index: 0,
        time: 16,
      });
    });

    it("comma steps back by FRAME_STEP", () => {
      const action = keyToAction(
        { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(action).toEqual({
        type: "repositionPoint",
        index: 0,
        time: 15 - FRAME_STEP,
      });
    });
  });

  describe("Delete and Escape", () => {
    it("Delete returns delete action", () => {
      const action = keyToAction(
        { key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "delete" });
    });

    it("Backspace returns delete action", () => {
      const action = keyToAction(
        { key: "Backspace", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "delete" });
    });

    it("Escape returns deselect action", () => {
      const action = keyToAction(
        { key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "deselect" });
    });
  });

  describe("undo", () => {
    it("Ctrl+Z returns undo", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "undo" });
    });

    it("Cmd+Z returns undo", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: false, metaKey: true, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "undo" });
    });

    it("Ctrl+Shift+Z does not undo (redo is not supported)", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: true },
        ctx(),
      );
      expect(action).toBe(null);
    });
  });

  describe("unhandled keys", () => {
    it("returns null for unrecognized keys", () => {
      const action = keyToAction(
        { key: "a", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toBe(null);
    });
  });

  describe("spacebar play/pause", () => {
    it("Space returns togglePlayPause", () => {
      const action = keyToAction(
        { key: " ", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "togglePlayPause" });
    });

    it("Space returns togglePlayPause even without active selection", () => {
      const action = keyToAction(
        { key: " ", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeIndex: null }),
      );
      expect(action).toEqual({ type: "togglePlayPause" });
    });
  });

  describe("playhead scrubbing (no active selection)", () => {
    const noSelection = ctx({
      activeIndex: null,
      activeHandle: null,
      currentRange: null,
    });

    it("ArrowRight seeks forward 1s", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        noSelection,
      );
      expect(action).toEqual({ type: "seekPlayhead", delta: 1 });
    });

    it("ArrowLeft seeks backward 1s", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        noSelection,
      );
      expect(action).toEqual({ type: "seekPlayhead", delta: -1 });
    });

    it("Period seeks forward one frame", () => {
      const action = keyToAction(
        { key: ".", ctrlKey: false, metaKey: false, shiftKey: false },
        noSelection,
      );
      expect(action).toEqual({ type: "seekPlayhead", delta: FRAME_STEP });
    });

    it("Comma seeks backward one frame", () => {
      const action = keyToAction(
        { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
        noSelection,
      );
      expect(action).toEqual({ type: "seekPlayhead", delta: -FRAME_STEP });
    });
  });
});
