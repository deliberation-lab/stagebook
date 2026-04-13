import React from "react";
import {
  evaluateCondition,
  type Condition,
} from "../../utils/evaluateConditions.js";

export type { Condition };

export interface ConditionsConditionalRenderProps {
  conditions: Condition[];
  resolve: (reference: string, position?: string) => unknown[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ConditionsConditionalRender({
  conditions,
  resolve,
  children,
  fallback = null,
}: ConditionsConditionalRenderProps) {
  if (!conditions || !conditions.length) return <>{children}</>;

  return (
    <RecursiveConditionalRender
      conditions={conditions}
      resolve={resolve}
      fallback={fallback}
    >
      {children}
    </RecursiveConditionalRender>
  );
}

function RecursiveConditionalRender({
  conditions,
  resolve,
  children,
  fallback = null,
}: ConditionsConditionalRenderProps) {
  const condition = conditions[0];
  const referenceValues = resolve(condition.reference, condition.position);
  const conditionMet = evaluateCondition(condition, referenceValues);

  if (!conditionMet) return <>{fallback}</>;
  if (conditions.length === 1) return <>{children}</>;

  return (
    <RecursiveConditionalRender
      conditions={conditions.slice(1)}
      resolve={resolve}
      fallback={fallback}
    >
      {children}
    </RecursiveConditionalRender>
  );
}
