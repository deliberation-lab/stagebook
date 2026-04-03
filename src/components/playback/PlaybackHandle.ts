/** Unified playback interface. Both HTML5 VideoCore and YouTubePlayer expose this via ref. */
export interface PlaybackHandle {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;
  /** True when backed by the YouTube IFrame API; frame-step controls should be hidden. */
  readonly isYouTube: boolean;
}
