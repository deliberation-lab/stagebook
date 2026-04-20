import React, { useCallback, useRef, useState } from "react";
import { pixelToTime, timeToPixel } from "./timelineLayout.js";
import { clampToFreeGap } from "./selections.js";
import type { RangeSelection, TimelineValue } from "./selections.js";
import { formatTime } from "../../../utils/formatTime.js";
import { zoomDecimals, handleTooltipStyle } from "./timelineStyles.js";

export interface SelectionOverlayProps {
  /** Width of the waveform area in pixels (excludes gutter). */
  width: number;
  /** Height of the overlay in pixels (covers all tracks). */
  height: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Current zoom level (1 = full duration visible). */
  zoomLevel: number;
  /** Left edge of the visible region in seconds. */
  viewportStart: number;
  /** Selection type. */
  selectionType: "range" | "point";
  /** Selection scope. */
  selectionScope: "track" | "all";
  /** Number of tracks (for track-mode hit testing). */
  channelCount: number;
  /** Whether multiple selections are allowed. When false, new selections
   *  replace existing ones — the drag preview should not clamp against
   *  ranges that are about to be replaced. */
  multiSelect: boolean;
  /** Current selections from reducer state. */
  selections: TimelineValue;
  /** Index of the active/focused selection. */
  activeIndex: number | null;
  /** Active handle in range mode. */
  activeHandle: "start" | "end" | null;

  // ── Callbacks (Timeline.tsx wires these to dispatch + seek) ──
  onSeek: (time: number) => void;
  onCreateRange: (
    start: number,
    end: number,
    track: number | undefined,
  ) => void;
  onCreatePoint: (time: number, track: number | undefined) => void;
  /**
   * `noSnapshot=true` skips the undo snapshot — used for live drag
   * pointermove events so the entire drag collapses into one undo step.
   */
  onAdjustHandle: (
    index: number,
    handle: "start" | "end",
    time: number,
    noSnapshot?: boolean,
  ) => void;
  onRepositionPoint: (
    index: number,
    time: number,
    noSnapshot?: boolean,
  ) => void;
  onSelect: (index: number) => void;
  onDeselect: () => void;
  onSetActiveHandle: (handle: "start" | "end" | null) => void;
  /** Begin a drag transaction — pushes one undo snapshot, defers saves. */
  onBeginDrag: () => void;
  /** End a drag transaction — releases the save defer. */
  onEndDrag: () => void;
  /** Request the parent to focus its keyboard-event container. Called after
   *  selection actions so keyboard shortcuts (arrows, Tab, Delete, Escape)
   *  work immediately without the user manually clicking the timeline. */
  onRequestFocus: () => void;
}

const DRAG_DEAD_ZONE_PX = 4;

interface DragState {
  startX: number;
  startTime: number;
  /** Did the mouse move beyond the dead zone? */
  isDragging: boolean;
  /** What kind of drag is in progress. */
  mode: "create-range" | "adjust-handle" | "reposition-point" | "click";
  /** For adjust-handle: which selection and which handle. */
  index?: number;
  handle?: "start" | "end";
  /** For all drags in track mode: which track. */
  track?: number;
  /**
   * Has this drag already pushed its undo snapshot via onBeginDrag?
   * Used to ensure each drag collapses to a single undo step.
   */
  beganDrag?: boolean;
}

function isRangeArray(s: TimelineValue): s is RangeSelection[] {
  return s.length === 0 || "start" in (s[0] as object);
}

/**
 * Renders all selections (ranges or points) and handles mouse/touch events
 * for creating, selecting, and editing them. Absolutely positioned over the
 * waveform area.
 */
