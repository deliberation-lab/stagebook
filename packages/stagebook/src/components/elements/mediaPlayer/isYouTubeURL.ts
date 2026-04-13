/**
 * Detects whether a URL points to a YouTube video and extracts the video ID.
 * Returns the video ID string if it is a YouTube URL, or null otherwise.
 *
 * Supported formats:
 *   https://www.youtube.com/watch?v=VIDEO_ID
 *   https://youtu.be/VIDEO_ID
 *   https://www.youtube.com/embed/VIDEO_ID
 *   https://youtube.com/watch?v=VIDEO_ID
 *   https://m.youtube.com/watch?v=VIDEO_ID
 */
export function isYouTubeURL(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const { hostname, pathname, searchParams } = parsed;

  // Validate hostname: youtube.com (with optional www. or m. prefix) or youtu.be
  const isYouTubeDomain =
    hostname === "youtube.com" ||
    hostname === "www.youtube.com" ||
    hostname === "m.youtube.com" ||
    hostname === "youtu.be";

  if (!isYouTubeDomain) return null;

  // youtu.be/<videoId>
  if (hostname === "youtu.be") {
    const id = pathname.slice(1).split("?")[0];
    return id.length > 0 ? id : null;
  }

  // youtube.com/embed/<videoId>
  if (pathname.startsWith("/embed/")) {
    const id = pathname.slice("/embed/".length);
    return id.length > 0 ? id : null;
  }

  // youtube.com/watch?v=<videoId>
  const videoId = searchParams.get("v");
  return videoId && videoId.length > 0 ? videoId : null;
}
