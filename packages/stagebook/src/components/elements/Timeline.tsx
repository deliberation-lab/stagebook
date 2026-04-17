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
import { TimelineFooter } from "./timeline/TimelineFooter.js";
import { Minimap } from "./timeline/Minimap.js";
import { HelpPopover } from "./timeline/HelpPopover.js";
import { computeBucketCount } from "./mediaPlayer/waveformCapture.js";
import {
  initialSelectionState,
  selectionsReducer,
} from "./timeline/selectionsReducer.js";
import { keyToAction } from "./timeline/keyboardActions.js";
import type { PointSelection, RangeSelection } from "./timeline/selections.js";
import {
  AUTO_SCROLL_THRESHOLD,
  SEEK_JUMP_THRESHOLD,
  clampViewportStart,
  computeViewportAfterScroll,
  computeViewportAfterSeek,
  computeViewportAfterZoom,
  isPlayheadPastThreshold,
  zoomIn as nextZoomIn,
  zoomOut as nextZoomOut,
} from "./timeline/viewport.js";

export interface TimelineProps {
  source: string;
  name: string;
  selectionType: "range" | "point";
  selectionScope?: "track" | "all";
  multiSelect?: boolean;
  showWaveform?: boolean;
  trackLabels?: string[];
  /**
   * Previously saved selections to restore on mount. Element.tsx resolves
   * this from `timeline.<name>` so participants who reload the stage see
   * their existing marks. Untrusted shape — validated before use.
   */
  initialSelections?: unknown;
  save: (key: string, value: unknown) => void;
}

const TRACK_HEIGHT = 48;
const BUCKETS_PER_SECOND = 10;

/**
 * Validate restored selections from saved state. Returns an empty array if
 * the input is malformed — better to start fresh than to crash on a bad save.
 */
function validateSavedSelections(
  raw: unknown,
  selectionType: "range" | "point",
): RangeSelection[] | PointSelection[] {
  if (!Array.isArray(raw)) return [];
  if (selectionType === "range") {
    const valid: RangeSelection[] = [];
    for (const item of raw) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { start?: unknown }).start === "number" &&
        typeof (item as { end?: unknown }).end === "number" &&
        Number.isFinite((item as { start: number }).start) &&
        Number.isFinite((item as { end: number }).end)
      ) {
        const r: RangeSelection = {
          start: (item as { start: number }).start,
          end: (item as { end: number }).end,
        };
        const t = (item as { track?: unknown }).track;
        if (typeof t === "number" && Number.isFinite(t)) r.track = t;
        valid.push(r);
      }
    }
    return valid;
  }
  const valid: PointSelection[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as { time?: unknown }).time === "number" &&
      Number.isFinite((item as { time: number }).time)
    ) {
      const p: PointSelection = { time: (item as { time: number }).time };
      const t = (item as { track?: unknown }).track;
      if (typeof t === "number" && Number.isFinite(t)) p.track = t;
      valid.push(p);
    }
  }
  return valid;
}

