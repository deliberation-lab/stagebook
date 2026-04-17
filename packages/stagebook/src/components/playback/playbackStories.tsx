/**
 * Story components for PlaybackProvider CT tests.
 * Must live in a separate file — Playwright CT cannot mount components
 * defined inside a test file.
 */
import React from "react";
import { useRegisterPlayback, usePlayback } from "./PlaybackProvider.js";
import { TestProvider } from "./TestProvider.js";
import { MockMediaPlayer } from "../testing/MockMediaPlayer.js";
import type { PlaybackHandle } from "./PlaybackHandle.js";

export function makeHandle(
  overrides: Partial<PlaybackHandle> = {},
): PlaybackHandle {
  return {
    play: () => {},
    pause: () => {},
    seekTo: () => {},
    getCurrentTime: () => 0,
    getDuration: () => 60,
    isPaused: () => true,
    isYouTube: false,
    channelCount: 0,
    peaks: [],
    peaksVersion: 0,
    requestWaveformCapture() {},
    setChannelMuted() {},
    isChannelMuted: () => false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function Registrar({
  name,
  handle,
}: {
  name: string;
  handle: PlaybackHandle;
}) {
  useRegisterPlayback(name, handle);
  return null;
}

export function Consumer({ source }: { source: string }) {
  const handle = usePlayback(source);
  return (
    <div>
      <div data-testid="status">{handle ? "found" : "not-found"}</div>
      <div data-testid="currentTime">
        {handle ? String(handle.getCurrentTime()) : "n/a"}
      </div>
      <div data-testid="duration">
        {handle ? String(handle.getDuration()) : "n/a"}
      </div>
    </div>
  );
}

export function HandleChecker({ source }: { source: string }) {
  const handle = usePlayback(source);
  return <div data-testid="present">{handle ? "yes" : "no"}</div>;
}

// ---------------------------------------------------------------------------
// Composed stories
// ---------------------------------------------------------------------------

export function NotFoundStory() {
  return (
    <TestProvider>
      <Consumer source="missing" />
    </TestProvider>
  );
}

export function RegisteredHandleStory() {
  const handle = makeHandle({ getCurrentTime: () => 5, getDuration: () => 30 });
  return (
    <TestProvider>
      <Registrar name="my_player" handle={handle} />
      <Consumer source="my_player" />
    </TestProvider>
  );
}

export function WrongNameStory() {
  return (
    <TestProvider>
      <Registrar name="player_a" handle={makeHandle()} />
      <Consumer source="player_b" />
    </TestProvider>
  );
}

export function UnmountStory({ show }: { show: boolean }) {
  return (
    <TestProvider>
      {show && <Registrar name="temp" handle={makeHandle()} />}
      <Consumer source="temp" />
    </TestProvider>
  );
}

export function MediaPlayerInProviderStory() {
  return (
    <TestProvider>
      <MockMediaPlayer url="https://example.com/test.mp4" name="vid" />
      <HandleChecker source="vid" />
    </TestProvider>
  );
}
