/**
 * Scan a stage's elements and extract DSL references that affect rendering.
 * These are the values the state inspector should display for the current stage.
 */
export function extractStageReferences(
  elements: Record<string, unknown>[],
): string[] {
  const refs = new Set<string>();

  for (const element of elements) {
    // Condition references
    if (Array.isArray(element.conditions)) {
      for (const condition of element.conditions) {
        if (
          condition &&
          typeof condition === "object" &&
          "reference" in condition &&
          typeof condition.reference === "string"
        ) {
          refs.add(condition.reference);
        }
      }
    }

    // Display element references
    if (element.type === "display" && typeof element.reference === "string") {
      refs.add(element.reference);
    }
  }

  return [...refs];
}
