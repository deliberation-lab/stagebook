/**
 * Format a duration in seconds as a human-readable time string.
 * Under an hour: "M:SS". One hour or more: "H:MM:SS".
 * Non-finite input (NaN, Infinity) returns "0:00".
 *
 * @param decimals - Fractional-second digits to show (0, 1, or 2).
 *   0 → "1:23", 1 → "1:23.4", 2 → "1:23.45". Default 0.
 */
export function formatTime(seconds: number, decimals: 0 | 1 | 2 = 0): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");

  let frac = "";
  if (decimals > 0) {
    const fractional = seconds - total;
    const factor = 10 ** decimals;
    // Round to handle FP noise (65.3 - 65 = 0.2999... → 3 not 2),
    // but cap at factor-1 to prevent carry into seconds digit
    // (1.999 - 1 = 0.999 → round to 10, cap to 9 → ".9" not ".0").
    const fracDigits = Math.min(Math.round(fractional * factor), factor - 1);
    frac = "." + String(fracDigits).padStart(decimals, "0");
  }

  if (h > 0) {
    return `${String(h)}:${String(m).padStart(2, "0")}:${ss}${frac}`;
  }
  return `${String(m)}:${ss}${frac}`;
}
