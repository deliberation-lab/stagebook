import type {
  Assignment,
  EligibilityTable,
  LabeledMatrix,
  LabeledScalars,
  Treatment,
} from "./types.js";
import { tryFillTreatment } from "./tryFillTreatment.js";
import { validateLabelSet } from "./validateLabelSet.js";

export interface UrnRandomizationArgs {
  playerIds: string[];
  treatments: Treatment[];
  /** Per-treatment remaining-balls, keyed by treatment name. Mutated
   *  *by copy* — input is not modified. Label set must equal the set
   *  of `treatments[i].name`. */
  counts: LabeledScalars;
  /** Optional decrement matrix, keyed by treatment name on both axes.
   *  When omitted entirely, the full matrix defaults to identity.
   *  When provided, it's a strict literal — every treatment must have
   *  a row, and missing column entries within a row default to 0. */
  decrements?: LabeledMatrix;
  eligibility: EligibilityTable;
  rng: () => number;
}

export interface UrnRandomizationResult {
  assignments: Assignment[];
  /** Persist this across ticks. The host wires it back into the next
   *  call's `counts`; the dispatcher itself is pure. Same label set
   *  as the input `counts`. */
  remainingCounts: LabeledScalars;
}

/**
 * Sampling-without-replacement dispatcher: each treatment has a target
 * count of "balls" (target-N for that arm); each successful assignment
 * draws one ball and decrements per the decrement matrix. Over the run
 * of the batch, each treatment is used at its target count exactly —
 * this is THE central randomization claim for ordinary experimental
 * work.
 *
 * The label-based input shape protects against silent order drift
 * between the treatment file and the batch config: if a treatment is
 * renamed, added, or removed, the validator catches the mismatch at
 * config-time and the dispatcher refuses to run with an unmatched
 * label at runtime.
 *
 * Algorithm (per round, per call):
 *   1. Eligible-treatment pool = treatments where
 *      `counts[name] > 0 ∧ playerCount ≤ available.size ∧ playerCount > 0`.
 *   2. Sample one treatment from the pool with probability proportional
 *      to `counts[name]` (urn draw — *not* uniform).
 *   3. Try to fill its slots via `tryFillTreatment`. On success, emit
 *      the assignment, remove the players, and decrement the urn per
 *      the picked row of `decrements` (clamped to zero on mid-dispatch
 *      underflow).
 *   4. On greedy failure, mark this treatment "tried this round" and
 *      sample again from the remaining pool; if every untried
 *      treatment fails, stop.
 *
 * Underflow handling: if a decrement would push a count below zero we
 * clamp to zero silently. The host can detect the same condition by
 * comparing input vs. output counts.
 */
export function urnRandomization({
  playerIds,
  treatments,
  counts,
  decrements,
  eligibility,
  rng,
}: UrnRandomizationArgs): UrnRandomizationResult {
  const n = treatments.length;
  const names = treatments.map((t) => t.name);

  // Validate label set up-front so the failure mode is "loud error at
  // the top of the function" rather than "silent missing-key default
  // mid-loop." The validator should have caught these at config-time;
  // this is defense in depth for callers that bypass validation.
  validateLabelSet("urnRandomization", "counts", counts, names);
  if (decrements !== undefined) {
    // When a matrix is specified, it's a strict literal: every
    // treatment must have a row (no implicit identity fallback for
    // omitted rows), and column labels within each row must be known
    // treatments. This matches the validator's `decrements` rule and
    // keeps the mental model of "matrix off = identity, matrix on =
    // literal" intact.
    validateLabelSet("urnRandomization", "decrements rows", decrements, names);
    for (const row of names) {
      for (const col of Object.keys(decrements[row])) {
        if (!names.includes(col)) {
          throw new Error(
            `urnRandomization: decrements column label "${col}" in row "${row}" does not match any treatment name`,
          );
        }
      }
    }
  }

  // Internally we work positionally (cheap arithmetic, dense access)
  // and convert back to labels only at the boundary. The whole inner
  // loop is identical to the v0.13 positional implementation.
  const positionalCounts: number[] = names.map((name) => counts[name]);
  const positionalDecrements: number[][] =
    decrements === undefined
      ? // No matrix → identity (the default-case fast path).
        names.map((rowName) =>
          names.map((colName) => (colName === rowName ? 1 : 0)),
        )
      : // Matrix specified → strict literal; missing cells default to 0.
        names.map((rowName) =>
          names.map((colName) => decrements[rowName][colName] ?? 0),
        );

  const assignments: Assignment[] = [];
  const available = new Set(playerIds);

  while (available.size > 0) {
    const tried = new Set<number>();
    let progress = false;
    while (true) {
      const pool: number[] = [];
      let totalWeight = 0;
      for (let i = 0; i < n; i += 1) {
        if (tried.has(i)) continue;
        if (positionalCounts[i] <= 0) continue;
        if (treatments[i].playerCount === 0) continue;
        if (treatments[i].playerCount > available.size) continue;
        pool.push(i);
        totalWeight += positionalCounts[i];
      }
      if (pool.length === 0 || totalWeight === 0) break;

      const target = rng() * totalWeight;
      let cumulative = 0;
      let treatmentIdx = pool[pool.length - 1];
      for (const i of pool) {
        cumulative += positionalCounts[i];
        if (target < cumulative) {
          treatmentIdx = i;
          break;
        }
      }
      const treatment = treatments[treatmentIdx];

      const filled = tryFillTreatment(
        treatmentIdx,
        treatment,
        available,
        eligibility,
        rng,
      );
      if (filled) {
        assignments.push({ treatment, positionAssignments: filled });
        for (const pa of filled) available.delete(pa.playerId);
        const row = positionalDecrements[treatmentIdx];
        for (let j = 0; j < n; j += 1) {
          const next = positionalCounts[j] - row[j];
          positionalCounts[j] = next < 0 ? 0 : next;
        }
        progress = true;
        break;
      }
      tried.add(treatmentIdx);
    }
    if (!progress) break;
  }

  const remainingCounts: LabeledScalars = {};
  names.forEach((name, i) => {
    remainingCounts[name] = positionalCounts[i];
  });

  return { assignments, remainingCounts };
}
