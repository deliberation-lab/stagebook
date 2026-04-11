// Pure viewport math for the Timeline. Zoom level + viewport start handling,
// auto-scroll threshold, seek snap, etc. No React/DOM deps.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 32;

/** Default fraction of viewport width at which auto-scroll begins. */
export const AUTO_SCROLL_THRESHOLD = 0.9;

/** Where the playhead lands within the viewport after a seek snap (0..1). */
export const SEEK_SNAP_POSITION = 0.25;

/**
 * Clamp viewport start so the visible region stays inside [0, duration].
 */
export function clampViewportStart(
  start: number,
  duration: number,
  zoomLevel: number,
): number {
  const visibleDuration = duration / zoomLevel;
  const max = Math.max(0, duration - visibleDuration);
  if (start < 0) return 0;
  if (start > max) return max;
  return start;
}

/**
 * Double the zoom level, capped at MAX_ZOOM.
 */
export function zoomIn(currentZoom: number): number {
  return Math.min(currentZoom * 2, MAX_ZOOM);
}

/**
 * Halve the zoom level, capped at MIN_ZOOM.
 */
export function zoomOut(currentZoom: number): number {
  return Math.max(currentZoom / 2, MIN_ZOOM);
}

interface ZoomViewportArgs {
  currentZoom: number;
  newZoom: number;
  duration: number;
  currentViewportStart: number;
  playheadTime: number;
}

/**
 * Compute the new viewport start after zooming. Centers on the playhead
 * if it's within the current viewport, otherwise centers on the viewport
 * midpoint. Clamps to valid range.
 */
export function computeViewportAfterZoom(args: ZoomViewportArgs): number {
  const { currentZoom, newZoom, duration, currentViewportStart, playheadTime } =
    args;

  if (newZoom <= 1) return 0;

  const currentVisible = duration / currentZoom;
  const newVisible = duration / newZoom;
  const viewportEnd = currentViewportStart + currentVisible;

  // Center on playhead if it's in the current viewport, else viewport center
  const playheadInView =
    playheadTime >= currentViewportStart && playheadTime <= viewportEnd;
  const center = playheadInView
    ? playheadTime
    : currentViewportStart + currentVisible / 2;

  const newStart = center - newVisible / 2;
  return clampViewportStart(newStart, duration, newZoom);
}

/**
 * Returns true if the playhead is at or past the auto-scroll threshold
 * (default 90% of viewport width).
 */
export function isPlayheadPastThreshold(
  playheadTime: number,
  viewportStart: number,
  visibleDuration: number,
  threshold = AUTO_SCROLL_THRESHOLD,
): boolean {
  return playheadTime >= viewportStart + visibleDuration * threshold;
}

/**
 * Compute the new viewport start to keep the playhead pinned at the
 * threshold position (e.g., 90%) during continuous playback.
 */
export function computeViewportAfterScroll(
  playheadTime: number,
  visibleDuration: number,
  duration: number,
  threshold = AUTO_SCROLL_THRESHOLD,
): number {
  const newStart = playheadTime - visibleDuration * threshold;
  // Note: using zoomLevel = duration / visibleDuration so clamp can compute max
  const zoomLevel = duration / visibleDuration;
  return clampViewportStart(newStart, duration, zoomLevel);
}

/**
 * Compute the new viewport start to snap the playhead to a target position
 * (e.g., 25% from the left edge) after a seek/scrub.
 */
export function computeViewportAfterSeek(
  playheadTime: number,
  visibleDuration: number,
  duration: number,
  snapPosition = SEEK_SNAP_POSITION,
): number {
  const newStart = playheadTime - visibleDuration * snapPosition;
  const zoomLevel = duration / visibleDuration;
  return clampViewportStart(newStart, duration, zoomLevel);
}
