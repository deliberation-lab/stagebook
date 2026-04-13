/**
 * Determines if a scroll container is at or near the bottom.
 */
export function isAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 80,
): boolean {
  if (scrollHeight <= 0 || clientHeight <= 0) {
    return true; // No scrollable content — consider "at bottom"
  }
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  return distanceFromBottom < threshold;
}
