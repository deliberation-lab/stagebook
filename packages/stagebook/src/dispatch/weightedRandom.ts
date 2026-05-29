import type {
  Assignment,
  DispatchResult,
  EligibilityTable,
  Treatment,
} from "./types.js";
import { tryFillTreatment } from "./tryFillTreatment.js";

export interface WeightedRandomArgs {
  playerIds: string[];
  treatments: Treatment[];
  /** Non-negative reals interpreted up to scale. Length must equal
   *  `treatments.length`. Zero entries are allowed and mean "never pick
   *  this treatment." All-zero is allowed and yields no assignments. */
  weights: number[];
  eligibility: EligibilityTable;
  rng: () => number;
}

/**
 * Stateless categorical sampler (#451): each round draws a treatment
 * iid with probability proportional to `weights[i]`, then attempts a
 * greedy fill. The dispatcher carries no state across rounds — each
 * draw is independent of every prior draw, of the round number, and of
 * any host-persisted bookkeeping. This is the property that
 * distinguishes it from `urn` (where prior draws shift the distribution)
 * and that justifies skipping host state plumbing entirely.
 *
 * Relationship to the sibling dispatchers:
 *   - `weighted-random` with all-equal weights is observationally
 *     identical to `uniform-random`. Authors should still prefer
 *     `uniform-random` when they have no balance claim — the
 *     discriminator self-documents the absence of a claim.
 *   - `urn` with very large integer counts and an identity decrement
 *     matrix approximates `weighted-random` (and converges as counts
 *     grow), but pays integer-ball cognitive overhead for a use case
 *     that doesn't need exact-N guarantees.
 *
 * Algorithm (per round):
 *   1. Build the per-round pool: treatments with `weights[i] > 0 ∧
 *      playerCount ≤ available.size ∧ playerCount > 0 ∧
 *      not-yet-tried-this-round`.
 *   2. Sample one treatment from the pool with probability proportional
 *      to its weight.
 *   3. Try to fill its slots via `tryFillTreatment`. On success, emit
 *      the assignment and remove its players. On greedy failure, mark
 *      "tried this round" and re-sample from the remaining weighted
 *      pool; if every untried treatment fails, stop.
 *
 * Realized rate vs. target rate:
 *   The long-run rate matches `weights[i] / sum(weights)` only when
 *   every round is size-feasible for every treatment and every player
 *   is eligible for every position. When eligibility is tight (or the
 *   per-tick player pool is small), the per-round pool gets filtered
 *   for size-feasibility and the marginal rate is implicitly
 *   renormalized over the surviving treatments. Hosts can detect the
 *   divergence by computing realized rates from the returned
 *   `assignments` and comparing against the target weights — see
 *   `docs/researcher/dispatchers.md` for a worked example.
 *
 * Termination: each successful round shrinks `available` by at least
 * 1; each failed round shrinks the "weighted, feasible, untried" set
 * by at least 1. Bounded by `O(treatments² + playerIds)`.
 */
export function weightedRandom({
  playerIds,
  treatments,
  weights,
  eligibility,
  rng,
}: WeightedRandomArgs): DispatchResult {
  const n = treatments.length;
  if (weights.length !== n) {
    throw new Error(
      `weightedRandom: weights.length (${weights.length}) must equal treatments.length (${n})`,
    );
  }

  const assignments: Assignment[] = [];
  const available = new Set(playerIds);

  while (available.size > 0) {
    const tried = new Set<number>();
    let progress = false;
    while (true) {
      // Build the "positive-weight, size-feasible, not-yet-tried" pool.
      const pool: number[] = [];
      let totalWeight = 0;
      for (let i = 0; i < n; i += 1) {
        if (tried.has(i)) continue;
        // Reject 0, negative, NaN, and ±Infinity. Validation rejects
        // these at config-time but the per-round filter defends in
        // depth — an Infinity that slipped through would make
        // `totalWeight = ∞` and the weighted-sample fallback would
        // always select the last pool entry.
        if (!Number.isFinite(weights[i]) || weights[i] <= 0) continue;
        if (treatments[i].playerCount === 0) continue;
        if (treatments[i].playerCount > available.size) continue;
        pool.push(i);
        totalWeight += weights[i];
      }
      if (pool.length === 0 || totalWeight <= 0) break;

      // Weighted sample by weights[i]. The strict `<` on cumulative
      // means the floating-point edge case `target === totalWeight`
      // falls through to the last-pool-entry fallback — same pattern
      // as urnRandomization, kept consistent so readers don't have to
      // re-verify per dispatcher.
      const target = rng() * totalWeight;
      let cumulative = 0;
      let treatmentIdx = pool[pool.length - 1];
      for (const i of pool) {
        cumulative += weights[i];
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
        progress = true;
        break; // restart the outer round
      }
      tried.add(treatmentIdx);
    }
    if (!progress) break;
  }

  return { assignments };
}
