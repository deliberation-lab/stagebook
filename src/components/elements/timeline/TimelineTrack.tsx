import React from "react";
import { WaveformRenderer } from "./WaveformRenderer.js";

export interface TimelineTrackProps {
  /** Label shown in the gutter (from trackLabels or "Position N"). */
  label: string;
  /** Interleaved min/max peaks for this channel. */
  peaks: Float32Array | null;
  /**
   * Render token: bumps when peaks are mutated in place. Forces the
   * WaveformRenderer to redraw despite a stable array reference.
   */
  peaksVersion: number;
  /** Width of the waveform area in pixels (excludes gutter). */
  waveformWidth: number;
  /** Height of this track in pixels. */
  height: number;
  /** First visible bucket index. */
  startBucket: number;
  /** Last visible bucket index (exclusive). */
  endBucket: number;
}

const GUTTER_WIDTH = 72;

/**
 * One row in the timeline: a fixed-width gutter label + a WaveformRenderer.
 */
export function TimelineTrack({
  label,
  peaks,
  peaksVersion,
  waveformWidth,
  height,
  startBucket,
  endBucket,
}: TimelineTrackProps) {
  return (
    <div
      data-testid="timeline-track"
      style={{
        display: "flex",
        alignItems: "stretch",
        height: `${String(height)}px`,
      }}
    >
      <div
        data-testid="track-label"
        style={{
          width: `${String(GUTTER_WIDTH)}px`,
          minWidth: `${String(GUTTER_WIDTH)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: "0.5rem",
          fontSize: "0.6875rem",
          color: "var(--score-muted, #9ca3af)",
          userSelect: "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          borderRight: "1px solid var(--score-border, #e5e7eb)",
        }}
      >
        {label}
      </div>
      <WaveformRenderer
        peaks={peaks}
        peaksVersion={peaksVersion}
        width={waveformWidth}
        height={height}
        startBucket={startBucket}
        endBucket={endBucket}
      />
    </div>
  );
}

export { GUTTER_WIDTH };
