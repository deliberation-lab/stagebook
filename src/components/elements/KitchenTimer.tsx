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

  const percent = (timerElapsed / timerDuration) * 100;
  const displayRemaining = new Date(1000 * timerRemaining)
    .toISOString()
    .slice(timerRemaining < 3600 ? 14 : 11, 19);

  const isWarning = timerRemaining <= warnTimeRemaining;

  return (
    <div className="m-6 max-w-xl">
      <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isWarning ? "bg-red-500" : "bg-blue-400"
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {displayRemaining}
        </span>
      </div>
    </div>
  );
}
