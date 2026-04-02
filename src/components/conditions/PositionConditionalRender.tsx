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
  if (position === undefined || position === null) return <>{children}</>;

  // Defensive coercion — host platforms may pass position as a string
  const numPosition =
    typeof position === "number" ? position : Number(position);
  if (Number.isNaN(numPosition)) return <>{children}</>;

  if (showToPositions && !showToPositions.includes(numPosition)) return null;
  if (hideFromPositions && hideFromPositions.includes(numPosition)) return null;

  return <>{children}</>;
}
