import React, { useState, useEffect } from "react";

export interface KitchenTimerProps {
  startTime: number;
  endTime: number;
  warnTimeRemaining?: number;
  getElapsedTime: () => number;
}

export function KitchenTimer({
  startTime,
  endTime,
  warnTimeRemaining = 10,
  getElapsedTime,
}: KitchenTimerProps) {
  // Re-render periodically to update the timer display
  const [, setTick] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTick((prev) => !prev), 1000);
    return () => clearInterval(interval);
  }, []);

  const stageElapsed = getElapsedTime();
  const timerDuration = endTime - startTime;

  let timerElapsed = 0;
  let timerRemaining = timerDuration;

  if (stageElapsed > startTime) {
    timerElapsed = stageElapsed - startTime;
    timerRemaining = endTime - stageElapsed;
  }

  if (stageElapsed > endTime) {
    timerElapsed = timerDuration;
    timerRemaining = 0;
  }

  const percent = Math.min((timerElapsed / timerDuration) * 100, 100);
  const displayRemaining = new Date(1000 * Math.max(timerRemaining, 0))
    .toISOString()
    .slice(timerRemaining < 3600 ? 14 : 11, 19);

  const isWarning = timerRemaining <= warnTimeRemaining;
  const barColor = isWarning
    ? "var(--stagebook-danger, #ef4444)"
    : "var(--stagebook-timer-fill, #60a5fa)"; // red-500 / blue-400

  return (
    <div
      style={{
        margin: "0.375rem",
        maxWidth: "36rem",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
      }}
      data-testid="kitchen-timer"
      data-state={isWarning ? "warning" : "normal"}
    >
      {/* Progress bar */}
      <div
        style={{
          position: "relative",
          flex: 1,
          height: "1.5rem",
          backgroundColor: "var(--stagebook-bg-track, #e5e7eb)",
          borderRadius: "9999px",
          overflow: "hidden",
        }}
      >
        <div
          data-testid="timer-fill"
          style={{
            height: "100%",
            borderRadius: "9999px",
            width: `${percent}%`,
            backgroundColor: barColor,
            transition: "width 1s linear, background-color 0.3s ease",
          }}
        />
      </div>
      {/* Time label to the right */}
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--stagebook-text-secondary, #374151)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          minWidth: "3rem",
          textAlign: "right",
        }}
      >
        {displayRemaining}
      </span>
    </div>
  );
}
