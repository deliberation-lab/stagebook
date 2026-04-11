import { describe, it, expect } from "vitest";
import {
  initialSelectionState,
  selectionsReducer,
  type SelectionState,
} from "./selectionsReducer.js";

function emptyState(): SelectionState {
  return initialSelectionState();
}

describe("selectionsReducer", () => {
  describe("CREATE_RANGE", () => {
    it("creates a range and adds it to selections", () => {
      const state = emptyState();
      const result = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 10,
        end: 20,
        track: undefined,
        multiSelect: true,
      });
      expect(result.selections).toEqual([{ start: 10, end: 20 }]);
    });

    it("clamps to free gap when overlapping existing range", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      const result = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 15,
        end: 30,
        track: undefined,
        multiSelect: true,
      });
      // Should clamp to 20-30 (free space after existing)
      expect(result.selections).toHaveLength(2);
      const newRange = (
        result.selections as { start: number; end: number }[]
      ).find((r) => r.start === 20);
      expect(newRange).toBeDefined();
    });

    it("sorts selections chronologically", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 30,
        end: 40,
        track: undefined,
        multiSelect: true,
      });
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 10,
        end: 20,
        track: undefined,
        multiSelect: true,
      });
      const sels = state.selections as { start: number }[];
      expect(sels[0]?.start).toBe(10);
      expect(sels[1]?.start).toBe(30);
    });

    it("replaces existing when multiSelect is false", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 5,
        end: 10,
        track: undefined,
        multiSelect: false,
      });
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 30,
        end: 40,
        track: undefined,
        multiSelect: false,
      });
      expect(state.selections).toEqual([{ start: 30, end: 40 }]);
    });

    it("includes track field in scope=track mode", () => {
      const state = emptyState();
      const result = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 10,
        end: 20,
        track: 1,
        multiSelect: true,
      });
      expect(result.selections).toEqual([{ track: 1, start: 10, end: 20 }]);
    });
  });

  describe("CREATE_POINT", () => {
    it("creates a point", () => {
      const state = emptyState();
      const result = selectionsReducer(state, {
        type: "CREATE_POINT",
        time: 15,
        track: undefined,
        multiSelect: true,
      });
      expect(result.selections).toEqual([{ time: 15 }]);
    });

    it("sorts points chronologically", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_POINT",
        time: 30,
        track: undefined,
        multiSelect: true,
      });
      state = selectionsReducer(state, {
        type: "CREATE_POINT",
        time: 10,
        track: undefined,
        multiSelect: true,
      });
      const pts = state.selections as { time: number }[];
      expect(pts.map((p) => p.time)).toEqual([10, 30]);
    });

    it("replaces existing when multiSelect is false", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_POINT",
        time: 5,
        track: undefined,
        multiSelect: false,
      });
      state = selectionsReducer(state, {
        type: "CREATE_POINT",
        time: 20,
        track: undefined,
        multiSelect: false,
      });
      expect(state.selections).toEqual([{ time: 20 }]);
    });
  });

  describe("ADJUST_HANDLE", () => {
    it("moves start handle", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      const result = selectionsReducer(state, {
        type: "ADJUST_HANDLE",
        index: 0,
        handle: "start",
        time: 15,
      });
      expect(
        (result.selections[0] as { start: number; end: number }).start,
      ).toBe(15);
      expect((result.selections[0] as { start: number; end: number }).end).toBe(
        20,
      );
    });

    it("moves end handle", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      const result = selectionsReducer(state, {
        type: "ADJUST_HANDLE",
        index: 0,
        handle: "end",
        time: 25,
      });
      expect((result.selections[0] as { start: number; end: number }).end).toBe(
        25,
      );
    });

    it("clamps handle at neighbor boundary", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [
          { start: 10, end: 20 },
          { start: 30, end: 40 },
        ],
      };
      const result = selectionsReducer(state, {
        type: "ADJUST_HANDLE",
        index: 0,
        handle: "end",
        time: 35,
      });
      // End handle of range 0 should be clamped at start of range 1 (30)
      expect((result.selections[0] as { start: number; end: number }).end).toBe(
        30,
      );
    });
  });

  describe("REPOSITION_POINT", () => {
    it("moves a point", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ time: 10 }],
      };
      const result = selectionsReducer(state, {
        type: "REPOSITION_POINT",
        index: 0,
        time: 25,
      });
      expect((result.selections[0] as { time: number }).time).toBe(25);
    });
  });

  describe("DELETE", () => {
    it("removes the active selection", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [
          { start: 10, end: 20 },
          { start: 30, end: 40 },
        ],
        activeIndex: 0,
      };
      const result = selectionsReducer(state, { type: "DELETE" });
      expect(result.selections).toEqual([{ start: 30, end: 40 }]);
      expect(result.activeIndex).toBe(null);
    });

    it("does nothing when no active selection", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
        activeIndex: null,
      };
      const result = selectionsReducer(state, { type: "DELETE" });
      expect(result.selections).toHaveLength(1);
    });
  });

  describe("SELECT", () => {
    it("sets active index", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [
          { start: 10, end: 20 },
          { start: 30, end: 40 },
        ],
      };
      const result = selectionsReducer(state, {
        type: "SELECT",
        index: 1,
      });
      expect(result.activeIndex).toBe(1);
    });
  });

  describe("DESELECT", () => {
    it("clears active index and handle", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
        activeIndex: 0,
        activeHandle: "start",
      };
      const result = selectionsReducer(state, { type: "DESELECT" });
      expect(result.activeIndex).toBe(null);
      expect(result.activeHandle).toBe(null);
    });
  });

  describe("UNDO", () => {
    it("restores previous state after CREATE", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 10,
        end: 20,
        track: undefined,
        multiSelect: true,
      });
      expect(state.selections).toHaveLength(1);

      state = selectionsReducer(state, { type: "UNDO" });
      expect(state.selections).toHaveLength(0);
    });

    it("restores after DELETE", () => {
      let state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
        activeIndex: 0,
      };
      state = selectionsReducer(state, { type: "DELETE" });
      expect(state.selections).toHaveLength(0);

      state = selectionsReducer(state, { type: "UNDO" });
      expect(state.selections).toEqual([{ start: 10, end: 20 }]);
    });

    it("restores after ADJUST_HANDLE", () => {
      let state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      state = selectionsReducer(state, {
        type: "ADJUST_HANDLE",
        index: 0,
        handle: "end",
        time: 25,
      });
      expect((state.selections[0] as { end: number }).end).toBe(25);

      state = selectionsReducer(state, { type: "UNDO" });
      expect((state.selections[0] as { end: number }).end).toBe(20);
    });

    it("does nothing when undo stack is empty", () => {
      const state = emptyState();
      const result = selectionsReducer(state, { type: "UNDO" });
      expect(result.selections).toEqual([]);
      expect(result.undoStack).toEqual([]);
    });

    it("supports multiple undo levels", () => {
      let state = emptyState();
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 10,
        end: 20,
        track: undefined,
        multiSelect: true,
      });
      state = selectionsReducer(state, {
        type: "CREATE_RANGE",
        start: 30,
        end: 40,
        track: undefined,
        multiSelect: true,
      });
      expect(state.selections).toHaveLength(2);

      state = selectionsReducer(state, { type: "UNDO" });
      expect(state.selections).toHaveLength(1);

      state = selectionsReducer(state, { type: "UNDO" });
      expect(state.selections).toHaveLength(0);
    });
  });

  describe("SET_ACTIVE_HANDLE", () => {
    it("sets the active handle", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
        activeIndex: 0,
      };
      const result = selectionsReducer(state, {
        type: "SET_ACTIVE_HANDLE",
        handle: "end",
      });
      expect(result.activeHandle).toBe("end");
    });
  });

  describe("BEGIN_DRAG + noSnapshot collapse", () => {
    it("BEGIN_DRAG snapshots without changing selections", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      const result = selectionsReducer(state, { type: "BEGIN_DRAG" });
      expect(result.selections).toEqual([{ start: 10, end: 20 }]);
      expect(result.undoStack).toHaveLength(1);
    });

    it("ADJUST_HANDLE with noSnapshot does not push to undo stack", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      const after = selectionsReducer(state, {
        type: "ADJUST_HANDLE",
        index: 0,
        handle: "end",
        time: 25,
        noSnapshot: true,
      });
      expect((after.selections[0] as { end: number }).end).toBe(25);
      expect(after.undoStack).toHaveLength(0);
    });

    it("REPOSITION_POINT with noSnapshot does not push to undo stack", () => {
      const state: SelectionState = {
        ...emptyState(),
        selections: [{ time: 10 }],
      };
      const after = selectionsReducer(state, {
        type: "REPOSITION_POINT",
        index: 0,
        time: 25,
        noSnapshot: true,
      });
      expect((after.selections[0] as { time: number }).time).toBe(25);
      expect(after.undoStack).toHaveLength(0);
    });

    it("BEGIN_DRAG + many noSnapshot adjusts collapses to a single undo step", () => {
      let state: SelectionState = {
        ...emptyState(),
        selections: [{ start: 10, end: 20 }],
      };
      // Simulate the start of a drag — single snapshot at start
      state = selectionsReducer(state, { type: "BEGIN_DRAG" });
      // Then 10 noSnapshot pointermove dispatches
      for (let t = 21; t <= 30; t++) {
        state = selectionsReducer(state, {
          type: "ADJUST_HANDLE",
          index: 0,
          handle: "end",
          time: t,
          noSnapshot: true,
        });
      }
      expect((state.selections[0] as { end: number }).end).toBe(30);
      expect(state.undoStack).toHaveLength(1);

      // One UNDO restores all the way back to the pre-drag state
      state = selectionsReducer(state, { type: "UNDO" });
      expect((state.selections[0] as { end: number }).end).toBe(20);
    });
  });
});
