/**
 * Test wrapper for Timeline. Provides a PlaybackProvider with an optional
 * mock PlaybackHandle registered under a given name. Exposes save calls
 * via the DOM so Playwright can assert on them.
 */
import React, { useState } from "react";
import { Timeline, type TimelineProps } from "../elements/Timeline.js";
import {
  PlaybackProvider,
  useRegisterPlayback,
} from "../playback/PlaybackProvider.js";
import type { PlaybackHandle } from "../playback/PlaybackHandle.js";

/** Minimal mock PlaybackHandle for testing. */
function makeMockHandle(overrides?: Partial<PlaybackHandle>): PlaybackHandle {
  return {
    play() {},
    pause() {},
    seekTo() {},
    getCurrentTime: () => 0,
    getDuration: () => 60,
    isPaused: () => true,
    isYouTube: false,
    ...overrides,
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
  /** Override mock PlaybackHandle methods. */
  handleOverrides?: Partial<PlaybackHandle>;
}

export function MockTimeline({
  playerName,
  handleOverrides,
  ...props
}: MockTimelineProps) {
  const [saves, setSaves] = useState<Array<{ key: string; value: unknown }>>(
    [],
  );

  const handle = makeMockHandle(handleOverrides);

  return (
    <PlaybackProvider>
      {playerName && <MockPlayer name={playerName} handle={handle} />}
      <Timeline
        {...props}
        save={(key, value) => setSaves((prev) => [...prev, { key, value }])}
      />
      <div data-testid="save-log" style={{ display: "none" }}>
        {JSON.stringify(saves)}
      </div>
    </PlaybackProvider>
  );
}
