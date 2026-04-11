// State management for Timeline selections.
// Pure reducer wrapping selections.ts functions, with undo support.
//
// Pure TypeScript — no React/DOM deps. Used by Timeline.tsx via useReducer.

import {
  type RangeSelection,
  type TimelineValue,
  type SelectionSnapshot,
  createRange,
  createPoint,
  adjustHandle,
  repositionPoint,
  deleteSelection,
  enforceMultiSelect,
  sortRanges,
  sortPoints,
  pushUndo,
  popUndo,
} from "./selections.js";

export interface SelectionState {
  selections: TimelineValue;
  activeIndex: number | null;
  activeHandle: "start" | "end" | null;
  undoStack: SelectionSnapshot[];
}

export function initialSelectionState(): SelectionState {
  return {
    selections: [],
    activeIndex: null,
    activeHandle: null,
    undoStack: [],
  };
}

export type SelectionAction =
  | {
      type: "CREATE_RANGE";
      start: number;
      end: number;
      track: number | undefined;
      multiSelect: boolean;
    }
  | {
      type: "CREATE_POINT";
      time: number;
      track: number | undefined;
      multiSelect: boolean;
    }
  | {
      type: "ADJUST_HANDLE";
      index: number;
      handle: "start" | "end";
      time: number;
    }
  | {
      type: "REPOSITION_POINT";
      index: number;
      time: number;
    }
  | { type: "DELETE" }
  | { type: "SELECT"; index: number }
  | { type: "DESELECT" }
  | { type: "SET_ACTIVE_HANDLE"; handle: "start" | "end" | null }
  | { type: "UNDO" }
  | { type: "REPLACE_ALL"; selections: TimelineValue };

function isRangeArray(s: TimelineValue): s is RangeSelection[] {
  return s.length === 0 || "start" in s[0];
}

function snapshot(state: SelectionState): SelectionState {
  return {
    ...state,
    undoStack: pushUndo(state.undoStack, state.selections),
  };
}

export function selectionsReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case "CREATE_RANGE": {
      const existing = isRangeArray(state.selections) ? state.selections : [];
      const range = createRange(
        action.start,
        action.end,
        action.track,
        existing,
      );
      if (!range) return state;
      const next = enforceMultiSelect(
        sortRanges([...existing, range]),
        action.multiSelect,
      );
      return {
        ...snapshot(state),
        selections: next,
        activeIndex: next.indexOf(range),
        activeHandle: null,
      };
    }

    case "CREATE_POINT": {
      const existing = !isRangeArray(state.selections) ? state.selections : [];
      const point = createPoint(action.time, action.track);
      const next = enforceMultiSelect(
        sortPoints([...existing, point]),
        action.multiSelect,
      );
      return {
        ...snapshot(state),
        selections: next,
        activeIndex: next.indexOf(point),
        activeHandle: null,
      };
    }

    case "ADJUST_HANDLE": {
      if (!isRangeArray(state.selections)) return state;
      const next = adjustHandle(
        state.selections,
        action.index,
        action.handle,
        action.time,
      );
      return {
        ...snapshot(state),
        selections: sortRanges(next),
        activeHandle: action.handle,
      };
    }

    case "REPOSITION_POINT": {
      if (isRangeArray(state.selections)) return state;
      const next = repositionPoint(state.selections, action.index, action.time);
      return {
        ...snapshot(state),
        selections: sortPoints(next),
      };
    }

    case "DELETE": {
      if (state.activeIndex === null) return state;
      const next = deleteSelection(
        state.selections as RangeSelection[],
        state.activeIndex,
      );
      return {
        ...snapshot(state),
        selections: next,
        activeIndex: null,
        activeHandle: null,
      };
    }

    case "SELECT": {
      return {
        ...state,
        activeIndex: action.index,
        activeHandle: null,
      };
    }

    case "DESELECT": {
      return {
        ...state,
        activeIndex: null,
        activeHandle: null,
      };
    }

    case "SET_ACTIVE_HANDLE": {
      return {
        ...state,
        activeHandle: action.handle,
      };
    }

    case "UNDO": {
      const result = popUndo(state.undoStack);
      if (!result) return state;
      return {
        ...state,
        selections: result.restored,
        undoStack: result.newStack,
        activeIndex: null,
        activeHandle: null,
      };
    }

    case "REPLACE_ALL": {
      return {
        ...snapshot(state),
        selections: action.selections,
      };
    }
  }
}
