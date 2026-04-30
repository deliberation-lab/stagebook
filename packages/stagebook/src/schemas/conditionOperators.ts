/**
 * Source-of-truth list of boolean-tree operator keys (#235).
 *
 * Lives in its own module so both `treatment.ts` (where the operator
 * branches are defined) and `validateReferences.ts` (where the walker
 * traverses them) can import it without forming an import cycle —
 * `treatment.ts` imports `validateReferences.ts` for cross-stage
 * checks, so the dependency arrow has to point the other way for the
 * shared list.
 */
export const OPERATOR_KEYS = ["all", "any", "none"] as const;

export type OperatorKey = (typeof OPERATOR_KEYS)[number];
