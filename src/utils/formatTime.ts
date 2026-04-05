/**
 * Format a duration in seconds as a human-readable time string.
 * Under an hour: "M:SS". One hour or more: "H:MM:SS".
 * Non-finite input (NaN, Infinity) returns "0:00".
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${String(h)}:${String(m).padStart(2, "0")}:${ss}`;
  }
  return `${String(m)}:${ss}`;
}
