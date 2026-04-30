import { compare, type Comparator } from "./compare.js";

/** A single leaf condition: a reference + comparator + optional value,
 *  with optional cross-player aggregation via `position`. This is what
 *  the boolean tree's operator branches eventually bottom out at. */
export interface Condition {
  reference: string;
  position?: string;
  comparator: string;
  value?: unknown;
}

/** A node in the boolean condition tree (#235). Either an operator
 *  with child nodes (`all`/`any`/`none`), or a leaf condition. The
 *  tree composes with Kleene three-valued logic so unknown ("data not
 *  yet") propagates correctly through `none` — see `evaluateNode`.
 *
 *  At a `conditions:` field site, the value can additionally be an
 *  array of nodes (sugar for an implicit `all`); see
 *  `evaluateConditions` for the field-level entrypoint. */
export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { none: ConditionNode[] }
  | Condition;

/** Tri-state result for the internal evaluator. `undefined` means
 *  "the underlying data isn't there yet — can't decide." Operators
 *  propagate it; the boundary collapses it to `false` for the
 *  public-API boolean return. */
type TriState = boolean | undefined;

/** Type guards for operator nodes. Operator branches in `conditionsSchema`
 *  enforce `Array.isArray(node[op])` and `.nonempty()`; the runtime guards
 *  here re-check the array shape so callers that bypass the schema (e.g.
 *  hand-built nodes in tests, or inputs from a host that didn't validate)
 *  fall through to the leaf branch instead of throwing in the for-of loop.
 */
function isAllNode(n: unknown): n is { all: ConditionNode[] } {
  return (
    !!n &&
    typeof n === "object" &&
    "all" in n &&
    Array.isArray((n as { all: unknown }).all)
  );
}
function isAnyNode(n: unknown): n is { any: ConditionNode[] } {
  return (
    !!n &&
    typeof n === "object" &&
    "any" in n &&
    Array.isArray((n as { any: unknown }).any)
  );
}
function isNoneNode(n: unknown): n is { none: ConditionNode[] } {
  return (
    !!n &&
    typeof n === "object" &&
    "none" in n &&
    Array.isArray((n as { none: unknown }).none)
  );
}

/**
 * Tri-state leaf evaluator. Returns `undefined` when no resolved value
 * is available (so operators above can know the leaf is "unknown"
 * rather than "false"); returns `true`/`false` otherwise.
 *
 * Position semantics (kept identical to the pre-#235 behavior):
 *   - `percentAgreement` — compute the fraction of definedValues that
 *     match the modal value, compare against `value`.
 *   - `any` — true if any value satisfies the comparator; undefined if
 *     no value satisfies and at least one is unknown; else false.
 *   - default (`all` / numeric / `shared` / `player`) — true if every
 *     value satisfies; undefined if all-known children include any
 *     compare-undefined; else false.
 */
function evaluateLeafTriState(
  condition: Condition,
  referenceValues: unknown[],
): TriState {
  const { position, comparator, value } = condition;

  // No values resolved at all — `doesNotExist` is satisfied
  // (explicit absence assertion); every other comparator can't
  // decide, so undefined.
  if (referenceValues.length === 0) {
    return comparator === "doesNotExist" ? true : undefined;
  }

  if (position === "percentAgreement") {
    // Use a null-prototype object so response values like "constructor"
    // or "toString" don't collide with inherited properties.
    const counts = Object.create(null) as Record<string, number>;
    const definedValues = referenceValues.filter((val) => val !== undefined);
    if (definedValues.length === 0) return undefined;
    definedValues.forEach((val) => {
      const cleanValue =
        typeof val === "string"
          ? val.toLowerCase().trim()
          : `${val as string | number | boolean}`;
      counts[cleanValue] = (counts[cleanValue] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    const result = compare(
      (maxCount / referenceValues.length) * 100,
      comparator as Comparator,
      value,
    );
    return result === undefined ? undefined : result;
  }

  if (position === "any") {
    let anyUnknown = false;
    for (const val of referenceValues) {
      const r = compare(val, comparator as Comparator, value);
      if (r === true) return true;
      if (r === undefined) anyUnknown = true;
    }
    return anyUnknown ? undefined : false;
  }

  // Default ("all" / numeric / shared / player) — every value must
  // satisfy; short-circuit on a definite false.
  let anyUnknown = false;
  for (const val of referenceValues) {
    const r = compare(val, comparator as Comparator, value);
    if (r === false) return false;
    if (r === undefined) anyUnknown = true;
  }
  return anyUnknown ? undefined : true;
}

/**
 * Tri-state evaluator over the boolean tree (#235). Internal — public
 * callers go through `evaluateConditions` which collapses the tri-state
 * to a boolean at the boundary.
 *
 * Operator semantics (Kleene three-valued logic):
 *   - `all`: any child false → false; else any undefined → undefined; else true.
 *   - `any`: any child true → true; else any undefined → undefined; else false.
 *   - `none`: any child true → false; else any undefined → undefined; else true.
 *
 * Why tri-state matters: with the leaf evaluator returning `undefined`
 * when data isn't available yet, `none: [...]` correctly returns
 * `undefined` (not `true`) when its children are all "data not yet."
 * Without this, a fallback element gated on `none: [...]` would render
 * prematurely before any participant had answered.
 */
function evaluateNode(
  node: ConditionNode,
  resolve: (reference: string, position?: string) => unknown[],
): TriState {
  if (isAllNode(node)) {
    let anyUnknown = false;
    for (const child of node.all) {
      const r = evaluateNode(child, resolve);
      if (r === false) return false;
      if (r === undefined) anyUnknown = true;
    }
    return anyUnknown ? undefined : true;
  }
  if (isAnyNode(node)) {
    let anyUnknown = false;
    for (const child of node.any) {
      const r = evaluateNode(child, resolve);
      if (r === true) return true;
      if (r === undefined) anyUnknown = true;
    }
    return anyUnknown ? undefined : false;
  }
  if (isNoneNode(node)) {
    let anyUnknown = false;
    for (const child of node.none) {
      const r = evaluateNode(child, resolve);
      if (r === true) return false;
      if (r === undefined) anyUnknown = true;
    }
    return anyUnknown ? undefined : true;
  }
  // Leaf
  const values = resolve(node.reference, node.position);
  return evaluateLeafTriState(node, values);
}

/**
 * Evaluate a single condition against resolved reference values.
 * Returns true if the condition is met, false otherwise. The tri-state
 * "data not yet available" case is collapsed to false here for the
 * public boolean API; `none:` operator branches in `evaluateConditions`
 * see the un-collapsed tri-state internally so they compose correctly.
 */
export function evaluateCondition(
  condition: Condition,
  referenceValues: unknown[],
): boolean {
  return evaluateLeafTriState(condition, referenceValues) === true;
}

/**
 * Field-level entrypoint for evaluating a `conditions:` value (#235).
 * Accepts:
 *   - an array of condition nodes (implicit `all`),
 *   - a single operator node (`{all|any|none: [...]}`),
 *   - a single leaf condition.
 *
 * Returns boolean — undefined ("data not yet") collapses to false at
 * this boundary. Existing callers that passed flat arrays continue to
 * work unchanged.
 */
export function evaluateConditions(
  conditions: ConditionNode[] | ConditionNode | undefined | null,
  resolve: (reference: string, position?: string) => unknown[],
): boolean {
  if (conditions === undefined || conditions === null) return true;
  if (Array.isArray(conditions)) {
    if (conditions.length === 0) return true;
    return evaluateNode({ all: conditions }, resolve) === true;
  }
  return evaluateNode(conditions, resolve) === true;
}
