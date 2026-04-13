import React, { useState, useEffect } from "react";

export interface TimeConditionalRenderProps {
  displayTime?: number;
  hideTime?: number;
  getElapsedTime: () => number;
  children: React.ReactNode;
}

export function TimeConditionalRender({
  displayTime,
  hideTime,
  getElapsedTime,
  children,
}: TimeConditionalRenderProps) {
  const [, setTick] = useState(false);

  useEffect(() => {
    if (!displayTime && !hideTime) return () => undefined;

    const interval = setInterval(() => setTick((prev) => !prev), 1000);
    return () => clearInterval(interval);
  }, [displayTime, hideTime]);

  const elapsed = getElapsedTime();

  if (displayTime && elapsed < displayTime) return null;
  if (hideTime && elapsed > hideTime) return null;

  return <>{children}</>;
}
