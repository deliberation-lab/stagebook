import React, { useCallback, useRef } from "react";
import type { TimelineValue } from "./selections.js";
import { clampViewportStart } from "./viewport.js";

export interface MinimapProps {
  /** Total media duration in seconds. */
  duration: number;
  /** Width of the minimap area in pixels. */
  width: number;
  /** Current zoom level (1 = full visible). */
  zoomLevel: number;
  /** Current viewport start in seconds. */
  viewportStart: number;
  /** Current playhead position in seconds. */
  currentTime: number;
  /** All current selections — drawn as small marks on the minimap. */
  selections: TimelineValue;
  /** Called with new viewport start (seconds) when the user pans. */
  onViewportChange: (newStart: number) => void;
}

const HEIGHT = 32;
const VIEWPORT_RECT_BORDER = "1.5px solid rgba(59, 130, 246, 0.9)";

function isRangeArray(
  s: TimelineValue,
): s is { start: number; end: number; track?: number }[] {
  return s.length === 0 || "start" in (s[0] as object);
}

interface DragState {
  pointerId: number;
  /** Offset in seconds between pointerdown time and viewportStart. */
  offset: number;
}

export function Minimap({
  duration,
  width,
  zoomLevel,
  viewportStart,
  currentTime,
  selections,
  onViewportChange,
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const visibleDuration = duration > 0 ? duration / zoomLevel : 0;

  const eventToTime = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || duration <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const localX = clientX - rect.left;
      const t = (localX / rect.width) * duration;
      return Math.max(0, Math.min(duration, t));
    },
    [duration],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const time = eventToTime(e.clientX);
      const viewportEnd = viewportStart + visibleDuration;

      // If clicking inside the viewport rectangle, drag-pan it (preserve offset)
      // Otherwise, click to center the viewport on that point
      let offset: number;
      if (time >= viewportStart && time <= viewportEnd) {
        offset = time - viewportStart;
      } else {
        // Click to center viewport — apply immediately
        const newStart = clampViewportStart(
          time - visibleDuration / 2,
          duration,
          zoomLevel,
        );
        onViewportChange(newStart);
        offset = visibleDuration / 2;
      }

      dragRef.current = { pointerId: e.pointerId, offset };
      // Pointer capture lets us track drag outside the element. In tests
      // (Playwright dispatchEvent), the pointerId may not be a real OS
      // pointer, so we silently ignore failures.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [
      eventToTime,
      viewportStart,
      visibleDuration,
      duration,
      zoomLevel,
      onViewportChange,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const time = eventToTime(e.clientX);
      const newStart = clampViewportStart(
        time - drag.offset,
        duration,
        zoomLevel,
      );
      onViewportChange(newStart);
    },
    [eventToTime, duration, zoomLevel, onViewportChange],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  const timeToX = useCallback(
    (t: number) => (duration > 0 ? (t / duration) * width : 0),
    [duration, width],
  );

  // Selection marks
  const selectionMarks: React.ReactElement[] = [];
  if (isRangeArray(selections)) {
    selections.forEach((r, i) => {
      const x1 = timeToX(r.start);
      const x2 = timeToX(r.end);
      selectionMarks.push(
        <div
          key={`r-${String(i)}`}
          style={{
            position: "absolute",
            left: `${String(x1)}px`,
            top: 4,
            width: `${String(Math.max(x2 - x1, 1))}px`,
            height: HEIGHT - 8,
            background: "rgba(59, 130, 246, 0.4)",
            borderRadius: "1px",
            pointerEvents: "none",
          }}
        />,
      );
    });
  } else {
    (selections as { time: number }[]).forEach((p, i) => {
      const x = timeToX(p.time);
      selectionMarks.push(
        <div
          key={`p-${String(i)}`}
          style={{
            position: "absolute",
            left: `${String(x - 1)}px`,
            top: 4,
            width: 2,
            height: HEIGHT - 8,
            background: "rgba(59, 130, 246, 0.7)",
            pointerEvents: "none",
          }}
        />,
      );
    });
  }

  // Viewport rectangle position
  const viewportLeft = timeToX(viewportStart);
  const viewportWidth = Math.max(timeToX(visibleDuration), 8);

  // Playhead
  const playheadX = timeToX(currentTime);

  return (
    <div
      ref={containerRef}
      data-testid="timeline-minimap"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "relative",
        height: `${String(HEIGHT)}px`,
        width: `${String(width)}px`,
        background: "var(--score-bg-muted, #f9fafb)",
        borderBottom: "1px solid var(--score-border, #e5e7eb)",
        cursor: "pointer",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {selectionMarks}
      {/* Playhead line */}
      {currentTime >= 0 && currentTime <= duration && (
        <div
          data-testid="minimap-playhead"
          style={{
            position: "absolute",
            left: `${String(playheadX - 0.5)}px`,
            top: 0,
            width: "1px",
            height: "100%",
            background: "rgba(37, 99, 235, 0.8)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Viewport rectangle */}
      <div
        data-testid="minimap-viewport"
        style={{
          position: "absolute",
          left: `${String(viewportLeft)}px`,
          top: 0,
          width: `${String(viewportWidth)}px`,
          height: "100%",
          border: VIEWPORT_RECT_BORDER,
          boxSizing: "border-box",
          background: "rgba(59, 130, 246, 0.06)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
