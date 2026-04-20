/**
 * Shared constants and styles for timeline tooltip boxes (playhead time
 * box and handle hover tooltips). Kept in one place so they don't drift.
 */
import type React from "react";

/**
 * Select fractional-second precision based on zoom level.
 * At zoom 1 (full duration visible) show tenths; at 2× or above show
 * hundredths — more zoom reveals more precision.
 *
 * @param zoomLevel - Current zoom level (1 = full duration visible).
 * @returns Number of fractional digits: 1 or 2.
 */
export function zoomDecimals(zoomLevel: number): 0 | 1 | 2 {
  if (zoomLevel >= 2) return 2;
  return 1;
}

/** Monospace font stack used by all timeline time displays. */
const TIMELINE_MONO_FONT =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

/** Base styles shared between the playhead time box and handle tooltips. */
export const tooltipBaseStyle: React.CSSProperties = {
  fontSize: "0.65rem",
  fontFamily: TIMELINE_MONO_FONT,
  padding: "1px 4px",
  borderRadius: "2px",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
  pointerEvents: "none",
  color: "white",
};

/**
 * Compute inline styles for a range-handle hover tooltip.
 * Positions the tooltip to the left of the start handle or to the
 * right of the end handle, vertically centered.
 *
 * @param handle - Which handle the tooltip is attached to.
 */
export function handleTooltipStyle(
  handle: "start" | "end",
): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    ...(handle === "start"
      ? { right: "100%", marginRight: 4 }
      : { left: "100%", marginLeft: 4 }),
    transform: "translateY(-50%)",
    background: "rgba(30, 64, 175, 0.9)",
    zIndex: 5,
    ...tooltipBaseStyle,
  };
}
