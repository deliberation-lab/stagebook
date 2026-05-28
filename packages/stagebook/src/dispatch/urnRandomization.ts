import type { Assignment, EligibilityTable, Treatment } from "./types.js";
import { tryFillTreatment } from "./tryFillTreatment.js";

export interface UrnRandomizationArgs {
  playerIds: string[];
  treatments: Treatment[];
  /** Per-treatment remaining-balls. Mutated *by copy* — input is not modified. */
  counts: number[];
  /** Optional square N×N matrix of non-negative integer decrements.
   *  `decrements[i][j]` = how many balls to subtract from treatment j
   *  when treatment i is used. When omitted, defaults to the identity
   *  matrix (decrement self by 1, leave others alone). */
  decrements?: number[][];
  eligibility: EligibilityTable;
  rng: () => number;
}

export interface UrnRandomizationResult {
  assignments: Assignment[];
  /** Persist this across ticks. The host wires it back into the next
   *  call's `counts`; the dispatcher itself is pure. */
  remainingCounts: number[];
}

/**
 * Sampling-without-replacement dispatcher: each treatment has a target
 * count of "balls" (target-N for that arm); each successful assignment
 * draws one ball and decrements per the decrement matrix. Over the run
 * of the batch, each treatment is used at its target count exactly —
 * this is THE central randomization claim for ordinary experimental
 * work.
 *
 * Algorithm (per round, per call):
 *   1. Eligible-treatment pool = treatments where
 *      `counts[i] > 0 ∧ playerCount ≤ available.size ∧ playerCount > 0`.
 *   2. Sample one treatment from the pool with probability proportional
 *      to `counts[i]` (urn draw — *not* uniform).
 *   3. Try to fill its slots via `tryFillTreatment`. On success, emit
 *      the assignment, remove the players, and decrement the urn per
 *      `decrements[i][*]` (clamped to zero on mid-dispatch underflow).
 *   4. On greedy failure, mark this treatment "tried this round" and
 *      sample again from the remaining pool; if every untried
 *      treatment fails, stop.
 *
 * Counts are host-persistent state — call N times across N dispatch
 * ticks; thread `result.remainingCounts` back into each successor's
 * `counts` argument. The dispatcher itself never mutates its inputs.
 *
 * Underflow handling: if a decrement would push `counts[j]` below zero
 * we clamp to zero. The issue's design discussion notes this can
 * legitimately happen mid-dispatch when multiple picks decrement the
 * same off-diagonal entry. We do not emit a warning at the dispatcher
 * level — the host can detect the same condition by comparing input vs.
 * output counts and surface it however its observability stack prefers.
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
  if (counts.length !== n) {
    throw new Error(
      `urnRandomization: counts.length (${counts.length}) must equal treatments.length (${n})`,
    );
  }
  const remainingCounts = counts.slice();
  const decrementMatrix = decrements ?? identityMatrix(n);
  if (decrementMatrix.length !== n) {
    throw new Error(
      `urnRandomization: decrements is not a square ${n}×${n} matrix (rows=${decrementMatrix.length})`,
    );
  }
  for (let i = 0; i < n; i += 1) {
    if (decrementMatrix[i].length !== n) {
      throw new Error(
        `urnRandomization: decrements row ${i} has length ${decrementMatrix[i].length}, expected ${n}`,
      );
    }
  }

  const assignments: Assignment[] = [];
  const available = new Set(playerIds);

  while (available.size > 0) {
    const tried = new Set<number>();
    let progress = false;
    while (true) {
      // Build the "positive-count, size-feasible, not-yet-tried" pool.
      const pool: number[] = [];
      let totalWeight = 0;
      for (let i = 0; i < n; i += 1) {
        if (tried.has(i)) continue;
        if (remainingCounts[i] <= 0) continue;
        if (treatments[i].playerCount === 0) continue;
        if (treatments[i].playerCount > available.size) continue;
        pool.push(i);
        totalWeight += remainingCounts[i];
      }
      if (pool.length === 0 || totalWeight === 0) break;

      // Weighted sample by remaining counts.
      const target = rng() * totalWeight;
      let cumulative = 0;
      let treatmentIdx = pool[pool.length - 1];
      for (const i of pool) {
        cumulative += remainingCounts[i];
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
        const row = decrementMatrix[treatmentIdx];
        for (let j = 0; j < n; j += 1) {
          const next = remainingCounts[j] - row[j];
          remainingCounts[j] = next < 0 ? 0 : next;
        }
        progress = true;
        break; // restart the outer round
      }
      tried.add(treatmentIdx);
    }
    if (!progress) break;
  }

  return { assignments, remainingCounts };
}

function identityMatrix(n: number): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < n; j += 1) row.push(i === j ? 1 : 0);
    m.push(row);
  }
  return m;
}
