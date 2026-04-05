/**
 * Inline SVG icons for MediaPlayer controls.
 * Self-contained — no external icon library dependency.
 * All icons use fill="currentColor" to inherit text color from parent.
 */
import React from "react";

export function PlayIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

export function SeekBackIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Counter-clockwise arrow */}
      <path d="M12.5 8C9.46 8 7 10.46 7 13.5S9.46 19 12.5 19c2.6 0 4.8-1.8 5.36-4.24h-1.44c-.52 1.7-2.08 2.94-3.92 2.94C10.02 17.7 8.3 15.98 8.3 13.5S10.02 9.3 12.5 9.3V12l4-3.5L12.5 5v3z" />
    </svg>
  );
}

export function SeekForwardIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Clockwise arrow */}
      <path d="M11.5 8C14.54 8 17 10.46 17 13.5S14.54 19 11.5 19c-2.6 0-4.8-1.8-5.36-4.24h1.44c.52 1.7 2.08 2.94 3.92 2.94 2.48 0 4.2-1.72 4.2-4.2S13.98 9.3 11.5 9.3V12l-4-3.5L11.5 5v3z" />
    </svg>
  );
}

export function StepBackIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Bar + left-pointing triangle */}
      <rect x="5" y="5" width="3" height="14" rx="0.5" />
      <path d="M19 5l-10 7 10 7V5z" />
    </svg>
  );
}

export function StepForwardIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Right-pointing triangle + bar */}
      <path d="M5 5l10 7-10 7V5z" />
      <rect x="16" y="5" width="3" height="14" rx="0.5" />
    </svg>
  );
}
