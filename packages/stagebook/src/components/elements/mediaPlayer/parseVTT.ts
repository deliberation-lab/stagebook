export interface CaptionCue {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Parses a WebVTT string into an array of caption cues.
 *
 * Handles:
 *   - UTF-8 BOM
 *   - CRLF line endings
 *   - Cue identifiers (numeric or text labels)
 *   - Multiline cue text
 *   - NOTE and STYLE blocks (skipped)
 *   - Both mm:ss.mmm and hh:mm:ss.mmm timestamp formats
 *
 * Does not merge overlapping cues — returns them as-is.
 */
export function parseVTT(content: string): CaptionCue[] {
  // Strip BOM and normalize line endings
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");

  if (!normalized.startsWith("WEBVTT")) return [];

  // Split into blocks by blank lines
  const blocks = normalized.split(/\n\n+/);

  const cues: CaptionCue[] = [];

  for (const block of blocks.slice(1)) {
    const lines = block.trim().split("\n");
    if (lines.length === 0) continue;

    // Skip NOTE and STYLE blocks
    if (lines[0].startsWith("NOTE") || lines[0].startsWith("STYLE")) continue;

    let timingLineIndex = 0;

    // If the first line doesn't contain '-->', treat it as a cue identifier
    if (!lines[0].includes("-->")) {
      timingLineIndex = 1;
    }

    if (timingLineIndex >= lines.length) continue;

    const timingLine = lines[timingLineIndex];
    if (!timingLine?.includes("-->")) continue;

    const [startStr, endStr] = timingLine.split("-->").map((s) => s.trim());
    if (!startStr || !endStr) continue;

    const startTime = parseTimestamp(startStr);
    const endTime = parseTimestamp(endStr.split(" ")[0]); // strip cue settings

    if (startTime === null || endTime === null) continue;

    const text = lines.slice(timingLineIndex + 1).join("\n");
    if (text.length === 0) continue;

    cues.push({ startTime, endTime, text });
  }

  return cues;
}

/** Parses hh:mm:ss.mmm or mm:ss.mmm into seconds. Returns null if invalid. */
function parseTimestamp(ts: string): number | null {
  // Match hh:mm:ss.mmm or mm:ss.mmm
  const match = ts.match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const millis = parseInt(match[4], 10);

  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}
