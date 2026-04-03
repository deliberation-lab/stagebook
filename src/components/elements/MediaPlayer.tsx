import React, {
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isYouTubeURL } from "./mediaPlayer/isYouTubeURL.js";
import { parseVTT, type CaptionCue } from "./mediaPlayer/parseVTT.js";
import { YouTubePlayer } from "./mediaPlayer/YouTubePlayer.js";
import { useRegisterPlayback } from "../playback/PlaybackProvider.js";
import type { PlaybackHandle } from "../playback/PlaybackHandle.js";
import { formatTime } from "../../utils/formatTime.js";
import { computeWatchedRanges } from "../../utils/watchedRanges.js";
import {
  PlayIcon,
  PauseIcon,
  SeekBackIcon,
  SeekForwardIcon,
  StepBackIcon,
  StepForwardIcon,
} from "./mediaPlayer/icons.js";

export interface VideoEvent {
  type: "play" | "pause" | "ended" | "stopAt";
  videoTime: number;
  stageTimeElapsed: number;
}

interface VideoRecord {
  name: string;
  url: string;
  startAt?: number;
  stopAt?: number;
  events: VideoEvent[];
  lastVideoTime: number;
  /** Merged closed intervals [startSeconds, endSeconds] derived from the event log. */
  watchedRanges: [number, number][];
}

export interface MediaPlayerProps {
  name: string;
  url: string;
  save: (key: string, value: unknown) => void;
  getElapsedTime: () => number;
  onComplete?: () => void;
  syncToStageTime?: boolean;
  submitOnComplete?: boolean;
  playVideo?: boolean;
  playAudio?: boolean;
  captionsURL?: string;
  startAt?: number;
  stopAt?: number;
  allowScrubOutsideBounds?: boolean;
  stepDuration?: number;
  controls?: {
    playPause?: boolean;
    seek?: boolean;
    step?: boolean;
    speed?: boolean;
  };
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

// Number of repeated keydown events before entering fast-scrub mode
const HOLD_REPEAT_THRESHOLD = 10;

// Shared button styles — inline to avoid Tailwind dependency in CT tests
const controlBtnBase: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "9999px",
  color: "#fff",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};

const controlBtnSmall: React.CSSProperties = {
  ...controlBtnBase,
  width: 36,
  height: 36,
};

const controlBtnLarge: React.CSSProperties = {
  ...controlBtnBase,
  width: 48,
  height: 48,
};

