import React, { useRef, useEffect } from "react";

export interface WaveformRendererProps {
  /** Interleaved min/max pairs per time bucket. */
  peaks: Float32Array | null;
  /**
   * Render token. The peaks array is mutated in place during capture, so
   * its reference doesn't change. Bumping this counter (in MediaPlayer's
   * RAF accumulation loop, polled by Timeline) tells this component to
   * redraw with the new data.
   */
  peaksVersion: number;
  /** Width of the canvas in CSS pixels. */
  width: number;
  /** Height of the canvas in CSS pixels. */
  height: number;
  /** Index of the first visible bucket. */
  startBucket: number;
  /** Index of the last visible bucket (exclusive). */
  endBucket: number;
}

/**
 * Pure canvas waveform renderer. Draws min/max amplitude bars centered
 * on the horizontal midline. Handles empty/partial peaks gracefully.
 */
export function WaveformRenderer({
  peaks,
  peaksVersion,
  width,
  height,
  startBucket,
  endBucket,
}: WaveformRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    // Use setTransform (not scale) so repeated draws don't compound the
    // DPR scaling on top of itself.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    // Track-lane background band — covers ~90% of the vertical space, giving
    // a visible "this is the track area" frame even when the waveform is
    // silent or not yet captured. Themed via --stagebook-waveform-track-bg.
    const computed = getComputedStyle(canvas);
    const trackBg =
      computed.getPropertyValue("--stagebook-waveform-track-bg").trim() ||
      "rgba(128, 128, 128, 0.15)";
    ctx.fillStyle = trackBg;
    ctx.fillRect(0, height * 0.05, width, height * 0.9);

    if (!peaks || endBucket <= startBucket) return;

    const visibleBuckets = endBucket - startBucket;
    const midY = height / 2;

    ctx.fillStyle =
      computed.getPropertyValue("--stagebook-waveform-color") || "#6b7280";

    // Two render paths:
    //   buckets <= width  → one bar per bucket (existing behavior, faithful
    //                       to source resolution)
    //   buckets >  width  → one bar per canvas pixel, aggregating min/max
    //                       across the buckets that map to that pixel. This
    //                       is what the minimap exercises: a 1h recording at
    //                       10 buckets/s = 36k buckets compressed into ~700
    //                       canvas pixels — drawing 36k overlapping 1px bars
    //                       per redraw is wasteful (cost is O(buckets), up to
    //                       MAX_BUCKETS = 1M) and overdraws every pixel many
    //                       times. The aggregation path caps cost at O(width).
    if (visibleBuckets <= width) {
      const barWidth = width / visibleBuckets;
      for (let i = 0; i < visibleBuckets; i++) {
        const bucketIdx = startBucket + i;
        const minVal = peaks[bucketIdx * 2];
        const maxVal = peaks[bucketIdx * 2 + 1];

        // Skip unfilled buckets (sentinel: min=1, max=-1)
        if (minVal === undefined || maxVal === undefined || minVal > maxVal)
          continue;

        const topOffset = maxVal * midY;
        const bottomOffset = minVal * midY;

        const x = i * barWidth;
        const barTop = midY - topOffset;
        const barHeight = topOffset - bottomOffset;

        ctx.fillRect(
          x,
          barTop,
          Math.max(barWidth - 0.5, 1),
          Math.max(barHeight, 1),
        );
      }
    } else {
      const bucketsPerPixel = visibleBuckets / width;
      const pixelWidth = Math.floor(width);
      for (let px = 0; px < pixelWidth; px++) {
        const startB = startBucket + Math.floor(px * bucketsPerPixel);
        const endB = startBucket + Math.floor((px + 1) * bucketsPerPixel);

        let minVal = 1;
        let maxVal = -1;
        for (let b = startB; b < endB; b++) {
          const m = peaks[b * 2];
          const M = peaks[b * 2 + 1];
          if (m === undefined || M === undefined || m > M) continue;
          if (m < minVal) minVal = m;
          if (M > maxVal) maxVal = M;
        }
        // No filled buckets in this pixel range
        if (minVal > maxVal) continue;

        const topOffset = maxVal * midY;
        const bottomOffset = minVal * midY;
        const barTop = midY - topOffset;
        const barHeight = topOffset - bottomOffset;

        ctx.fillRect(px, barTop, 1, Math.max(barHeight, 1));
      }
    }
  }, [peaks, peaksVersion, width, height, startBucket, endBucket]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="waveform-canvas"
      style={{
        width: `${String(width)}px`,
        height: `${String(height)}px`,
        display: "block",
      }}
    />
  );
}
