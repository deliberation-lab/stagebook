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
   *
   * IMPORTANT: these arrays are mutated in place during capture. Consumers
   * that need to know when the data changed should read `peaksVersion`,
   * which bumps every time a frame is accumulated.
   */
  readonly peaks: Float32Array[];

  /**
   * Monotonically increasing counter that bumps every time `peaks` is
   * mutated by the capture loop. Use this as a render-token in React effects
   * (e.g., a canvas redraw effect) so they re-run when peaks change despite
   * the array reference being stable.
   */
  readonly peaksVersion: number;

  /**
   * Request the MediaPlayer to start capturing waveform data.
   * Lazily creates AudioContext + AnalyserNodes on first call.
   * No-op on subsequent calls. No-op for YouTube sources.
   */
  requestWaveformCapture(): void;
}
