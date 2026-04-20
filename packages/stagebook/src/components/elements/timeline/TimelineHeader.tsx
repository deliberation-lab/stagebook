import React from "react";
import { MIN_ZOOM, MAX_ZOOM } from "./viewport.js";
import { GUTTER_WIDTH } from "./TimelineTrack.js";

export interface TimelineHeaderProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /**
   * The minimap is rendered here (as children) when the timeline is zoomed
   * in — so the zoom controls sit right next to the minimap for visual
   * context (issue #129). When zoomLevel === 1 the parent passes null and
   * the header shows only the zoom controls.
   */
  minimap?: React.ReactNode;
}

const buttonStyle: React.CSSProperties = {
  width: "24px",
  height: "24px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid var(--stagebook-border, #e5e7eb)",
  borderRadius: "0.25rem",
  background: "var(--stagebook-bg, #ffffff)",
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

export function TimelineHeader({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  minimap,
}: TimelineHeaderProps) {
  return (
    <div
      data-testid="timeline-header"
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: "1px solid var(--stagebook-border, #e5e7eb)",
        userSelect: "none",
      }}
    >
      {/* Gutter-width zoom controls — align with the per-track labels below */}
      <div
        style={{
          width: `${String(GUTTER_WIDTH)}px`,
          minWidth: `${String(GUTTER_WIDTH)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
          padding: "0.25rem",
          boxSizing: "border-box",
        }}
      >
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
      {/* Minimap sits alongside the zoom controls so participants see which
          region they're zooming relative to. Null when zoomLevel === 1. */}
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>{minimap}</div>
    </div>
  );
}
