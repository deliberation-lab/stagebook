import React from "react";

export interface LoadingProps {
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 32,
};

export function Loading({ size = "md" }: LoadingProps) {
  const px = sizeMap[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Loading"
        style={{
          animation: "score-spin 1s linear infinite",
          color: "#9ca3af",
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          opacity="0.25"
        />
        <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <style>{`
        @keyframes score-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
