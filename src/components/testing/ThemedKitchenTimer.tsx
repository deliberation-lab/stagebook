/**
 * Test wrapper that renders a KitchenTimer with overridden CSS variables.
 */
import React from "react";
import { KitchenTimer } from "../elements/KitchenTimer.js";

export interface ThemedKitchenTimerProps {
  startTime: number;
  endTime: number;
  warnTimeRemaining?: number;
  elapsedTime: number;
  themeOverrides?: Record<string, string>;
}

export function ThemedKitchenTimer({
  startTime,
  endTime,
  warnTimeRemaining = 10,
  elapsedTime,
  themeOverrides = {},
}: ThemedKitchenTimerProps) {
  const cssText = Object.entries(themeOverrides)
    .map(([key, value]) => `${key}: ${value};`)
    .join(" ");

  return (
    <>
      <style>{`:root { ${cssText} }`}</style>
      <KitchenTimer
        startTime={startTime}
        endTime={endTime}
        warnTimeRemaining={warnTimeRemaining}
        getElapsedTime={() => elapsedTime}
      />
    </>
  );
}
