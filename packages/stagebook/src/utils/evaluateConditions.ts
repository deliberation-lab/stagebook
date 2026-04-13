import { compare, type Comparator } from "./compare.js";

export interface Condition {
  reference: string;
  position?: string;
  comparator: string;
  value?: unknown;
}

/**
 * Evaluate a single condition against resolved reference values.
 * Returns true if the condition is met, false otherwise.
 */
export function evaluateCondition(
  condition: Condition,
  referenceValues: unknown[],
): boolean {
  const { position, comparator, value } = condition;

  if (position === "percentAgreement") {
    const counts: Record<string, number> = {};
    const definedValues = referenceValues.filter((val) => val !== undefined);

    if (definedValues.length === 0) return false;

    definedValues.forEach((val) => {
      const cleanValue =
        typeof val === "string"
          ? val.toLowerCase().trim()
          : `${val as string | number | boolean}`;
      counts[cleanValue] = (counts[cleanValue] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    return (
      compare(
        (maxCount / referenceValues.length) * 100,
        comparator as Comparator,
        value,
      ) === true
    );
  }

  if (position === "any") {
    return referenceValues.some(
      (val) => compare(val, comparator as Comparator, value) === true,
    );
  }

  // Default: "all" — every value must satisfy
  return referenceValues.every(
    (val) => compare(val, comparator as Comparator, value) === true,
  );
}

/**
 * Evaluate an array of conditions (AND logic).
 * All conditions must be met for the result to be true.
 */
export function evaluateConditions(
  conditions: Condition[],
  resolve: (reference: string, position?: string) => unknown[],
): boolean {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every((condition) => {
    const values = resolve(condition.reference, condition.position);
    return evaluateCondition(condition, values);
  });
}
