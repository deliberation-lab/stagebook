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

    if (!peaks || endBucket <= startBucket) return;

    const visibleBuckets = endBucket - startBucket;
    const barWidth = width / visibleBuckets;
    const midY = height / 2;

    ctx.fillStyle =
      getComputedStyle(canvas).getPropertyValue("--stagebook-waveform-color") ||
      "#6b7280";

    for (let i = 0; i < visibleBuckets; i++) {
      const bucketIdx = startBucket + i;
      const minIdx = bucketIdx * 2;
      const maxIdx = bucketIdx * 2 + 1;

      const minVal = peaks[minIdx];
      const maxVal = peaks[maxIdx];

      // Skip unfilled buckets (sentinel: min=1, max=-1)
      if (minVal === undefined || maxVal === undefined || minVal > maxVal)
        continue;

      // Map [-1, 1] amplitude to pixel offset from midline
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
