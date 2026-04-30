import React from "react";
import {
  evaluateConditions,
  type Condition,
  type ConditionNode,
} from "../../utils/evaluateConditions.js";

export type { Condition, ConditionNode };

export interface ConditionsConditionalRenderProps {
  /** A `conditions:` value: a flat array (implicit `all`), an operator
   *  node (`{all|any|none: [...]}`), a single leaf condition, or
   *  null/undefined (which renders children unconditionally). */
  conditions: ConditionNode[] | ConditionNode | null | undefined;
  resolve: (reference: string, position?: string) => unknown[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders `children` when the condition tree evaluates to true,
 * `fallback` otherwise. Delegates to `evaluateConditions`, which
 * handles all three shapes (array sugar, operator node, leaf) and
 * collapses the tri-state "data not yet" case to false.
 */
export function ConditionsConditionalRender({
  conditions,
  resolve,
  children,
  fallback = null,
}: ConditionsConditionalRenderProps) {
  if (
    conditions === undefined ||
    conditions === null ||
    (Array.isArray(conditions) && conditions.length === 0)
  ) {
    return <>{children}</>;
  }
  const conditionMet = evaluateConditions(conditions, resolve);
  return <>{conditionMet ? children : fallback}</>;
}
