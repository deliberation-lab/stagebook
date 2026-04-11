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

  /** Number of audio channels in the media. 0 until waveform capture starts. */
  readonly channelCount: number;

  /**
   * Per-channel waveform peaks. One Float32Array per channel, containing
   * interleaved min/max pairs per time bucket. Empty until capture starts.
   * Shared across all timelines — read-only.
   */
  readonly peaks: Float32Array[];

  /**
   * Request the MediaPlayer to start capturing waveform data.
   * Lazily creates AudioContext + AnalyserNodes on first call.
   * No-op on subsequent calls. No-op for YouTube sources.
   */
  requestWaveformCapture(): void;
}
