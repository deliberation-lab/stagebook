// Pure layout helpers for the timeline visual components.
// No React/DOM dependencies.

/**
 * Convert a time (seconds) to a pixel position within the container.
 *
 * @param time - Time in seconds
 * @param duration - Total media duration in seconds
 * @param containerWidth - Width of the waveform area in pixels
 * @param zoomLevel - 1 = full duration visible, 2 = half visible, etc.
 * @param viewportStart - Left edge of the visible region in seconds
 */
export function timeToPixel(
  time: number,
  duration: number,
  containerWidth: number,
  zoomLevel: number,
  viewportStart: number,
): number {
  const visibleDuration = duration / zoomLevel;
  const pixelsPerSecond = containerWidth / visibleDuration;
  return (time - viewportStart) * pixelsPerSecond;
}

/**
 * Convert a pixel position to a time (seconds). Inverse of timeToPixel.
 */
export function pixelToTime(
  pixel: number,
  duration: number,
  containerWidth: number,
  zoomLevel: number,
  viewportStart: number,
): number {
  const visibleDuration = duration / zoomLevel;
  const pixelsPerSecond = containerWidth / visibleDuration;
  return pixel / pixelsPerSecond + viewportStart;
}

/**
 * Choose an appropriate tick interval (seconds) based on pixels-per-second.
 * Higher pixel density (more zoomed in) → finer ticks.
 * Returns the smallest interval whose pixel spacing is still >= 60px.
 */
export function computeTickInterval(pixelsPerSecond: number): number {
  const candidates = [0.1, 0.5, 1, 5, 10, 30, 60];
  // Walk from finest to coarsest, return first with adequate spacing
  for (let i = 0; i < candidates.length; i++) {
    const interval = candidates[i];
    const tickSpacing = interval * pixelsPerSecond;
    if (tickSpacing >= 60) return interval;
  }
  return 60;
}

/**
 * Generate tick positions (in seconds) within a visible time range.
 *
 * @param visibleStart - Start of visible range in seconds
 * @param visibleEnd - End of visible range in seconds
 * @param interval - Tick spacing in seconds
 */
export function generateTicks(
  visibleStart: number,
  visibleEnd: number,
  interval: number,
): number[] {
  const ticks: number[] = [];
  // Align first tick to interval boundary
  const firstTick = Math.ceil(visibleStart / interval) * interval;
  for (let t = firstTick; t <= visibleEnd + interval * 0.001; t += interval) {
    ticks.push(Math.round(t * 1000) / 1000); // avoid floating point drift
  }
  return ticks;
}
