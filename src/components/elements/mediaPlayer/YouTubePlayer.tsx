/**
 * YouTubePlayer: HTML5 <video>-compatible wrapper around the YouTube IFrame API.
 *
 * Exports:
 *   loadYouTubeAPI()        — lazy-loads the IFrame API script once per page
 *   buildYouTubeHandle()    — constructs a PlaybackHandle from a YT.Player instance
 *   createYouTubePlayer()   — wires up a YT.Player with event callbacks
 *   YouTubePlayer           — React component used by MediaPlayer
 */
import React, { useEffect, useRef } from "react";
import type { PlaybackHandle } from "../../playback/PlaybackHandle.js";

// ── YouTube IFrame API types (subset we actually use) ────────────────────────

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: {
    start?: number;
    autoplay?: 0 | 1;
    enablejsapi?: 1;
    modestbranding?: 1;
    rel?: 0 | 1;
  };
  events?: {
    onReady?: () => void;
    onStateChange?: (event: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerOptions) => YTPlayer;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ── API loader ────────────────────────────────────────────────────────────────

// Pending callbacks waiting for the API to finish loading
const pendingCallbacks: Array<() => void> = [];
let scriptInjected = false;

/** Resolves when window.YT.Player is available. Safe to call multiple times. */
export function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    // Already loaded — resolve immediately
    if (typeof window !== "undefined" && window.YT?.Player) {
      resolve();
      return;
    }

    pendingCallbacks.push(resolve);

    if (!scriptInjected) {
      scriptInjected = true;
      // The API calls window.onYouTubeIframeAPIReady when ready
      window.onYouTubeIframeAPIReady = () => {
        const cbs = pendingCallbacks.splice(0);
        cbs.forEach((cb) => cb());
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
}

// ── PlaybackHandle factory ────────────────────────────────────────────────────

/** Build a PlaybackHandle that delegates to a live YT.Player instance. */
export function buildYouTubeHandle(player: YTPlayer): PlaybackHandle {
  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seekTo: (seconds: number) => player.seekTo(seconds, true),
    getCurrentTime: () => player.getCurrentTime(),
    getDuration: () => player.getDuration(),
    isPaused: () => player.getPlayerState() !== 1 /* YT.PlayerState.PLAYING */,
    isYouTube: true,
  };
}

// ── YT.Player factory ─────────────────────────────────────────────────────────

export interface CreateYouTubePlayerOptions {
  container: HTMLElement;
  videoId: string;
  startAt?: number;
  onHandleReady: (handle: PlaybackHandle) => void;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onEnded: (currentTime: number) => void;
}

export interface YouTubePlayerController {
  destroy: () => void;
}

/**
 * Creates a YT.Player instance (after the API loads) and wires event callbacks.
 * Returns a { destroy } controller so the caller can clean up on unmount.
 */
export function createYouTubePlayer(
  opts: CreateYouTubePlayerOptions,
): YouTubePlayerController {
  let player: YTPlayer | null = null;
  let destroyed = false;

  function setup() {
    if (destroyed || !window.YT) return;
    player = new window.YT.Player(opts.container, {
      videoId: opts.videoId,
      playerVars: {
        ...(opts.startAt !== undefined && { start: Math.floor(opts.startAt) }),
        enablejsapi: 1,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          if (destroyed || !player) return;
          opts.onHandleReady(buildYouTubeHandle(player));
        },
        onStateChange: (event) => {
          if (destroyed || !player) return;
          const t = player.getCurrentTime();
          if (event.data === 1 /* PLAYING */) opts.onPlay(t);
          else if (event.data === 2 /* PAUSED */) opts.onPause(t);
          else if (event.data === 0 /* ENDED */) opts.onEnded(t);
        },
      },
    });
  }

  // If the API is already loaded, set up synchronously so tests and fast
  // re-mounts don't wait for a microtask flush.
  if (window.YT?.Player) {
    setup();
  } else {
    void loadYouTubeAPI().then(setup);
  }

  return {
    destroy: () => {
      destroyed = true;
      player?.destroy();
      player = null;
    },
  };
}

// ── React component ───────────────────────────────────────────────────────────

export interface YouTubePlayerProps {
  videoId: string;
  startAt?: number;
  onHandleReady: (handle: PlaybackHandle) => void;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onEnded: (currentTime: number) => void;
}

/**
 * Renders a div the IFrame API replaces with an iframe.
 * Exposes playback events upward via callbacks.
 */
export function YouTubePlayer({
  videoId,
  startAt,
  onHandleReady,
  onPlay,
  onPause,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const { destroy } = createYouTubePlayer({
      container: containerRef.current,
      videoId,
      startAt,
      onHandleReady,
      onPlay,
      onPause,
      onEnded,
    });
    return destroy;
  }, [videoId]); // re-mount player only when videoId changes

  return (
    <div
      ref={containerRef}
      data-testid="mediaPlayer-youtube"
      style={{ width: "100%", aspectRatio: "16/9" }}
    />
  );
}