export function MediaPlayer({
  name,
  url,
  save,
  getElapsedTime,
  onComplete,
  syncToStageTime = false,
  submitOnComplete = false,
  playVideo = true,
  playAudio = true,
  captionsURL,
  startAt,
  stopAt,
  allowScrubOutsideBounds = false,
  stepDuration = 1,
  controls,
}: MediaPlayerProps) {
  const youtubeVideoId = isYouTubeURL(url);
  const saveKey = `mediaPlayer_${name}`;

  const eventsRef = useRef<VideoEvent[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPaused, setIsPaused] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [captionText, setCaptionText] = useState<string | null>(null);

  // YouTube-only: handle registered by YouTubePlayer once the IFrame API is ready
  const [ytHandle, setYtHandle] = useState<PlaybackHandle | null>(null);

  // Track whether the video was playing when a scrub drag started, so we can
  // pause on grab and resume on release (records proper play/pause events for
  // watchedRanges without spamming the server during the drag).
  const scrubWasPlayingRef = useRef(false);

  // Poll YouTube currentTime ~4×/sec while playing (no timeupdate event from IFrame API)
  useEffect(() => {
    if (!ytHandle || isPaused) return;
    const id = setInterval(() => {
      const t = ytHandle.getCurrentTime();
      setCurrentTime(t);
      if (stopAt !== undefined && t >= stopAt) {
        ytHandle.pause();
      }
    }, 250);
    return () => clearInterval(id);
  }, [ytHandle, isPaused, stopAt]);

  // HTML5 PlaybackHandle — exposes this player to sibling components via PlaybackProvider
  const handle = useMemo<PlaybackHandle>(
    () => ({
      play: () => {
        void videoRef.current?.play();
      },
      pause: () => videoRef.current?.pause(),
      seekTo: (s: number) => {
        if (videoRef.current) videoRef.current.currentTime = s;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
      getDuration: () => videoRef.current?.duration ?? 0,
      isPaused: () => videoRef.current?.paused ?? true,
      isYouTube: false,
    }),
    [], // stable: all methods close over videoRef which is a stable ref
  );
  // Use the YouTube handle when available, fall back to the HTML5 handle
  useRegisterPlayback(name, ytHandle ?? handle);

  // Hold-to-scrub state
  const arrowRepeatCountRef = useRef(0);
  const isFastScrubbing = useRef(false);
  const pausedBeforeScrub = useRef(true);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch and parse captions when captionsURL changes
  useEffect(() => {
    if (!captionsURL) return;
    let cancelled = false;
    fetch(captionsURL)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setCues(parseVTT(text));
      })
      .catch(() => {
        /* silently ignore caption load failures */
      });
    return () => {
      cancelled = true;
    };
  }, [captionsURL]);

  // Seek to startAt on mount (or to elapsedTime+startAt when syncToStageTime)
  useEffect(() => {
    if (!videoRef.current) return;
    if (syncToStageTime) {
      videoRef.current.currentTime = getElapsedTime() + (startAt ?? 0);
    } else if (startAt !== undefined) {
      videoRef.current.currentTime = startAt;
    }
  }, []); // mount-only: reads initial values of getElapsedTime/startAt

  const recordEvent = useCallback(
    (type: VideoEvent["type"], videoTime: number) => {
      const event: VideoEvent = {
        type,
        videoTime,
        stageTimeElapsed: getElapsedTime(),
      };
      eventsRef.current = [...eventsRef.current, event];
      const record: VideoRecord = {
        name,
        url,
        ...(startAt !== undefined && { startAt }),
        ...(stopAt !== undefined && { stopAt }),
        events: eventsRef.current,
        lastVideoTime: videoTime,
        watchedRanges: computeWatchedRanges(eventsRef.current),
      };
      save(saveKey, record);
    },
    [getElapsedTime, name, url, startAt, stopAt, save, saveKey],
  );

  const handlePlay = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPaused(false);
      recordEvent("play", e.currentTarget.currentTime);
    },
    [recordEvent],
  );

  const handlePause = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPaused(true);
      recordEvent("pause", e.currentTarget.currentTime);
    },
    [recordEvent],
  );

  const handleEnded = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setIsPaused(true);
      recordEvent("ended", e.currentTarget.currentTime);
      if (submitOnComplete) {
        onComplete?.();
      }
    },
    [recordEvent, submitOnComplete, onComplete],
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      setDuration(e.currentTarget.duration);
    },
    [],
  );

  const handleProgress = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      if (
        v.buffered.length > 0 &&
        Number.isFinite(v.duration) &&
        v.duration > 0
      ) {
        setBufferedEnd(v.buffered.end(v.buffered.length - 1));
      }
    },
    [],
  );

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const { currentTime: ct } = e.currentTarget;
      setCurrentTime(ct);

      // stopAt enforcement
      if (stopAt !== undefined && ct >= stopAt) {
        e.currentTarget.pause();
        recordEvent("stopAt", ct);
        return;
      }

      // Caption update
      if (cues.length > 0) {
        const active = cues.find((c) => ct >= c.startTime && ct <= c.endTime);
        setCaptionText(active?.text ?? null);
      }
    },
    [stopAt, cues, recordEvent],
  );

  // Clamp seek target to allowed range — works for both HTML5 and YouTube
  const seek = useCallback(
    (delta: number) => {
      if (ytHandle) {
        const cur = ytHandle.getCurrentTime();
        const dur = ytHandle.getDuration();
        const min = allowScrubOutsideBounds ? 0 : (startAt ?? 0);
        const max = allowScrubOutsideBounds
          ? Number.isFinite(dur)
            ? dur
            : Infinity
          : (stopAt ?? (Number.isFinite(dur) ? dur : Infinity));
        ytHandle.seekTo(Math.min(Math.max(cur + delta, min), max));
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      const min = allowScrubOutsideBounds ? 0 : (startAt ?? 0);
      const max = allowScrubOutsideBounds
        ? Number.isFinite(v.duration)
          ? v.duration
          : Infinity
        : (stopAt ?? (Number.isFinite(v.duration) ? v.duration : Infinity));
      v.currentTime = Math.min(Math.max(v.currentTime + delta, min), max);
    },
    [allowScrubOutsideBounds, startAt, stopAt, ytHandle],
  );

  const exitFastScrub = useCallback(() => {
    const v = videoRef.current;
    if (!v || !isFastScrubbing.current) return;
    isFastScrubbing.current = false;
    v.playbackRate = playbackRate;
    if (pausedBeforeScrub.current) v.pause();
  }, [playbackRate]);

  const enterFastScrubForward = useCallback(() => {
    const v = videoRef.current;
    if (!v || isFastScrubbing.current) return;
    isFastScrubbing.current = true;
    pausedBeforeScrub.current = v.paused;
    v.playbackRate = 2;
    if (v.paused) void v.play();
  }, []);

  const cycleSpeed = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const idx = SPEEDS.indexOf(playbackRate as (typeof SPEEDS)[number]);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    v.playbackRate = next;
    setPlaybackRate(next);
  }, [playbackRate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // YouTube: only Space/K play-pause and J/L/Arrow seek work
      if (ytHandle) {
        switch (e.key) {
          case " ":
          case "k":
          case "K":
            e.preventDefault();
            if (ytHandle.isPaused()) ytHandle.play();
            else ytHandle.pause();
            break;
          case "j":
          case "J":
            e.preventDefault();
            seek(-10);
            break;
          case "l":
          case "L":
            e.preventDefault();
            seek(10);
            break;
          case "ArrowRight":
            e.preventDefault();
            seek(1);
            break;
          case "ArrowLeft":
            e.preventDefault();
            seek(-1);
            break;
          default:
            break;
        }
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (v.paused) void v.play();
          else v.pause();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.repeat) {
            arrowRepeatCountRef.current++;
            if (arrowRepeatCountRef.current >= HOLD_REPEAT_THRESHOLD) {
              enterFastScrubForward();
            }
          } else {
            arrowRepeatCountRef.current = 0;
            seek(1);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.repeat) {
            arrowRepeatCountRef.current++;
            if (arrowRepeatCountRef.current >= HOLD_REPEAT_THRESHOLD) {
              // Rewind: keep seeking back rapidly
              seek(-0.5);
            }
          } else {
            arrowRepeatCountRef.current = 0;
            seek(-1);
          }
          break;
        case "l":
        case "L":
          e.preventDefault();
          seek(10);
          break;
        case "j":
        case "J":
          e.preventDefault();
          seek(-10);
          break;
        case ".":
          e.preventDefault();
          seek(stepDuration);
          break;
        case ",":
          e.preventDefault();
          seek(-stepDuration);
          break;
        case ">": {
          e.preventDefault();
          const faster =
            SPEEDS.find((s) => s > playbackRate) ?? SPEEDS[SPEEDS.length - 1];
          v.playbackRate = faster;
          setPlaybackRate(faster);
          break;
        }
        case "<": {
          e.preventDefault();
          const slower =
            [...SPEEDS].reverse().find((s) => s < playbackRate) ?? SPEEDS[0];
          v.playbackRate = slower;
          setPlaybackRate(slower);
          break;
        }
        default:
          break;
      }
    },
    [seek, stepDuration, playbackRate, enterFastScrubForward],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        arrowRepeatCountRef.current = 0;
        exitFastScrub();
      }
    },
    [exitFastScrub],
  );

  // Button hold-to-scrub
  const startButtonHold = useCallback(
    (direction: 1 | -1) => {
      holdTimerRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        if (direction === 1) {
          enterFastScrubForward();
        } else {
          isFastScrubbing.current = true;
          pausedBeforeScrub.current = v.paused;
          // Step back rapidly via interval
          const interval = setInterval(() => {
            seek(-0.5);
          }, 100);
          // Store interval id on the timer ref for cleanup
          (holdTimerRef as React.MutableRefObject<unknown>).current = interval;
        }
      }, 500);
    },
    [enterFastScrubForward, seek],
  );

  const endButtonHold = useCallback(
    (didSeekOnClick: boolean) => {
      if (holdTimerRef.current !== null) {
        clearTimeout(holdTimerRef.current);
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      exitFastScrub();
      // Reset fast-scrub flag even if not fast-scrubbing (no-op)
      isFastScrubbing.current = false;
      void didSeekOnClick; // used by callers to decide whether to also call seek()
    },
    [exitFastScrub],
  );

  const hasControls =
    !syncToStageTime &&
    controls !== undefined &&
    (controls.playPause || controls.seek || controls.step || controls.speed);
  // Controls are always visible when paused or hovered (video mode).
  // In audio-only mode (playVideo:false) there's no video to obscure, so always show.
  const controlsVisible = hasControls && (isPaused || isHovered || !playVideo);

  // Scrub bar bounds
  const scrubMin = allowScrubOutsideBounds ? 0 : (startAt ?? 0);
  const scrubMax = allowScrubOutsideBounds
    ? Number.isFinite(duration) && duration > 0
      ? duration
      : 0
    : (stopAt ?? duration);

  // Scrub bar fill widths (percentage)
  const playedPct =
    scrubMax > scrubMin
      ? Math.min(
          Math.max(((currentTime - scrubMin) / (scrubMax - scrubMin)) * 100, 0),
          100,
        )
      : 0;
  const bufferedPct =
    scrubMax > scrubMin
      ? Math.min(((bufferedEnd - scrubMin) / (scrubMax - scrubMin)) * 100, 100)
      : 0;

  // Transport buttons + scrub bar — shared between video-overlay and audio-flat layouts
  const controlsContent = (
    <>
      {/* Transport buttons row — centered, play in the middle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.25rem",
        }}
      >
        {controls?.seek && (
          <button
            data-testid="mediaPlayer-seekBack"
            aria-label="Back 1s"
            title="Back 1s (←) · Hold to scrub · J for 10s"
            style={controlBtnSmall}
            onMouseDown={() => startButtonHold(-1)}
            onMouseUp={() => {
              const wasHeld = isFastScrubbing.current;
              endButtonHold(false);
              if (!wasHeld) seek(-1);
            }}
            onMouseLeave={() => endButtonHold(false)}
          >
            <SeekBackIcon />
          </button>
        )}

        {controls?.step && (
          <button
            data-testid="mediaPlayer-stepBack"
            aria-label={`Step back ${String(stepDuration)}s`}
            title={`Step back ${String(stepDuration)}s (,)`}
            style={controlBtnSmall}
            onClick={() => seek(-stepDuration)}
          >
            <StepBackIcon />
          </button>
        )}

        {controls?.playPause && (
          <button
            data-testid="mediaPlayer-playPause"
            aria-label={isPaused ? "Play" : "Pause"}
            title={isPaused ? "Play (Space)" : "Pause (Space)"}
            style={controlBtnLarge}
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused) void v.play();
              else v.pause();
            }}
          >
            {isPaused ? <PlayIcon /> : <PauseIcon />}
          </button>
        )}

        {controls?.step && (
          <button
            data-testid="mediaPlayer-stepForward"
            aria-label={`Step forward ${String(stepDuration)}s`}
            title={`Step forward ${String(stepDuration)}s (.)`}
            style={controlBtnSmall}
            onClick={() => seek(stepDuration)}
          >
            <StepForwardIcon />
          </button>
        )}

        {controls?.seek && (
          <button
            data-testid="mediaPlayer-seekForward"
            aria-label="Forward 1s"
            title="Forward 1s (→) · Hold to scrub · L for 10s"
            style={controlBtnSmall}
            onMouseDown={() => startButtonHold(1)}
            onMouseUp={() => {
              const wasHeld = isFastScrubbing.current;
              endButtonHold(false);
              if (!wasHeld) seek(1);
            }}
            onMouseLeave={() => endButtonHold(false)}
          >
            <SeekForwardIcon />
          </button>
        )}

        {controls?.speed && (
          <button
            data-testid="mediaPlayer-speed"
            aria-label="Playback speed"
            title="Playback speed (< / >)"
            style={{
              ...controlBtnSmall,
              fontSize: "0.875rem",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
            onClick={cycleSpeed}
          >
            {playbackRate}×
          </button>
        )}
      </div>

      {/* Scrub bar + time display row */}
      {controls?.seek && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Custom div scrub bar — consistent cross-browser appearance */}
          <div
            data-testid="mediaPlayer-scrubBar"
            role="slider"
            aria-label="Seek"
            aria-valuemin={scrubMin}
            aria-valuemax={scrubMax}
            aria-valuenow={currentTime}
            data-step={stepDuration}
            tabIndex={0}
            style={{
              flex: 1,
              position: "relative",
              height: 20,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width),
              );
              const t = scrubMin + pct * (scrubMax - scrubMin);
              e.currentTarget.setPointerCapture(e.pointerId);
              const v = videoRef.current;
              if (!v) return;
              // Pause if playing so the user can scrub to an exact frame.
              // The pause event is recorded by handlePause at the pre-scrub position.
              if (!v.paused) {
                scrubWasPlayingRef.current = true;
                v.pause();
              }
              v.currentTime = t;
              setCurrentTime(t);
            }}
            onPointerMove={(e) => {
              if (!(e.buttons & 1)) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width),
              );
              const t = scrubMin + pct * (scrubMax - scrubMin);
              if (videoRef.current) videoRef.current.currentTime = t;
              setCurrentTime(t);
            }}
            onPointerUp={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width),
              );
              const t = scrubMin + pct * (scrubMax - scrubMin);
              const v = videoRef.current;
              if (!v) return;
              v.currentTime = t;
              setCurrentTime(t);
              // Resume if we paused on grab; play event records the new position.
              if (scrubWasPlayingRef.current) {
                scrubWasPlayingRef.current = false;
                void v.play();
              }
            }}
          >
            {/* Track */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,0.2)",
              }}
            >
              {/* Buffered fill */}
              <div
                data-testid="mediaPlayer-buffered"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${String(bufferedPct)}%`,
                  background: "rgba(255,255,255,0.35)",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
              {/* Played fill */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${String(playedPct)}%`,
                  background: "#fff",
                  borderRadius: 2,
                  pointerEvents: "none",
                }}
              />
            </div>
            {/* Thumb */}
            <div
              style={{
                position: "absolute",
                left: `${String(playedPct)}%`,
                transform: "translateX(-50%)",
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                pointerEvents: "none",
              }}
            />
          </div>
          <span
            data-testid="mediaPlayer-time"
            style={{
              color: "#fff",
              fontSize: "0.75rem",
              whiteSpace: "nowrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      )}
    </>
  );

  if (youtubeVideoId) {
    // YouTube: IFrame API drives playback; controls overlay on top of the iframe.
    // Frame-step controls are hidden (YouTube doesn't expose frame-level access).
    // Speed control is also hidden (YouTube IFrame API doesn't expose setPlaybackRate
    // in a way that integrates cleanly with our controls).
    const ytHasControls =
      !syncToStageTime &&
      controls !== undefined &&
      (controls.playPause || controls.seek);
    const ytControlsVisible =
      ytHasControls && (isPaused || isHovered || !playVideo);

    const ytControlsContent = ytHasControls ? (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.25rem",
          }}
        >
          {controls?.seek && (
            <button
              data-testid="mediaPlayer-seekBack"
              aria-label="Back 1s"
              title="Back 1s · J for 10s"
              style={controlBtnSmall}
              onClick={() => {
                ytHandle?.seekTo(Math.max(0, ytHandle.getCurrentTime() - 1));
              }}
            >
              <SeekBackIcon />
            </button>
          )}
          {controls?.playPause && (
            <button
              data-testid="mediaPlayer-playPause"
              aria-label={isPaused ? "Play" : "Pause"}
              title={isPaused ? "Play (Space)" : "Pause (Space)"}
              style={controlBtnLarge}
              onClick={() => {
                if (isPaused) ytHandle?.play();
                else ytHandle?.pause();
              }}
            >
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </button>
          )}
          {controls?.seek && (
            <button
              data-testid="mediaPlayer-seekForward"
              aria-label="Forward 1s"
              title="Forward 1s · L for 10s"
              style={controlBtnSmall}
              onClick={() => {
                ytHandle?.seekTo(ytHandle.getCurrentTime() + 1);
              }}
            >
              <SeekForwardIcon />
            </button>
          )}
        </div>
        {controls?.seek && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <div
              data-testid="mediaPlayer-scrubBar"
              role="slider"
              aria-label="Seek"
              aria-valuemin={scrubMin}
              aria-valuemax={scrubMax}
              aria-valuenow={currentTime}
              tabIndex={0}
              style={{
                flex: 1,
                position: "relative",
                height: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width),
                );
                const t = scrubMin + pct * (scrubMax - scrubMin);
                e.currentTarget.setPointerCapture(e.pointerId);
                if (ytHandle && !ytHandle.isPaused()) {
                  scrubWasPlayingRef.current = true;
                  ytHandle.pause();
                }
                ytHandle?.seekTo(t);
                setCurrentTime(t);
              }}
              onPointerMove={(e) => {
                if (!(e.buttons & 1)) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width),
                );
                const t = scrubMin + pct * (scrubMax - scrubMin);
                ytHandle?.seekTo(t);
                setCurrentTime(t);
              }}
              onPointerUp={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(
                  0,
                  Math.min(1, (e.clientX - rect.left) / rect.width),
                );
                const t = scrubMin + pct * (scrubMax - scrubMin);
                ytHandle?.seekTo(t);
                setCurrentTime(t);
                if (scrubWasPlayingRef.current) {
                  scrubWasPlayingRef.current = false;
                  ytHandle?.play();
                }
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.2)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${String(playedPct)}%`,
                    background: "#fff",
                    borderRadius: 2,
                    pointerEvents: "none",
                  }}
                />
              </div>
              <div
                style={{
                  position: "absolute",
                  left: `${String(playedPct)}%`,
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  pointerEvents: "none",
                }}
              />
            </div>
            <span
              data-testid="mediaPlayer-time"
              style={{
                color: "#fff",
                fontSize: "0.75rem",
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </>
    ) : null;

    return (
      <div
        data-testid="mediaPlayer"
        role="region"
        aria-label="Media player"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ position: "relative" }}
      >
        <div
          data-testid="mediaPlayer-viewport"
          style={{ position: "relative" }}
        >
          <YouTubePlayer
            videoId={youtubeVideoId}
            startAt={startAt}
            onHandleReady={(h) => {
              setYtHandle(h);
              setDuration(h.getDuration());
            }}
            onPlay={(t) => {
              setIsPaused(false);
              setCurrentTime(t);
              recordEvent("play", t);
            }}
            onPause={(t) => {
              setIsPaused(true);
              setCurrentTime(t);
              recordEvent("pause", t);
            }}
            onEnded={(t) => {
              setIsPaused(true);
              setCurrentTime(t);
              recordEvent("ended", t);
              if (submitOnComplete) onComplete?.();
            }}
          />
          {ytControlsVisible && (
            <div
              data-testid="mediaPlayer-controls"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)",
                padding: "1.5rem 0.75rem 0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {ytControlsContent}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="mediaPlayer"
      role="region"
      aria-label="Media player"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: "relative" }}
    >
      {/* Audio-only: hidden video element (no viewport div) */}
      {!playVideo && (
        <video
          ref={videoRef}
          data-testid="mediaPlayer-video"
          src={url}
          muted={!playAudio}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          style={{ display: "none" }}
        >
          <track kind="captions" />
        </video>
      )}

      {/* Video viewport — video + captions + overlay controls */}
      {playVideo && (
        <div
          data-testid="mediaPlayer-viewport"
          style={{ position: "relative" }}
        >
          <video
            ref={videoRef}
            data-testid="mediaPlayer-video"
            src={url}
            muted={!playAudio}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onProgress={handleProgress}
            style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
          >
            <track kind="captions" />
          </video>

          {captionText !== null && (
            <div
              data-testid="mediaPlayer-caption"
              style={{
                textAlign: "center",
                padding: "0.5rem",
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
              }}
            >
              {captionText}
            </div>
          )}

          {controlsVisible && (
            <div
              data-testid="mediaPlayer-controls"
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 100%)",
                padding: "1.5rem 0.75rem 0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {controlsContent}
            </div>
          )}
        </div>
      )}

      {/* Audio-only: flat controls bar (always visible — no hover needed) */}
      {!playVideo && controlsVisible && (
        <div
          data-testid="mediaPlayer-controls"
          style={{
            background: "rgba(28,28,30,0.96)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {controlsContent}
        </div>
      )}
    </div>
  );
}
