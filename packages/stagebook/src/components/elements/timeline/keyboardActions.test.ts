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
    it("returns null for arrow keys", () => {
      expect(
        keyToAction(
          { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toBe(null);
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
      ).toBe(null);
    });

    it("returns null for comma/period", () => {
      expect(
        keyToAction(
          { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx({ activeIndex: null }),
        ),
      ).toBe(null);
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

    it("STILL handles Ctrl+Z (undo doesn't need active selection)", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: false },
        ctx({ activeIndex: null }),
      );
      expect(action).toEqual({ type: "undo" });
    });
  });

  describe("Space and K never intercepted", () => {
    it("returns null for Space even with active selection", () => {
      expect(
        keyToAction(
          { key: " ", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
    });

    it("returns null for k", () => {
      expect(
        keyToAction(
          { key: "k", ctrlKey: false, metaKey: false, shiftKey: false },
          ctx(),
        ),
      ).toBe(null);
    });

    it("returns null for J/L (MediaPlayer's seek shortcuts)", () => {
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

  describe("range mode arrow keys", () => {
    it("ArrowLeft adjusts active handle by -1s (end handle)", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end", currentRange: { start: 10, end: 20 } }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 19,
      });
    });

    it("ArrowRight adjusts active handle by +1s (end handle)", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end", currentRange: { start: 10, end: 20 } }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 21,
      });
    });

    it("works on start handle", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "start", currentRange: { start: 10, end: 20 } }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "start",
        time: 9,
      });
    });

    it("returns null when no active handle (range selected but neither handle)", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: null }),
      );
      expect(action).toBe(null);
    });
  });

  describe("range mode comma/period (frame step)", () => {
    it("comma adjusts active handle by -1 frame", () => {
      const action = keyToAction(
        { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end", currentRange: { start: 10, end: 20 } }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 20 - FRAME_STEP,
      });
    });

    it("period adjusts active handle by +1 frame", () => {
      const action = keyToAction(
        { key: ".", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end", currentRange: { start: 10, end: 20 } }),
      );
      expect(action).toEqual({
        type: "adjustHandle",
        index: 0,
        handle: "end",
        time: 20 + FRAME_STEP,
      });
    });
  });

  describe("range mode Tab", () => {
    it("Tab switches active handle from end to start", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "end" }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "start" });
    });

    it("Tab switches active handle from start to end", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: "start" }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "end" });
    });

    it("Tab defaults to end when no handle is active but range is selected", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({ activeHandle: null }),
      );
      expect(action).toEqual({ type: "switchHandle", handle: "end" });
    });
  });

  describe("point mode arrow keys", () => {
    it("ArrowLeft repositions point by -1s", () => {
      const action = keyToAction(
        { key: "ArrowLeft", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          activeHandle: null,
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(action).toEqual({ type: "repositionPoint", index: 0, time: 14 });
    });

    it("ArrowRight repositions point by +1s", () => {
      const action = keyToAction(
        { key: "ArrowRight", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          activeHandle: null,
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(action).toEqual({ type: "repositionPoint", index: 0, time: 16 });
    });

    it("comma/period reposition by 1 frame", () => {
      const left = keyToAction(
        { key: ",", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          activeHandle: null,
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(left).toEqual({
        type: "repositionPoint",
        index: 0,
        time: 15 - FRAME_STEP,
      });
    });

    it("Tab is a no-op in point mode", () => {
      const action = keyToAction(
        { key: "Tab", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx({
          selectionType: "point",
          activeHandle: null,
          currentRange: null,
          currentPoint: { time: 15 },
        }),
      );
      expect(action).toBe(null);
    });
  });

  describe("Delete / Escape", () => {
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

  describe("Undo", () => {
    it("Ctrl+Z returns undo action", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "undo" });
    });

    it("Cmd+Z returns undo action (Mac)", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: false, metaKey: true, shiftKey: false },
        ctx(),
      );
      expect(action).toEqual({ type: "undo" });
    });

    it("Ctrl+Shift+Z is not handled here (would be redo)", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: true, metaKey: false, shiftKey: true },
        ctx(),
      );
      expect(action).toBe(null);
    });

    it("plain z is not undo", () => {
      const action = keyToAction(
        { key: "z", ctrlKey: false, metaKey: false, shiftKey: false },
        ctx(),
      );
      expect(action).toBe(null);
    });
  });
});
