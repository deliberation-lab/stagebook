import type {
  Assignment,
  DispatchResult,
  EligibilityTable,
  Treatment,
} from "./types.js";
import { tryFillTreatment } from "./tryFillTreatment.js";

export interface UniformRandomArgs {
  playerIds: string[];
  treatments: Treatment[];
  eligibility: EligibilityTable;
  rng: () => number;
}

/**
 * Trivial "no-balance" dispatcher: each group's treatment is an
 * independent uniform draw from the treatment list. Intended for quick
 * prototypes and as the explicit-name replacement for legacy
 * `payoffs: "equal", knockdowns: "none"` configs.
 *
 * Algorithm (per round):
 *   1. From treatments with `playerCount ≤ available.size`, sample one
 *      uniformly at random.
 *   2. Try to fill its slots from the available eligible players via
 *      the shared `tryFillTreatment` helper.
 *   3. On success, emit the assignment and remove its players. On
 *      failure (no greedy matching) mark the treatment "tried this
 *      round" and try a different one; if every remaining-size-feasible
 *      treatment fails, stop.
 *
 * Termination: each successful round shrinks `available` by at least 1
 * (treatments with playerCount = 0 are skipped); each failed round
 * shrinks the "feasible-but-untried" set by at least 1. The combined
 * outer + inner loops are bounded by `O(treatments² + playerIds)`.
 *
 * Not in scope:
 *   - Balance guarantees (use `urnRandomization` for that).
 *   - Optimal bipartite matching (greedy can rarely miss a matching
 *     under tightly-coupled eligibility; the caller's data shape and
 *     condition tree determine whether this matters).
 */
export function uniformRandom({
  playerIds,
  treatments,
  eligibility,
  rng,
}: UniformRandomArgs): DispatchResult {
  const assignments: Assignment[] = [];
  const available = new Set(playerIds);

  while (available.size > 0) {
    const tried = new Set<number>();
    let progress = false;
    while (true) {
      // Build the "size-feasible, not-yet-tried" treatment pool.
      const pool: number[] = [];
      for (let i = 0; i < treatments.length; i += 1) {
        if (tried.has(i)) continue;
        if (treatments[i].playerCount === 0) continue;
        if (treatments[i].playerCount > available.size) continue;
        pool.push(i);
      }
      if (pool.length === 0) break;
      const treatmentIdx = pool[Math.floor(rng() * pool.length)];
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
        progress = true;
        break; // restart the outer round
      }
      tried.add(treatmentIdx);
    }
    if (!progress) break;
  }

  return { assignments };
}
