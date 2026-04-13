import React from "react";
import { formatTime } from "../../../utils/formatTime.js";
import {
  timeToPixel,
  computeTickInterval,
  generateTicks,
} from "./timelineLayout.js";

export interface TimeRulerProps {
  /** Total media duration in seconds. */
  duration: number;
  /** Width of the ruler area in pixels. */
  width: number;
  /** Current zoom level (1 = full duration visible). */
  zoomLevel: number;
  /** Left edge of the visible region in seconds. */
  viewportStart: number;
}

const RULER_HEIGHT = 24;

/**
 * Time labels and tick marks along the top of the waveform area.
 * Tick density adapts to zoom level.
 */
export function TimeRuler({
  duration,
  width,
  zoomLevel,
  viewportStart,
}: TimeRulerProps) {
  if (!Number.isFinite(duration) || duration <= 0 || width <= 0) {
    return (
      <div
        data-testid="time-ruler"
        style={{ height: `${String(RULER_HEIGHT)}px` }}
      />
    );
  }

  const visibleDuration = duration / zoomLevel;
  const visibleEnd = viewportStart + visibleDuration;
  const pixelsPerSecond = width / visibleDuration;
  const interval = computeTickInterval(pixelsPerSecond);
  const ticks = generateTicks(viewportStart, visibleEnd, interval);

  return (
    <div
      data-testid="time-ruler"
      style={{
        position: "relative",
        height: `${String(RULER_HEIGHT)}px`,
        width: `${String(width)}px`,
        overflow: "hidden",
        fontSize: "0.625rem",
        color: "var(--stagebook-muted, #9ca3af)",
        userSelect: "none",
      }}
    >
      {ticks.map((t) => {
        const x = timeToPixel(t, duration, width, zoomLevel, viewportStart);
        if (x < -50 || x > width + 50) return null;
        return (
          <div
            key={t}
            style={{
              position: "absolute",
              left: `${String(x)}px`,
              top: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                transform: "translateX(-50%)",
                display: "block",
              }}
            >
              {formatTime(t)}
            </span>
            <div
              style={{
                width: "1px",
                height: "6px",
                background: "currentColor",
                opacity: 0.5,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
