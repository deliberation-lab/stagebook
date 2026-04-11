/**
 * Test wrapper for Timeline. Provides a PlaybackProvider with an optional
 * mock PlaybackHandle registered under a given name. Exposes save calls
 * via the DOM so Playwright can assert on them.
 *
 * IMPORTANT: Playwright CT cannot serialize function props across the worker
 * boundary. So instead of accepting `handleOverrides: Partial<PlaybackHandle>`
 * (which contains methods), this wrapper accepts plain serializable values
 * (numbers/booleans) and constructs the handle internally.
 */
import React, { useMemo, useState } from "react";
import { Timeline, type TimelineProps } from "../elements/Timeline.js";
import {
  PlaybackProvider,
  useRegisterPlayback,
} from "../playback/PlaybackProvider.js";
import type { PlaybackHandle } from "../playback/PlaybackHandle.js";

/** Plain-value config for the mock handle (serializable across CT boundary). */
export interface MockHandleConfig {
  duration?: number;
  currentTime?: number;
  paused?: boolean;
  channelCount?: number;
}

function makeMockHandle(config: MockHandleConfig): PlaybackHandle {
  const {
    duration = 60,
    currentTime = 0,
    paused = true,
    channelCount = 0,
  } = config;
  return {
    play() {},
    pause() {},
    seekTo() {},
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    isPaused: () => paused,
    isYouTube: false,
    channelCount,
    peaks: [],
    requestWaveformCapture() {},
  };
}

/** Registers a mock handle inside the PlaybackProvider. */
function MockPlayer({
  name,
  handle,
}: {
  name: string;
  handle: PlaybackHandle;
}) {
  useRegisterPlayback(name, handle);
  return null;
}

export interface MockTimelineProps extends Omit<TimelineProps, "save"> {
  /** Name of the mock player to register. Omit to test the "no player" case. */
  playerName?: string;
  /** Plain-value overrides for the mock PlaybackHandle. */
  mockDuration?: number;
  mockCurrentTime?: number;
  mockPaused?: boolean;
  mockChannelCount?: number;
}

export function MockTimeline({
  playerName,
  mockDuration,
  mockCurrentTime,
  mockPaused,
  mockChannelCount,
  ...props
}: MockTimelineProps) {
  const [saves, setSaves] = useState<Array<{ key: string; value: unknown }>>(
    [],
  );

  // Memoize the handle so its identity is stable across re-renders.
  const handle = useMemo(
    () =>
      makeMockHandle({
        duration: mockDuration,
        currentTime: mockCurrentTime,
        paused: mockPaused,
        channelCount: mockChannelCount,
      }),
    [mockDuration, mockCurrentTime, mockPaused, mockChannelCount],
  );

  return (
    <PlaybackProvider>
      {playerName && <MockPlayer name={playerName} handle={handle} />}
      {/* Force a fixed width so ResizeObserver in tests has a known size. */}
      <div style={{ width: "800px" }}>
        <Timeline
          {...props}
          save={(key, value) => setSaves((prev) => [...prev, { key, value }])}
        />
      </div>
      <div data-testid="save-log" style={{ display: "none" }}>
        {JSON.stringify(saves)}
      </div>
    </PlaybackProvider>
  );
}
