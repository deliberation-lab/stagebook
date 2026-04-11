import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { usePlayback } from "../playback/PlaybackProvider.js";
import { TimeRuler } from "./timeline/TimeRuler.js";
import { TimelineTrack, GUTTER_WIDTH } from "./timeline/TimelineTrack.js";
import { Playhead } from "./timeline/Playhead.js";
import { SelectionOverlay } from "./timeline/SelectionOverlay.js";
import { computeBucketCount } from "./mediaPlayer/waveformCapture.js";
import {
  initialSelectionState,
  selectionsReducer,
} from "./timeline/selectionsReducer.js";
import { keyToAction } from "./timeline/keyboardActions.js";
import type { PointSelection, RangeSelection } from "./timeline/selections.js";

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
  save,
}: TimelineProps) {
  const handle = usePlayback(source);
  const tracksAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Callback ref: measures the container immediately on attach. Works
  // regardless of mount order — unlike useEffect, a callback ref fires when
  // React attaches the DOM element, even if the component re-renders later
  // (e.g. when the playback handle becomes available).
  const observerRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    setContainerWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  // Zoom & pan state. Setters will be wired up in #49.
  const [zoomLevel] = useState(1);
  const [viewportStart] = useState(0);

  // Selection state via reducer (pure logic in selectionsReducer.ts)
  const [state, dispatch] = useReducer(
    selectionsReducer,
    undefined,
    initialSelectionState,
  );

  // Save selections whenever they change (after the initial mount). Mouse-
  // driven changes save immediately; keyboard-driven changes are debounced
  // ~500ms so holding an arrow key collapses to one save.
  const lastSavedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true by the keyboard handler before dispatching, so the save
  // effect can debounce this particular state change. Reset after the save.
  const debounceNextSaveRef = useRef(false);
  useEffect(() => {
    const serialized = JSON.stringify(state.selections);
    if (lastSavedRef.current === null) {
      lastSavedRef.current = serialized;
      return;
    }
    if (serialized === lastSavedRef.current) return;

    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);

    if (debounceNextSaveRef.current) {
      debounceNextSaveRef.current = false;
      saveTimerRef.current = setTimeout(() => {
        lastSavedRef.current = serialized;
        save(`timeline_${name}`, state.selections);
        saveTimerRef.current = null;
      }, 500);
    } else {
      lastSavedRef.current = serialized;
      save(`timeline_${name}`, state.selections);
    }

    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state.selections, name, save]);

  // Measure container width. Read from getBoundingClientRect on every render
  // via a callback ref, and observe with ResizeObserver for ongoing updates.
  // The callback ref fires synchronously when the element is attached, which
  // gives a usable width on first paint even in test environments where the
  // ResizeObserver callback is delayed.

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

  // Keyboard handler — delegates to keyboardActions.ts for the key-to-action
  // mapping. Returns null when the key should fall through to MediaPlayer.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const currentRange =
      selectionType === "range" && state.activeIndex !== null
        ? ((state.selections as RangeSelection[])[state.activeIndex] ?? null)
        : null;
    const currentPoint =
      selectionType === "point" && state.activeIndex !== null
        ? ((state.selections as PointSelection[])[state.activeIndex] ?? null)
        : null;

    const action = keyToAction(
      {
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
      },
      {
        selectionType,
        activeIndex: state.activeIndex,
        activeHandle: state.activeHandle,
        currentRange,
        currentPoint,
      },
    );
    if (!action) return; // Fall through to MediaPlayer

    e.preventDefault();
    e.stopPropagation();

    switch (action.type) {
      case "adjustHandle":
        debounceNextSaveRef.current = true;
        dispatch({
          type: "ADJUST_HANDLE",
          index: action.index,
          handle: action.handle,
          time: action.time,
        });
        // Sync video to the new handle position so the user sees the frame
        handleRef.current?.seekTo(action.time);
        break;
      case "repositionPoint":
        debounceNextSaveRef.current = true;
        dispatch({
          type: "REPOSITION_POINT",
          index: action.index,
          time: action.time,
        });
        handleRef.current?.seekTo(action.time);
        break;
      case "switchHandle":
        dispatch({ type: "SET_ACTIVE_HANDLE", handle: action.handle });
        break;
      case "delete":
        dispatch({ type: "DELETE" });
        break;
      case "deselect":
        dispatch({ type: "DESELECT" });
        break;
      case "undo":
        dispatch({ type: "UNDO" });
        break;
    }
  };

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
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        border: "1px solid var(--score-border, #e5e7eb)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        outline: "none",
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

      {/* Tracks + selection overlay + playhead */}
      <div ref={tracksAreaRef} style={{ position: "relative" }}>
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

        {/* Selection overlay — positioned over the waveform area, offset by gutter */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${String(GUTTER_WIDTH)}px`,
            width: `${String(waveformWidth)}px`,
            height: `${String(tracksHeight)}px`,
          }}
        >
          <SelectionOverlay
            width={waveformWidth}
            height={tracksHeight}
            duration={duration}
            zoomLevel={zoomLevel}
            viewportStart={viewportStart}
            selectionType={selectionType}
            selectionScope={selectionScope}
            channelCount={channelCount}
            selections={state.selections}
            activeIndex={state.activeIndex}
            activeHandle={state.activeHandle}
            onSeek={(t) => handle.seekTo(t)}
            onCreateRange={(start, end, track) =>
              dispatch({
                type: "CREATE_RANGE",
                start,
                end,
                track,
                multiSelect,
              })
            }
            onCreatePoint={(time, track) =>
              dispatch({
                type: "CREATE_POINT",
                time,
                track,
                multiSelect,
              })
            }
            onAdjustHandle={(index, h, time) =>
              dispatch({ type: "ADJUST_HANDLE", index, handle: h, time })
            }
            onRepositionPoint={(index, time) =>
              dispatch({ type: "REPOSITION_POINT", index, time })
            }
            onSelect={(index) => dispatch({ type: "SELECT", index })}
            onDeselect={() => dispatch({ type: "DESELECT" })}
            onSetActiveHandle={(h) =>
              dispatch({ type: "SET_ACTIVE_HANDLE", handle: h })
            }
          />

          {/* Playhead — over selection overlay */}
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
