import type { LabeledScalars } from "./types.js";

/**
 * Runtime label-set check used by the dispatchers as defense in depth.
 * The validator (`validateDispatcherConfig`) catches the same mismatches
 * at config-time; this guard exists so callers that bypass validation
 * (programmatic batch construction, host adapters that skip the
 * validator step, tests) still get a clear error instead of silently
 * working off undefined values.
 *
 * Lifted into a shared helper because both `urnRandomization` and
 * `weightedRandom` need the exact same check — having two copies risked
 * drift between them as the error format evolved.
 */
export function validateLabelSet(
  dispatcherName: string,
  field: string,
  labels: LabeledScalars | Record<string, Record<string, number>>,
  treatmentNames: string[],
): void {
  const labelKeys = Object.keys(labels);
  const expected = new Set(treatmentNames);
  const actual = new Set(labelKeys);
  const missing = treatmentNames.filter((name) => !actual.has(name));
  const extra = labelKeys.filter((label) => !expected.has(label));
  if (missing.length === 0 && extra.length === 0) return;
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing: [${missing.join(", ")}]`);
  if (extra.length > 0) parts.push(`extra: [${extra.join(", ")}]`);
  throw new Error(
    `${dispatcherName}: ${field} labels do not match the treatment name set. ${parts.join("; ")}`,
  );
}