export function SelectionOverlay({
  width,
  height,
  duration,
  zoomLevel,
  viewportStart,
  selectionType,
  selectionScope,
  channelCount,
  multiSelect,
  selections,
  activeIndex,
  activeHandle,
  onSeek,
  onCreateRange,
  onCreatePoint,
  onAdjustHandle,
  onRepositionPoint,
  onSelect,
  onDeselect,
  onSetActiveHandle,
  onBeginDrag,
  onEndDrag,
  onRequestFocus,
}: SelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Live drag preview for "create-range" before mouseup commits the range
  const [dragPreview, setDragPreview] = useState<{
    startTime: number;
    endTime: number;
    track: number | undefined;
  } | null>(null);
  // Track which handle is hovered for time tooltip display
  const [hoveredHandle, setHoveredHandle] = useState<{
    index: number;
    handle: "start" | "end";
  } | null>(null);

  const trackHeight = channelCount > 0 ? height / channelCount : height;

  const eventToTime = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      return pixelToTime(localX, duration, width, zoomLevel, viewportStart);
    },
    [duration, width, zoomLevel, viewportStart],
  );

  const eventToTrack = useCallback(
    (clientY: number): number | undefined => {
      if (selectionScope !== "track") return undefined;
      const el = containerRef.current;
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      const localY = clientY - rect.top;
      const trackIdx = Math.floor(localY / trackHeight);
      return Math.max(0, Math.min(channelCount - 1, trackIdx));
    },
    [selectionScope, trackHeight, channelCount],
  );

  // ── Pointer handlers (mouse + touch unified) ──

  /** Capture the pointer so drag gestures continue even if the pointer
   *  leaves the overlay. Silently ignore failures in test environments
   *  where the pointerId may not be a real OS pointer. */
  const capturePointer = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const releasePointer = useCallback((e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      capturePointer(e);
      const time = eventToTime(e.clientX);
      const track = eventToTrack(e.clientY);
      dragRef.current = {
        startX: e.clientX,
        startTime: time,
        isDragging: false,
        mode: "click",
        track,
      };
    },
    [eventToTime, eventToTrack, capturePointer],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = Math.abs(e.clientX - drag.startX);
      if (!drag.isDragging && dx < DRAG_DEAD_ZONE_PX) return;

      if (!drag.isDragging) {
        drag.isDragging = true;
        if (drag.mode === "click") {
          drag.mode =
            selectionType === "range" ? "create-range" : "reposition-point";
        }
      }

      const rawTime = eventToTime(e.clientX);
      const currentTime = Math.max(0, Math.min(duration, rawTime));

      if (drag.mode === "create-range") {
        setDragPreview({
          startTime: drag.startTime,
          endTime: currentTime,
          track: drag.track,
        });
      } else if (
        drag.mode === "adjust-handle" &&
        drag.index !== undefined &&
        drag.handle
      ) {
        // First move of an adjust-handle drag: snapshot once, then defer
        // saves until pointerup. Subsequent moves use noSnapshot=true so
        // the entire drag collapses to one undo step.
        if (!drag.beganDrag) {
          drag.beganDrag = true;
          onBeginDrag();
        }
        onAdjustHandle(drag.index, drag.handle, currentTime, true);
      } else if (drag.mode === "reposition-point" && drag.index !== undefined) {
        if (!drag.beganDrag) {
          drag.beganDrag = true;
          onBeginDrag();
        }
        onRepositionPoint(drag.index, currentTime, true);
      }
    },
    [
      eventToTime,
      duration,
      onAdjustHandle,
      onRepositionPoint,
      onBeginDrag,
      selectionType,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      releasePointer(e);
      const drag = dragRef.current;
      if (!drag) return;

      const time = eventToTime(e.clientX);
      const track = drag.track;

      if (!drag.isDragging) {
        if (selectionType === "point") {
          onCreatePoint(time, track);
          onSeek(time);
          onRequestFocus();
        } else {
          if (activeIndex !== null) {
            onDeselect();
          }
          onSeek(time);
        }
      } else if (drag.mode === "create-range") {
        const start = Math.min(drag.startTime, time);
        const end = Math.max(drag.startTime, time);
        if (end - start > 0) {
          onCreateRange(start, end, track);
          onRequestFocus();
        }
        setDragPreview(null);
      }

      // Release the save defer for adjust-handle / reposition-point drags
      if (drag.beganDrag) {
        onEndDrag();
        onRequestFocus();
      }
      dragRef.current = null;
      setHoveredHandle(null);
    },
    [
      eventToTime,
      selectionType,
      activeIndex,
      onCreatePoint,
      onSeek,
      onDeselect,
      onCreateRange,
      onEndDrag,
      onRequestFocus,
      releasePointer,
    ],
  );

  const handleRangeBodyPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.stopPropagation();
      onSelect(index);
      onRequestFocus();
      dragRef.current = null;
    },
    [onSelect, onRequestFocus],
  );

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, index: number, handle: "start" | "end") => {
      e.stopPropagation();
      if (e.button !== 0) return;
      // Capture on the overlay container (parent), not the handle itself,
      // so pointermove/pointerup keep flowing to the overlay during drag.
      const overlay = containerRef.current;
      if (overlay) {
        try {
          overlay.setPointerCapture(e.pointerId);
        } catch {
          // ignore in test environments
        }
      }
      onSelect(index);
      onSetActiveHandle(handle);
      const time = eventToTime(e.clientX);
      dragRef.current = {
        startX: e.clientX,
        startTime: time,
        isDragging: false,
        mode: "adjust-handle",
        index,
        handle,
      };
    },
    [eventToTime, onSelect, onSetActiveHandle],
  );

  const handlePointPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const overlay = containerRef.current;
      if (overlay) {
        try {
          overlay.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      onSelect(index);
      const time = eventToTime(e.clientX);
      dragRef.current = {
        startX: e.clientX,
        startTime: time,
        isDragging: false,
        mode: "reposition-point",
        index,
      };
    },
    [eventToTime, onSelect],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      releasePointer(e);
      if (dragRef.current?.beganDrag) onEndDrag();
      dragRef.current = null;
      setDragPreview(null);
      setHoveredHandle(null);
    },
    [onEndDrag, releasePointer],
  );

  // ── Render ──

  const renderRanges = () => {
    if (!isRangeArray(selections)) return null;
    return selections.map((range, i) => {
      const isActive = i === activeIndex;
      const x1 = timeToPixel(
        range.start,
        duration,
        width,
        zoomLevel,
        viewportStart,
      );
      const x2 = timeToPixel(
        range.end,
        duration,
        width,
        zoomLevel,
        viewportStart,
      );
      const left = Math.min(x1, x2);
      const rangeWidth = Math.abs(x2 - x1);

      // When the end handle is near the right edge of the visible area,
      // put the start handle on top so the user can grab it to drag left.
      // At the left edge, the default (end handle on top via DOM order)
      // is correct since the end handle is the one that can move right.
      const startHandleOnTop = x2 > width - 10;

      // Per-track positioning in track scope
      const top =
        selectionScope === "track" && range.track !== undefined
          ? range.track * trackHeight
          : 0;
      const rangeHeight = selectionScope === "track" ? trackHeight : height;

      return (
        <div
          key={`range-${String(i)}`}
          data-testid={`range-${String(i)}`}
          data-active={isActive}
          onPointerDown={(e) => handleRangeBodyPointerDown(e, i)}
          style={{
            position: "absolute",
            left: `${String(left)}px`,
            top: `${String(top)}px`,
            width: `${String(rangeWidth)}px`,
            height: `${String(rangeHeight)}px`,
            background: isActive
              ? "rgba(59, 130, 246, 0.35)"
              : "rgba(59, 130, 246, 0.18)",
            border: isActive
              ? "1px solid rgba(59, 130, 246, 0.9)"
              : "1px solid rgba(59, 130, 246, 0.4)",
            boxSizing: "border-box",
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          {/* Start handle */}
          <div
            data-testid={`range-${String(i)}-handle-start`}
            data-active={isActive && activeHandle === "start"}
            draggable={false}
            onPointerDown={(e) => {
              e.preventDefault(); // suppress native drag-and-drop
              setHoveredHandle({ index: i, handle: "start" });
              handleHandlePointerDown(e, i, "start");
            }}
            onPointerEnter={() =>
              setHoveredHandle({ index: i, handle: "start" })
            }
            onPointerLeave={() => {
              if (!dragRef.current) setHoveredHandle(null);
            }}
            style={{
              position: "absolute",
              left: -3,
              top: 0,
              width: 6,
              height: "100%",
              background:
                isActive && activeHandle === "start"
                  ? "rgba(37, 99, 235, 1)"
                  : "rgba(59, 130, 246, 0.7)",
              cursor: "ew-resize",
              zIndex: startHandleOnTop ? 2 : 1,
            }}
          >
            {hoveredHandle?.index === i &&
              hoveredHandle?.handle === "start" && (
                <div style={handleTooltipStyle("start")}>
                  {formatTime(range.start, zoomDecimals(zoomLevel))}
                </div>
              )}
          </div>
          {/* End handle */}
          <div
            data-testid={`range-${String(i)}-handle-end`}
            data-active={isActive && activeHandle === "end"}
            draggable={false}
            onPointerDown={(e) => {
              e.preventDefault(); // suppress native drag-and-drop
              setHoveredHandle({ index: i, handle: "end" });
              handleHandlePointerDown(e, i, "end");
            }}
            onPointerEnter={() => setHoveredHandle({ index: i, handle: "end" })}
            onPointerLeave={() => {
              if (!dragRef.current) setHoveredHandle(null);
            }}
            style={{
              position: "absolute",
              right: -3,
              top: 0,
              width: 6,
              height: "100%",
              background:
                isActive && activeHandle === "end"
                  ? "rgba(37, 99, 235, 1)"
                  : "rgba(59, 130, 246, 0.7)",
              cursor: "ew-resize",
              zIndex: startHandleOnTop ? 1 : 2,
            }}
          >
            {hoveredHandle?.index === i && hoveredHandle?.handle === "end" && (
              <div style={handleTooltipStyle("end")}>
                {formatTime(range.end, zoomDecimals(zoomLevel))}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const renderPoints = () => {
    if (isRangeArray(selections)) return null;
    return selections.map((point, i) => {
      const isActive = i === activeIndex;
      const x = timeToPixel(
        point.time,
        duration,
        width,
        zoomLevel,
        viewportStart,
      );
      const top =
        selectionScope === "track" && point.track !== undefined
          ? point.track * trackHeight
          : 0;
      const pointHeight = selectionScope === "track" ? trackHeight : height;
      return (
        <div
          key={`point-${String(i)}`}
          data-testid={`point-${String(i)}`}
          data-active={isActive}
          onPointerDown={(e) => handlePointPointerDown(e, i)}
          style={{
            position: "absolute",
            left: `${String(x - 5)}px`,
            top: `${String(top)}px`,
            width: 10,
            height: `${String(pointHeight)}px`,
            cursor: "pointer",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 4,
              top: 0,
              width: 2,
              height: "100%",
              background: isActive
                ? "rgba(37, 99, 235, 1)"
                : "rgba(59, 130, 246, 0.8)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: -2,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isActive
                ? "rgba(37, 99, 235, 1)"
                : "rgba(59, 130, 246, 0.9)",
            }}
          />
        </div>
      );
    });
  };

  const renderDragPreview = () => {
    if (!dragPreview) return null;

    // Clamp the preview to free space so it doesn't visually overlap existing
    // ranges — matching the clamping that will happen on commit (pointerup).
    // When multiSelect is false the new range replaces all existing ones, so
    // there's nothing to clamp against.
    const existing = multiSelect && isRangeArray(selections) ? selections : [];
    const clamped = clampToFreeGap(
      dragPreview.startTime,
      dragPreview.endTime,
      dragPreview.track,
      existing,
    );
    if (!clamped) return null; // no free space

    const x1 = timeToPixel(
      clamped.start,
      duration,
      width,
      zoomLevel,
      viewportStart,
    );
    const x2 = timeToPixel(
      clamped.end,
      duration,
      width,
      zoomLevel,
      viewportStart,
    );
    const left = Math.min(x1, x2);
    const previewWidth = Math.abs(x2 - x1);
    const top =
      selectionScope === "track" && dragPreview.track !== undefined
        ? dragPreview.track * trackHeight
        : 0;
    const previewHeight = selectionScope === "track" ? trackHeight : height;
    return (
      <div
        data-testid="range-drag-preview"
        style={{
          position: "absolute",
          left: `${String(left)}px`,
          top: `${String(top)}px`,
          width: `${String(previewWidth)}px`,
          height: `${String(previewHeight)}px`,
          background: "rgba(59, 130, 246, 0.25)",
          border: "1px dashed rgba(59, 130, 246, 0.6)",
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      data-testid="selection-overlay"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={() => {
        // With pointer capture active, this only fires for uncaptured
        // interactions (e.g., hover without mousedown). For captured drags,
        // pointerup/pointercancel handle cleanup instead.
        if (dragRef.current) {
          if (dragRef.current.beganDrag) onEndDrag();
          dragRef.current = null;
          setDragPreview(null);
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        cursor: "crosshair",
        pointerEvents: "auto",
      }}
    >
      {selectionType === "range" ? renderRanges() : renderPoints()}
      {renderDragPreview()}
    </div>
  );
}
