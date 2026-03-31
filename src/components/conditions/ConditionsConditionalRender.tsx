import React from "react";
import { compare } from "../../utils/compare.js";

export interface Condition {
  reference: string;
  position?: string;
  comparator: string;
  value?: unknown;
  promptName?: string; // deprecated alias
}

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
  const { position, comparator, value } = condition;
  let { reference } = condition;

  // Backwards compat: promptName → reference
  if (condition.promptName) {
    reference = `prompt.${condition.promptName}`;
  }

  const referenceValues = resolve(reference, position);

  let conditionMet = false;
  if (position === "percentAgreement") {
    const counts: Record<string, number> = {};
    const definedValues = referenceValues.filter((val) => val !== undefined);

    if (definedValues.length === 0) {
      conditionMet = false;
    } else {
      definedValues.forEach((val) => {
        const cleanValue =
          typeof val === "string"
            ? val.toLowerCase().trim()
            : `${val as string | number | boolean}`;
        counts[cleanValue] = (counts[cleanValue] || 0) + 1;
      });
      const maxCount = Math.max(...Object.values(counts));
      conditionMet =
        compare(
          (maxCount / referenceValues.length) * 100,
          comparator as Parameters<typeof compare>[1],
          value,
        ) === true;
    }
  } else if (position === "any") {
    conditionMet = referenceValues.some(
      (val) =>
        compare(val, comparator as Parameters<typeof compare>[1], value) ===
        true,
    );
  } else {
    conditionMet = referenceValues.every(
      (val) =>
        compare(val, comparator as Parameters<typeof compare>[1], value) ===
        true,
    );
  }

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
