import React from "react";
import { timeToPixel } from "./timelineLayout.js";

export interface PlayheadProps {
  /** Current playback time in seconds. */
  currentTime: number;
  /** Total media duration in seconds. */
  duration: number;
  /** Width of the waveform area in pixels. */
  width: number;
  /** Height to span (all tracks). */
  height: number;
  /** Current zoom level (1 = full duration visible). */
  zoomLevel: number;
  /** Left edge of the visible region in seconds. */
  viewportStart: number;
}

/**
 * Thin vertical line tracking the current playback position.
 * Absolutely positioned over the waveform area.
 */
export function Playhead({
  currentTime,
  duration,
  width,
  height,
  zoomLevel,
  viewportStart,
}: PlayheadProps) {
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const x = timeToPixel(currentTime, duration, width, zoomLevel, viewportStart);

  // Don't render if off-screen
  if (x < -1 || x > width + 1) return null;

  return (
    <div
      data-testid="playhead"
      style={{
        position: "absolute",
        left: `${String(x)}px`,
        top: 0,
        width: "2px",
        height: `${String(height)}px`,
        background: "var(--score-primary, #3b82f6)",
        pointerEvents: "none",
        zIndex: 10,
        transform: "translateX(-1px)",
      }}
    />
  );
}
