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
import { HTML5Controls, YouTubeControls } from "./mediaPlayer/controls.js";
import { useRegisterPlayback } from "../playback/PlaybackProvider.js";
import type { PlaybackHandle } from "../playback/PlaybackHandle.js";
import { computeWatchedRanges } from "../../utils/watchedRanges.js";

export interface VideoEvent {
  type: "play" | "pause" | "ended" | "seek" | "speed" | "stopAt";
  videoTime: number;
  stageTimeElapsed: number;
  /** Present on seek events: the position before seeking */
  fromTime?: number;
  /** Present on speed events: the new playback rate */
  playbackRate?: number;
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

/** Reject URLs with dangerous protocols (javascript:, data:, vbscript:, etc.) */
function isSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Number of repeated keydown events before entering fast-scrub mode
const HOLD_REPEAT_THRESHOLD = 10;

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

  // Defense-in-depth: reject dangerous URL protocols. Element.tsx already
  // resolves relative paths via getAssetURL(), so this guards against
  // javascript:, data:, and other non-HTTP schemes reaching a <video> src.
  if (!youtubeVideoId && !isSafeURL(url)) {
    return (
      <div data-testid="mediaPlayer" role="alert">
        Invalid media URL
      </div>
    );
  }

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

  // Set to true just before programmatically pausing the video at stopAt, so
  // handlePause can suppress the phantom "pause" event and we record "ended".
  const stopAtReachedRef = useRef(false);

