import type { VideoEvent } from "../components/elements/MediaPlayer.js";

/**
 * Derives watched time ranges from a VideoEvent log.
 *
 * Pairs each "play" event with the next "pause" or "ended" event to form
 * closed intervals, then merges any that overlap or touch. Open intervals
 * (a "play" with no closing event — e.g. mid-playback disconnect) are
 * excluded, as we can't confirm how far the participant actually got.
 *
 * Returns intervals sorted by start time in the form [startSeconds, endSeconds].
 */
export function computeWatchedRanges(events: VideoEvent[]): [number, number][] {
  // 1. Build closed intervals from play → pause/ended pairs
  const intervals: [number, number][] = [];
  let openStart: number | null = null;

  for (const event of events) {
    if (event.type === "play") {
      // Only set start if no interval is already open — prevents duplicate
      // play events (e.g. YouTube PLAYING→BUFFERING→PLAYING) from losing
      // the original start time.
      if (openStart === null) {
        openStart = event.videoTime;
      }
    } else if (
      (event.type === "pause" ||
        event.type === "ended" ||
        event.type === "stopAt") &&
      openStart !== null
    ) {
      intervals.push([openStart, event.videoTime]);
      openStart = null;
    }
    // seek, speed, and unmatched pause/ended are ignored for range tracking
  }
  // open play at end is intentionally excluded

  if (intervals.length === 0) return [];

  // 2. Sort by start time
  intervals.sort((a, b) => a[0] - b[0]);

  // 3. Merge overlapping / adjacent intervals
  const merged: [number, number][] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = intervals[i];
    if (start <= last[1]) {
      // overlapping or touching — extend the end
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
}
