// Pure waveform capture logic — no React/DOM dependencies.
// Used by MediaPlayer to accumulate peak data from AnalyserNodes.

/**
 * Hard cap on the number of buckets allocated per channel. At the default
 * 10 buckets/second this caps memory at ~16 MB per channel (8 bytes per
 * Float32 × 2 entries × 1_000_000 buckets), which is ~28 hours of audio.
 * Beyond this, we degrade gracefully — capture still runs but the buffer
 * stops growing rather than blowing up memory on pathological inputs.
 */
export const MAX_BUCKETS = 1_000_000;

/**
 * How many time buckets are needed to cover the given duration.
 * Returns 0 for non-finite or non-positive durations, capped at MAX_BUCKETS.
 */
export function computeBucketCount(
  duration: number,
  bucketsPerSecond: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(Math.ceil(duration * bucketsPerSecond), MAX_BUCKETS);
}

/**
 * Map a playback time to a bucket index. Clamps negative times to 0.
 */
export function timeToBucket(time: number, bucketsPerSecond: number): number {
  return Math.floor(Math.max(0, time) * bucketsPerSecond);
}

/**
 * Create the peaks storage arrays for all channels.
 * Each array has `2 * bucketCount` elements: interleaved [min, max] per bucket.
 * Initialized with sentinel values (min=1, max=-1) so we can detect
 * which buckets have been filled.
 */
export function createPeaksArrays(
  channelCount: number,
  bucketCount: number,
): Float32Array[] {
  const arrays: Float32Array[] = [];
  for (let ch = 0; ch < channelCount; ch++) {
    const arr = new Float32Array(bucketCount * 2);
    for (let i = 0; i < bucketCount; i++) {
      arr[i * 2] = 1; // min sentinel
      arr[i * 2 + 1] = -1; // max sentinel
    }
    arrays.push(arr);
  }
  return arrays;
}

/**
 * Accumulate one frame of analyser data into the peaks arrays.
 *
 * @param peaks - Per-channel Float32Arrays (interleaved min/max)
 * @param analyserBuffers - Per-channel Uint8Array from getByteTimeDomainData()
 * @param currentTime - Current playback position in seconds
 * @param bucketsPerSecond - Resolution of the peaks data
 */
export function accumulatePeaks(
  peaks: Float32Array[],
  analyserBuffers: Uint8Array[],
  currentTime: number,
  bucketsPerSecond: number,
): void {
  const bucket = timeToBucket(currentTime, bucketsPerSecond);

  for (let ch = 0; ch < peaks.length; ch++) {
    const peakArr = peaks[ch];
    const data = analyserBuffers[ch];
    if (!peakArr || !data) continue;

    const bucketCount = peakArr.length / 2;
    if (bucket >= bucketCount) continue;

    // Find min/max of this frame's samples, normalized to [-1, 1]
    let frameMin = 1;
    let frameMax = -1;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      if (normalized < frameMin) frameMin = normalized;
      if (normalized > frameMax) frameMax = normalized;
    }

    // Update the bucket: expand the min/max envelope
    const minIdx = bucket * 2;
    const maxIdx = bucket * 2 + 1;
    const existingMin = peakArr[minIdx];
    const existingMax = peakArr[maxIdx];

    if (frameMin < existingMin) peakArr[minIdx] = frameMin;
    if (frameMax > existingMax) peakArr[maxIdx] = frameMax;
  }
}
