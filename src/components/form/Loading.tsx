import React from "react";

export interface LoadingProps {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function Loading({ size = "md" }: LoadingProps) {
  return (
    <div className="flex items-center justify-center p-4">
      <svg
        className={`animate-spin ${sizes[size]} text-gray-400`}
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Loading"
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
    </div>
  );
}
