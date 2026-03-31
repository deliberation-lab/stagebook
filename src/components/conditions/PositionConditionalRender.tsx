import React from "react";

export interface PositionConditionalRenderProps {
  showToPositions?: number[];
  hideFromPositions?: number[];
  position: number | undefined;
  children: React.ReactNode;
}

export function PositionConditionalRender({
  showToPositions,
  hideFromPositions,
  position,
  children,
}: PositionConditionalRenderProps) {
  // Position is undefined in intro steps — render everything
  if (position === undefined) return <>{children}</>;

  if (showToPositions && !showToPositions.includes(position)) return null;
  if (hideFromPositions && hideFromPositions.includes(position)) return null;

  return <>{children}</>;
}
