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
  /** Whether this track is muted (drives button visual state). */
  muted: boolean;
  /** Toggle mute — called with the new muted state. */
  onToggleMute: (nextMuted: boolean) => void;
}

const GUTTER_WIDTH = 72;
const MUTE_BUTTON_WIDTH = 22;

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
  muted,
  onToggleMute,
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
        data-testid="track-gutter"
        style={{
          width: `${String(GUTTER_WIDTH)}px`,
          minWidth: `${String(GUTTER_WIDTH)}px`,
          display: "flex",
          alignItems: "center",
          paddingRight: "0.5rem",
          borderRight: "1px solid var(--stagebook-border, #e5e7eb)",
        }}
      >
        <button
          type="button"
          data-testid="track-mute"
          data-muted={muted}
          aria-label={muted ? `Unmute ${label}` : `Mute ${label}`}
          aria-pressed={muted}
          onClick={() => onToggleMute(!muted)}
          style={{
            width: `${String(MUTE_BUTTON_WIDTH)}px`,
            minWidth: `${String(MUTE_BUTTON_WIDTH)}px`,
            height: `${String(MUTE_BUTTON_WIDTH)}px`,
            marginLeft: "0.25rem",
            marginRight: "0.25rem",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "0.25rem",
            cursor: "pointer",
            color: muted
              ? "var(--stagebook-danger, #dc2626)"
              : "var(--stagebook-text-faint, #9ca3af)",
          }}
        >
          {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
        </button>
        <div
          data-testid="track-label"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            fontSize: "0.6875rem",
            color: "var(--stagebook-text-faint, #9ca3af)",
            userSelect: "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
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

function SpeakerIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SpeakerMutedIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

export { GUTTER_WIDTH };
