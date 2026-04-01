/**
 * Test wrapper for KitchenTimer that provides getElapsedTime internally.
 * Needed because Playwright CT can't serialize function props that return values.
 */
import React from "react";
import { KitchenTimer } from "../elements/KitchenTimer.js";

export interface MockKitchenTimerProps {
  startTime: number;
  endTime: number;
  warnTimeRemaining?: number;
  elapsedTime: number;
}

export function MockKitchenTimer({
  startTime,
  endTime,
  warnTimeRemaining,
  elapsedTime,
}: MockKitchenTimerProps) {
  return (
    <KitchenTimer
      startTime={startTime}
      endTime={endTime}
      warnTimeRemaining={warnTimeRemaining}
      getElapsedTime={() => elapsedTime}
    />
  );
}
