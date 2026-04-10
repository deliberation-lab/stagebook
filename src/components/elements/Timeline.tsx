import React from "react";
import { usePlayback } from "../playback/PlaybackProvider.js";

export interface TimelineProps {
  source: string;
  name: string;
  selectionType: "range" | "point";
  selectionScope?: "track" | "all";
  multiSelect?: boolean;
  showWaveform?: boolean;
  trackLabels?: string[];
  save: (key: string, value: unknown) => void;
}

export function Timeline({
  source,
  name,
  selectionType,
  selectionScope = "all",
  multiSelect = false,
  showWaveform = true,
  trackLabels: _trackLabels,
  save: _save,
}: TimelineProps) {
  const handle = usePlayback(source);

  if (!handle) {
    return (
      <p
        data-testid="timeline-error"
        style={{
          color: "var(--score-danger, #dc2626)",
          fontSize: "0.875rem",
        }}
      >
        Timeline: no media player found with name &quot;{source}&quot;
      </p>
    );
  }

  return (
    <div
      data-testid="timeline"
      data-source={source}
      data-name={name}
      data-selection-type={selectionType}
      data-selection-scope={selectionScope}
      data-multi-select={multiSelect}
      data-show-waveform={showWaveform}
      role="region"
      aria-label={`Timeline: ${name}`}
      style={{
        border: "1px solid var(--score-border, #e5e7eb)",
        borderRadius: "0.5rem",
        padding: "0.5rem",
        minHeight: "4rem",
      }}
    >
      {/* Placeholder — visual components added in subissues #46–#49 */}
    </div>
  );
}
