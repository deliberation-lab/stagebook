/**
 * Inline SVG icons for MediaPlayer controls.
 * Self-contained — no external icon library dependency.
 * All icons sized at 20×20, strokeWidth 2, rounded line caps.
 */
import React from "react";

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function PlayIcon() {
  return (
    <svg {...iconProps}>
      {/* Filled triangle for play */}
      <polygon points="5,3 17,10 5,17" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg {...iconProps}>
      <rect
        x="4"
        y="3"
        width="4"
        height="14"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="12"
        y="3"
        width="4"
        height="14"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function SeekBackIcon() {
  return (
    <svg {...iconProps}>
      {/* Left-pointing curved arrow */}
      <path d="M4 10 A6 6 0 1 1 7.5 15.5" />
      <polyline points="4,6 4,10 8,10" />
      <text
        x="10"
        y="11"
        fontSize="5"
        fontWeight="bold"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="sans-serif"
      >
        1s
      </text>
    </svg>
  );
}

export function SeekForwardIcon() {
  return (
    <svg {...iconProps}>
      {/* Right-pointing curved arrow */}
      <path d="M16 10 A6 6 0 1 0 12.5 15.5" />
      <polyline points="16,6 16,10 12,10" />
      <text
        x="10"
        y="11"
        fontSize="5"
        fontWeight="bold"
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="sans-serif"
      >
        1s
      </text>
    </svg>
  );
}

export function StepBackIcon() {
  return (
    <svg {...iconProps}>
      {/* Bar + left triangle */}
      <rect
        x="3"
        y="3"
        width="2.5"
        height="14"
        rx="0.5"
        fill="currentColor"
        stroke="none"
      />
      <polygon points="16,3 7,10 16,17" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StepForwardIcon() {
  return (
    <svg {...iconProps}>
      {/* Right triangle + bar */}
      <polygon points="4,3 13,10 4,17" fill="currentColor" stroke="none" />
      <rect
        x="14.5"
        y="3"
        width="2.5"
        height="14"
        rx="0.5"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