  // Poll YouTube currentTime ~4×/sec while playing (no timeupdate event from IFrame API)
  useEffect(() => {
    if (!ytHandle || isPaused) return;
    const id = setInterval(() => {
      const t = ytHandle.getCurrentTime();
      setCurrentTime(t);
      if (stopAt !== undefined && t >= stopAt) {
        // Signal that the upcoming onPause is from stopAt, not a user action.
        stopAtReachedRef.current = true;
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
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch and parse captions when captionsURL changes
  useEffect(() => {
    if (!captionsURL) return;
    if (!isSafeURL(captionsURL)) {
      console.warn(
        `[MediaPlayer] Rejected unsafe captions URL: ${captionsURL}`,
      );
      return;
    }
    let cancelled = false;
    fetch(captionsURL)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setCues(parseVTT(text));
      })
      .catch((err: unknown) => {
        console.warn(`[MediaPlayer] Failed to load captions:`, err);
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
    (
      type: VideoEvent["type"],
      videoTime: number,
      extra?: Partial<Pick<VideoEvent, "fromTime" | "playbackRate">>,
    ) => {
      const event: VideoEvent = {
        type,
        videoTime,
        stageTimeElapsed: getElapsedTime(),
        ...extra,
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
      // Suppress the phantom pause event triggered by our own stopAt enforcement.
      // handleTimeUpdate records "ended" and calls onComplete in that path.
      if (stopAtReachedRef.current) {
        stopAtReachedRef.current = false;
        setIsPaused(true);
        return;
      }
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

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const err = e.currentTarget.error;
      console.error(
        `[MediaPlayer] Video error (code ${err?.code}): ${err?.message ?? "unknown"}`,
      );
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

      // stopAt enforcement — records "stopAt" event (distinct from natural "ended")
      if (stopAt !== undefined && ct >= stopAt) {
        stopAtReachedRef.current = true;
        e.currentTarget.pause(); // fires "pause" event; handlePause suppresses it
        recordEvent("stopAt", ct);
        if (submitOnComplete) onComplete?.();
        return;
      }

      // Caption update
      if (cues.length > 0) {
        const active = cues.find((c) => ct >= c.startTime && ct <= c.endTime);
        setCaptionText(active?.text ?? null);
      }
    },
    [stopAt, cues, recordEvent, submitOnComplete, onComplete],
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
        const newTime = Math.min(Math.max(cur + delta, min), max);
        ytHandle.seekTo(newTime);
        recordEvent("seek", newTime, { fromTime: cur });
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      const fromTime = v.currentTime;
      const min = allowScrubOutsideBounds ? 0 : (startAt ?? 0);
      const max = allowScrubOutsideBounds
        ? Number.isFinite(v.duration)
          ? v.duration
          : Infinity
        : (stopAt ?? (Number.isFinite(v.duration) ? v.duration : Infinity));
      v.currentTime = Math.min(Math.max(v.currentTime + delta, min), max);
      recordEvent("seek", v.currentTime, { fromTime });
    },
    [allowScrubOutsideBounds, startAt, stopAt, ytHandle, recordEvent],
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
    recordEvent("speed", v.currentTime, { playbackRate: next });
  }, [playbackRate, recordEvent]);

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
      holdTimeoutRef.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        if (direction === 1) {
          enterFastScrubForward();
        } else {
          isFastScrubbing.current = true;
          pausedBeforeScrub.current = v.paused;
          // Step back rapidly via interval
          holdIntervalRef.current = setInterval(() => {
            seek(-0.5);
          }, 100);
        }
      }, 500);
    },
    [enterFastScrubForward, seek],
  );

  const endButtonHold = useCallback(
    (didSeekOnClick: boolean) => {
      if (holdTimeoutRef.current !== null) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      if (holdIntervalRef.current !== null) {
        clearInterval(holdIntervalRef.current);
        holdIntervalRef.current = null;
      }
      exitFastScrub();
      isFastScrubbing.current = false;
      void didSeekOnClick;
    },
    [exitFastScrub],
  );

  // ---------------------------------------------------------------------------
  // Callbacks forwarded to HTML5Controls / YouTubeControls
  // ---------------------------------------------------------------------------

  // Seek button: read isFastScrubbing before endButtonHold resets it, then
  // do a single-step seek only if the hold didn't already move the playhead.
  const onSeekButtonRelease = useCallback(
    (direction: 1 | -1) => {
      const wasHeld = isFastScrubbing.current;
      endButtonHold(false);
      if (!wasHeld) seek(direction);
    },
    [endButtonHold, seek],
  );

  const onSeekButtonLeave = useCallback(
    () => endButtonHold(false),
    [endButtonHold],
  );

  const onPlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  // Scrub bar: pause on grab (records "pause" event at pre-scrub position),
  // seek in real-time during drag, resume on release (records "play" event).
  const onScrubStart = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      scrubWasPlayingRef.current = true;
      v.pause();
    }
    v.currentTime = t;
    setCurrentTime(t);
  }, []);

  const onScrubMove = useCallback((t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const onScrubEnd = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
    if (scrubWasPlayingRef.current) {
      scrubWasPlayingRef.current = false;
      void v.play();
    }
  }, []);

  // YouTube-specific scrub callbacks
  const ytOnPlayPause = useCallback(() => {
    if (isPaused) ytHandle?.play();
    else ytHandle?.pause();
  }, [isPaused, ytHandle]);

  const ytOnSeekBack = useCallback(() => {
    seek(-1);
  }, [seek]);

  const ytOnSeekForward = useCallback(() => {
    seek(1);
  }, [seek]);

  const ytOnScrubStart = useCallback(
    (t: number) => {
      if (ytHandle && !ytHandle.isPaused()) {
        scrubWasPlayingRef.current = true;
        ytHandle.pause();
      }
      ytHandle?.seekTo(t);
      setCurrentTime(t);
    },
    [ytHandle],
  );

  const ytOnScrubMove = useCallback(
    (t: number) => {
      ytHandle?.seekTo(t);
      setCurrentTime(t);
    },
    [ytHandle],
  );

  const ytOnScrubEnd = useCallback(
    (t: number) => {
      ytHandle?.seekTo(t);
      setCurrentTime(t);
      if (scrubWasPlayingRef.current) {
        scrubWasPlayingRef.current = false;
        ytHandle?.play();
      }
    },
    [ytHandle],
  );

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

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

  // Scrub bar fill percentages
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

  // Shared props for HTML5Controls (used in both video-overlay and audio-flat layouts)
  const html5ControlsProps = {
    controls,
    isPaused,
    stepDuration,
    playbackRate,
    scrubMin,
    scrubMax,
    currentTime,
    duration,
    playedPct,
    bufferedPct,
    onSeek: seek,
    onCycleSpeed: cycleSpeed,
    onSeekButtonPress: startButtonHold,
    onSeekButtonRelease,
    onSeekButtonLeave,
    onPlayPause,
    onScrubStart,
    onScrubMove,
    onScrubEnd,
  };

  // ---------------------------------------------------------------------------
  // YouTube branch
  // ---------------------------------------------------------------------------

  if (youtubeVideoId) {
    const ytHasControls =
      !syncToStageTime &&
      controls !== undefined &&
      (controls.playPause || controls.seek);
    const ytControlsVisible =
      ytHasControls && (isPaused || isHovered || !playVideo);

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
              // stopAt reached via the poll: record "stopAt" not "pause"
              if (stopAtReachedRef.current) {
                stopAtReachedRef.current = false;
                recordEvent("stopAt", t);
                if (submitOnComplete) onComplete?.();
                return;
              }
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
              <YouTubeControls
                controls={controls}
                isPaused={isPaused}
                scrubMin={scrubMin}
                scrubMax={scrubMax}
                currentTime={currentTime}
                duration={duration}
                playedPct={playedPct}
                onPlayPause={ytOnPlayPause}
                onSeekBack={ytOnSeekBack}
                onSeekForward={ytOnSeekForward}
                onScrubStart={ytOnScrubStart}
                onScrubMove={ytOnScrubMove}
                onScrubEnd={ytOnScrubEnd}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // HTML5 branch
  // ---------------------------------------------------------------------------

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
          onError={handleError}
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
            onError={handleError}
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
              <HTML5Controls {...html5ControlsProps} />
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
          <HTML5Controls {...html5ControlsProps} />
        </div>
      )}
    </div>
  );
}
