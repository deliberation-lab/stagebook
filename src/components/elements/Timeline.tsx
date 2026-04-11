import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePlayback } from "../playback/PlaybackProvider.js";
import { TimeRuler } from "./timeline/TimeRuler.js";
import { TimelineTrack, GUTTER_WIDTH } from "./timeline/TimelineTrack.js";
import { Playhead } from "./timeline/Playhead.js";
import { computeBucketCount } from "./mediaPlayer/waveformCapture.js";

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

const TRACK_HEIGHT = 48;
const BUCKETS_PER_SECOND = 10;

export function Timeline({
  source,
  name,
  selectionType,
  selectionScope = "all",
  multiSelect = false,
  showWaveform = true,
  trackLabels,
  save: _save,
}: TimelineProps) {
  const handle = usePlayback(source);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Zoom & pan state. Setters will be wired up in the next subissue.
  const [zoomLevel] = useState(1);
  const [viewportStart] = useState(0);

  // Measure container width via ResizeObserver. Only update state when the
  // width actually changes — otherwise layout-driven re-renders from this
  // observer race with React's render loop in CT tests.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastWidth = -1;
    function update(width: number) {
      if (width === lastWidth) return;
      lastWidth = width;
      setContainerWidth(width);
    }
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        update(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep a ref to the handle so effects don't re-run when its identity changes
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Request waveform capture and capture an initial currentTime on mount.
  useEffect(() => {
    const h = handleRef.current;
    if (!h) return;
    if (showWaveform) {
      h.requestWaveformCapture();
    }
    setCurrentTime(h.getCurrentTime());
  }, [showWaveform]);

  // Poll currentTime via RAF for smooth playhead movement during playback.
  useEffect(() => {
    let cancelled = false;
    let lastValue = -1;
    let rafId = 0;

    function tick() {
      if (cancelled) return;
      const h = handleRef.current;
      if (h) {
        const t = h.getCurrentTime();
        if (t !== lastValue) {
          lastValue = t;
          setCurrentTime(t);
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, []);

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

  const duration = handle.getDuration();
  const channelCount = handle.channelCount || 1;
  const peaks = handle.peaks;
  const waveformWidth = Math.max(containerWidth - GUTTER_WIDTH, 0);
  const totalBuckets = computeBucketCount(duration, BUCKETS_PER_SECOND);

  // Compute visible bucket range from zoom/viewport
  const visibleDuration = duration > 0 ? duration / zoomLevel : 0;
  const startBucket = Math.floor(viewportStart * BUCKETS_PER_SECOND);
  const endBucket = Math.min(
    Math.ceil((viewportStart + visibleDuration) * BUCKETS_PER_SECOND),
    totalBuckets,
  );

  // Build track labels
  const labels: string[] = [];
  for (let i = 0; i < channelCount; i++) {
    labels.push(trackLabels?.[i] ?? `Position ${String(i)}`);
  }

  const tracksHeight = channelCount * TRACK_HEIGHT;

  return (
    <div
      ref={containerRef}
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
        overflow: "hidden",
      }}
    >
      {/* Time ruler — offset by gutter width */}
      <div style={{ marginLeft: `${String(GUTTER_WIDTH)}px` }}>
        <TimeRuler
          duration={duration}
          width={waveformWidth}
          zoomLevel={zoomLevel}
          viewportStart={viewportStart}
        />
      </div>

      {/* Tracks + playhead */}
      <div style={{ position: "relative" }}>
        {labels.map((label, i) => (
          <TimelineTrack
            key={i}
            label={label}
            peaks={peaks[i] ?? null}
            waveformWidth={waveformWidth}
            height={TRACK_HEIGHT}
            startBucket={startBucket}
            endBucket={endBucket}
          />
        ))}

        {/* Playhead — positioned over the waveform area, offset by gutter */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${String(GUTTER_WIDTH)}px`,
            width: `${String(waveformWidth)}px`,
            height: `${String(tracksHeight)}px`,
            pointerEvents: "none",
          }}
        >
          <Playhead
            currentTime={currentTime}
            duration={duration}
            width={waveformWidth}
            height={tracksHeight}
            zoomLevel={zoomLevel}
            viewportStart={viewportStart}
          />
        </div>
      </div>
    </div>
  );
}
