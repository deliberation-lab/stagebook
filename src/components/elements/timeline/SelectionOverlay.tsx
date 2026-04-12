import React, { useCallback, useRef, useState } from "react";
import { pixelToTime, timeToPixel } from "./timelineLayout.js";
import type { RangeSelection, TimelineValue } from "./selections.js";

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
}: SelectionOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Live drag preview for "create-range" before mouseup commits the range
  const [dragPreview, setDragPreview] = useState<{
    startTime: number;
    endTime: number;
    track: number | undefined;
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
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
    [eventToTime, eventToTrack],
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

      const currentTime = eventToTime(e.clientX);

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
      onAdjustHandle,
      onRepositionPoint,
      onBeginDrag,
      selectionType,
    ],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const time = eventToTime(e.clientX);
      const track = drag.track;

      if (!drag.isDragging) {
        if (selectionType === "point") {
          onCreatePoint(time, track);
          onSeek(time);
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
        }
        setDragPreview(null);
      }

      // Release the save defer for adjust-handle / reposition-point drags
      if (drag.beganDrag) {
        onEndDrag();
      }
      dragRef.current = null;
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
    ],
  );

  const handleRangeBodyPointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.stopPropagation();
      onSelect(index);
      dragRef.current = null;
    },
    [onSelect],
  );

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, index: number, handle: "start" | "end") => {
      e.stopPropagation();
      if (e.button !== 0) return;
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
            onPointerDown={(e) => handleHandlePointerDown(e, i, "start")}
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
            }}
          />
          {/* End handle */}
          <div
            data-testid={`range-${String(i)}-handle-end`}
            data-active={isActive && activeHandle === "end"}
            onPointerDown={(e) => handleHandlePointerDown(e, i, "end")}
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
            }}
          />
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
    const x1 = timeToPixel(
      dragPreview.startTime,
      duration,
      width,
      zoomLevel,
      viewportStart,
    );
    const x2 = timeToPixel(
      dragPreview.endTime,
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
      onPointerLeave={() => {
        if (dragRef.current) {
          // If a transaction was open (we'd already pushed BEGIN_DRAG),
          // close it so the save effect doesn't stay paused.
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
