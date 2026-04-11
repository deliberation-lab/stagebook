import React from "react";
import { formatTime } from "../../../utils/formatTime.js";
import type { TimelineValue } from "./selections.js";
import { MIN_ZOOM, MAX_ZOOM } from "./viewport.js";

export interface TimelineFooterProps {
  selectionType: "range" | "point";
  selections: TimelineValue;
  activeIndex: number | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onHelpToggle: () => void;
  helpOpen: boolean;
}

function isRangeArray(
  s: TimelineValue,
): s is { start: number; end: number; track?: number }[] {
  return s.length === 0 || "start" in (s[0] as object);
}

function summary(
  selectionType: "range" | "point",
  selections: TimelineValue,
  activeIndex: number | null,
): string {
  const count = selections.length;
  // Active selection time readout takes precedence
  if (activeIndex !== null) {
    const item = selections[activeIndex];
    if (item) {
      if (isRangeArray(selections)) {
        const r = selections[activeIndex];
        if (r) return `${formatTime(r.start)} – ${formatTime(r.end)}`;
      } else {
        const p = (selections as { time: number }[])[activeIndex];
        if (p) return formatTime(p.time);
      }
    }
  }
  if (selectionType === "range") {
    if (count === 0) return "0 ranges selected";
    if (count === 1) return "1 range selected";
    return `${String(count)} ranges selected`;
  }
  if (count === 0) return "0 points marked";
  if (count === 1) return "1 point marked";
  return `${String(count)} points marked`;
}

const buttonStyle: React.CSSProperties = {
  width: "24px",
  height: "24px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--score-border, #e5e7eb)",
  borderRadius: "0.25rem",
  background: "var(--score-bg, #ffffff)",
  cursor: "pointer",
  fontSize: "0.875rem",
  lineHeight: 1,
  padding: 0,
  color: "inherit",
};

const disabledStyle: React.CSSProperties = {
  ...buttonStyle,
  cursor: "not-allowed",
  opacity: 0.4,
};

export function TimelineFooter({
  selectionType,
  selections,
  activeIndex,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onHelpToggle,
  helpOpen,
}: TimelineFooterProps) {
  return (
    <div
      data-testid="timeline-footer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.25rem 0.5rem",
        borderTop: "1px solid var(--score-border, #e5e7eb)",
        fontSize: "0.75rem",
        color: "var(--score-muted, #6b7280)",
        userSelect: "none",
      }}
    >
      {/* Left: zoom controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <button
          type="button"
          data-testid="timeline-zoom-out"
          onClick={onZoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          aria-label="Zoom out"
          style={zoomLevel <= MIN_ZOOM ? disabledStyle : buttonStyle}
        >
          −
        </button>
        <button
          type="button"
          data-testid="timeline-zoom-in"
          onClick={onZoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          aria-label="Zoom in"
          style={zoomLevel >= MAX_ZOOM ? disabledStyle : buttonStyle}
        >
          +
        </button>
      </div>

      {/* Center: selection summary */}
      <div data-testid="timeline-selection-summary">
        {summary(selectionType, selections, activeIndex)}
      </div>

      {/* Right: help */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          data-testid="timeline-help-button"
          onClick={onHelpToggle}
          aria-label="Show keyboard shortcuts"
          aria-pressed={helpOpen}
          style={buttonStyle}
        >
          ?
        </button>
      </div>
    </div>
  );
}