export function Timeline({
  source,
  name,
  selectionType,
  selectionScope = "all",
  multiSelect = false,
  showWaveform = true,
  trackLabels,
  initialSelections,
  save,
}: TimelineProps) {
  const handle = usePlayback(source);
  const tracksAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Ref `save` so the save-on-change effect below doesn't re-run (and
  // potentially double-save) whenever the parent passes a fresh callback
  // identity (#105).
  const saveRef = useRef(save);
  saveRef.current = save;

  // Callback ref: measures the container immediately on attach. Works
  // regardless of mount order — unlike useEffect, a callback ref fires when
  // React attaches the DOM element, even if the component re-renders later
  // (e.g. when the playback handle becomes available).
  // Also stores the element in containerElRef so we can call .focus() later.
  const observerRef = useRef<ResizeObserver | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerElRef.current = el;
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

  // Zoom & pan state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // Per-track mute state. Ephemeral (not persisted, not saved) — a
  // listening aid only. Default: all tracks unmuted. Starts empty and
  // grows lazily as tracks are toggled. Kept as local state solely to
  // trigger re-renders; the source of truth for `muted` is the handle.
  const [, setMuteTick] = useState(0);

  // Track whether the playhead changes are "natural playback" (RAF tick)
  // versus "external seek" (someone called handle.seekTo() out of band).
  // Auto-scroll uses the former; snap-on-seek uses the latter.
  const lastPlayheadRef = useRef(0);
  const lastTickWasPlayingRef = useRef(false);

  // Selection state via reducer. Lazy initializer hydrates from saved state
  // when present so participants who reload mid-stage see their existing
  // selections (validated to drop malformed items).
  const [state, dispatch] = useReducer(selectionsReducer, undefined, () => {
    const base = initialSelectionState();
    if (initialSelections === undefined) return base;
    return {
      ...base,
      selections: validateSavedSelections(initialSelections, selectionType),
    };
  });

  // Drag transaction state — set true between BEGIN_DRAG (first pointermove
  // past the dead zone) and pointerup/leave. While true, the save effect
  // skips so we don't spam the server with one save per pixel of motion.
  const [isDragging, setIsDragging] = useState(false);

  // Save selections whenever they change (after the initial mount). Mouse-
  // driven changes save immediately on commit (drag end / click); keyboard
  // adjustments are debounced ~500ms so holding an arrow key collapses to
  // one save; mid-drag pointermove dispatches are deferred until the drag
  // ends to avoid server spam.
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
    // While a pointer drag is in progress, defer — the save will fire when
    // isDragging transitions back to false (this same effect re-runs).
    if (isDragging) return;

    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);

    if (debounceNextSaveRef.current) {
      debounceNextSaveRef.current = false;
      saveTimerRef.current = setTimeout(() => {
        lastSavedRef.current = serialized;
        saveRef.current(`timeline_${name}`, state.selections);
        saveTimerRef.current = null;
      }, 500);
    } else {
      lastSavedRef.current = serialized;
      saveRef.current(`timeline_${name}`, state.selections);
    }

    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [state.selections, isDragging, name]);

  // Measure container width. Read from getBoundingClientRect on every render
  // via a callback ref, and observe with ResizeObserver for ongoing updates.
  // The callback ref fires synchronously when the element is attached, which
  // gives a usable width on first paint even in test environments where the
  // ResizeObserver callback is delayed.

  // Keep a ref to the handle so other effects can read the current handle
  // without re-running when its identity changes.
  const handleRef = useRef(handle);
  handleRef.current = handle;

  // Request waveform capture once the handle becomes available. We depend
  // on `handle` (not just on `showWaveform`) so the effect re-runs when the
  // handle transitions from undefined to defined — important when MediaPlayer
  // and Timeline mount in the same render but the handle is registered in a
  // post-render effect from MockPlayer / MediaPlayer.
  useEffect(() => {
    if (!handle) return;
    if (showWaveform) {
      handle.requestWaveformCapture();
    }
    setCurrentTime(handle.getCurrentTime());
  }, [handle, showWaveform]);

  // Poll currentTime + peaksVersion + isPaused via RAF. peaksVersion is the
  // render token for the waveform — peaks are mutated in place by the
  // capture loop, so React never sees the array reference change. Polling
  // the version and storing it in state lets the WaveformRenderer effect
  // re-run when new data arrives.
  const [isPaused, setIsPaused] = useState(true);
  const [peaksVersion, setPeaksVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let lastValue = -1;
    let lastPaused: boolean | null = null;
    let lastPeaksVersion = -1;
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
        const paused = h.isPaused();
        if (paused !== lastPaused) {
          lastPaused = paused;
          setIsPaused(paused);
        }
        const v = h.peaksVersion;
        if (v !== lastPeaksVersion) {
          lastPeaksVersion = v;
          setPeaksVersion(v);
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

  // Viewport scrolling effect: keeps the playhead within view as it moves.
  // - During playback: when playhead crosses 90%, scroll smoothly
  // - On seek/scrub (large playhead delta): snap so playhead is at ~25%
  //
  // Only triggered by playhead motion, not by viewport changes — otherwise
  // a manual pan via the minimap would immediately get undone (the playhead
  // would suddenly look "off-screen" relative to the new viewport).
  useEffect(() => {
    if (zoomLevel <= 1) return;
    const duration = handleRef.current?.getDuration() ?? 0;
    if (duration <= 0) return;

    const visibleDuration = duration / zoomLevel;
    const lastT = lastPlayheadRef.current;
    lastPlayheadRef.current = currentTime;
    lastTickWasPlayingRef.current = !isPaused;

    // No motion → nothing to do
    if (currentTime === lastT) return;

    // Detect "jump" — large delta or transition to/from playing means
    // the user seeked rather than naturally played through
    const delta = currentTime - lastT;
    const isJump = Math.abs(delta) > SEEK_JUMP_THRESHOLD;

    if (isJump) {
      // Snap viewport so the playhead is ~25% from the left
      const newStart = computeViewportAfterSeek(
        currentTime,
        visibleDuration,
        duration,
      );
      setViewportStart(newStart);
      return;
    }

    // Continuous playback: auto-scroll when playhead crosses 90%
    if (
      isPlayheadPastThreshold(
        currentTime,
        viewportStart,
        visibleDuration,
        AUTO_SCROLL_THRESHOLD,
      )
    ) {
      const newStart = computeViewportAfterScroll(
        currentTime,
        visibleDuration,
        duration,
      );
      if (newStart !== viewportStart) setViewportStart(newStart);
    }
  }, [currentTime, isPaused, zoomLevel, viewportStart]);

  // Zoom handlers
  const onZoomIn = useCallback(() => {
    const duration = handleRef.current?.getDuration() ?? 0;
    if (duration <= 0) return;
    const newZoom = nextZoomIn(zoomLevel);
    if (newZoom === zoomLevel) return;
    setZoomLevel(newZoom);
    setViewportStart(
      computeViewportAfterZoom({
        currentZoom: zoomLevel,
        newZoom,
        duration,
        currentViewportStart: viewportStart,
        playheadTime: currentTime,
      }),
    );
  }, [zoomLevel, viewportStart, currentTime]);

  const onZoomOut = useCallback(() => {
    const duration = handleRef.current?.getDuration() ?? 0;
    if (duration <= 0) return;
    const newZoom = nextZoomOut(zoomLevel);
    if (newZoom === zoomLevel) return;
    setZoomLevel(newZoom);
    setViewportStart(
      computeViewportAfterZoom({
        currentZoom: zoomLevel,
        newZoom,
        duration,
        currentViewportStart: viewportStart,
        playheadTime: currentTime,
      }),
    );
  }, [zoomLevel, viewportStart, currentTime]);

  const onMinimapPan = useCallback(
    (newStart: number) => {
      const duration = handleRef.current?.getDuration() ?? 0;
      setViewportStart(clampViewportStart(newStart, duration, zoomLevel));
    },
    [zoomLevel],
  );

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

    // Clamp time to [0, duration] before dispatch + seek so a keyboard
    // adjustment can never push a selection past the media bounds.
    const dur = handleRef.current?.getDuration() ?? 0;
    const clampToMedia = (t: number): number => {
      if (Number.isFinite(dur) && dur > 0) {
        return Math.max(0, Math.min(t, dur));
      }
      return Math.max(0, t);
    };

    switch (action.type) {
      case "adjustHandle": {
        const t = clampToMedia(action.time);
        debounceNextSaveRef.current = true;
        dispatch({
          type: "ADJUST_HANDLE",
          index: action.index,
          handle: action.handle,
          time: t,
        });
        // Sync video to the new handle position so the user sees the frame
        handleRef.current?.seekTo(t);
        break;
      }
      case "repositionPoint": {
        const t = clampToMedia(action.time);
        debounceNextSaveRef.current = true;
        dispatch({
          type: "REPOSITION_POINT",
          index: action.index,
          time: t,
        });
        handleRef.current?.seekTo(t);
        break;
      }
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

  // Toggle mute for a single channel. Updates local UI state and calls
  // through to the shared PlaybackHandle so the underlying GainNode is
  // silenced in the audio output. Not saved. Declared before any early
  // return so hook order stays stable across renders; reads the handle
  // from a ref to avoid re-creating when the handle identity changes.
  const onToggleMute = useCallback((trackIndex: number, nextMuted: boolean) => {
    handleRef.current?.setChannelMuted(trackIndex, nextMuted);
    // Bump a tick so this Timeline re-reads handle.isChannelMuted().
    setMuteTick((t) => t + 1);
  }, []);

  if (!handle) {
    return (
      <p
        data-testid="timeline-error"
        style={{
          color: "var(--stagebook-danger, #dc2626)",
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
      data-zoom-level={zoomLevel}
      role="region"
      aria-label={`Timeline: ${name}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        border: "1px solid var(--stagebook-border, #e5e7eb)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        outline: "none",
        position: "relative",
      }}
    >
      {/* Minimap — only when zoomed in */}
      {zoomLevel > 1 && (
        <div style={{ marginLeft: `${String(GUTTER_WIDTH)}px` }}>
          <Minimap
            duration={duration}
            width={waveformWidth}
            zoomLevel={zoomLevel}
            viewportStart={viewportStart}
            currentTime={currentTime}
            selections={state.selections}
            peaks={peaks}
            peaksVersion={peaksVersion}
            totalBuckets={totalBuckets}
            onViewportChange={onMinimapPan}
          />
        </div>
      )}

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
            peaksVersion={peaksVersion}
            waveformWidth={waveformWidth}
            height={TRACK_HEIGHT}
            startBucket={startBucket}
            endBucket={endBucket}
            muted={handle.isChannelMuted(i)}
            onToggleMute={(nextMuted) => onToggleMute(i, nextMuted)}
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
            multiSelect={multiSelect}
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
            onAdjustHandle={(index, h, time, noSnapshot) =>
              dispatch({
                type: "ADJUST_HANDLE",
                index,
                handle: h,
                time,
                noSnapshot,
              })
            }
            onRepositionPoint={(index, time, noSnapshot) =>
              dispatch({
                type: "REPOSITION_POINT",
                index,
                time,
                noSnapshot,
              })
            }
            onSelect={(index) => dispatch({ type: "SELECT", index })}
            onDeselect={() => dispatch({ type: "DESELECT" })}
            onSetActiveHandle={(h) =>
              dispatch({ type: "SET_ACTIVE_HANDLE", handle: h })
            }
            onBeginDrag={() => {
              dispatch({ type: "BEGIN_DRAG" });
              setIsDragging(true);
            }}
            onEndDrag={() => setIsDragging(false)}
            onRequestFocus={() =>
              containerElRef.current?.focus({ preventScroll: true })
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

      {/* Footer */}
      <TimelineFooter
        selectionType={selectionType}
        selections={state.selections}
        activeIndex={state.activeIndex}
        zoomLevel={zoomLevel}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onHelpToggle={() => setHelpOpen((v) => !v)}
        helpOpen={helpOpen}
      />

      {/* Help popover */}
      {helpOpen && (
        <HelpPopover
          selectionType={selectionType}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </div>
  );
}
