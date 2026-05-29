import type {
  Assignment,
  DispatchResult,
  EligibilityTable,
  LabeledScalars,
  Treatment,
} from "./types.js";
import { tryFillTreatment } from "./tryFillTreatment.js";
import { validateLabelSet } from "./validateLabelSet.js";

export interface WeightedRandomArgs {
  playerIds: string[];
  treatments: Treatment[];
  /** Non-negative reals interpreted up to scale, keyed by treatment
   *  name. Label set must equal the set of `treatments[i].name`. Zero
   *  entries are allowed and mean "never pick this treatment."
   *  All-zero is allowed and yields no assignments. */
  weights: LabeledScalars;
  eligibility: EligibilityTable;
  rng: () => number;
}

/**
 * Stateless categorical sampler (#451): each round draws a treatment
 * iid with probability proportional to `weights[name]`, then attempts
 * a greedy fill. The dispatcher carries no state across rounds — each
 * draw is independent of every prior draw, of the round number, and
 * of any host-persisted bookkeeping.
 *
 * The label-based input shape protects against silent order drift
 * between the treatment file and the batch config: if a treatment is
 * renamed, added, or removed, the validator catches the mismatch at
 * config-time and the dispatcher refuses to run with an unmatched
 * label at runtime.
 *
 * Algorithm (per round):
 *   1. Build the per-round pool: treatments with `weights[name] > 0 ∧
 *      playerCount ≤ available.size ∧ playerCount > 0 ∧
 *      not-yet-tried-this-round`.
 *   2. Sample one treatment from the pool with probability proportional
 *      to its weight.
 *   3. Try to fill its slots via `tryFillTreatment`. On success, emit
 *      the assignment and remove its players. On greedy failure, mark
 *      "tried this round" and re-sample from the remaining weighted
 *      pool; if every untried treatment fails, stop.
 *
 * Realized rate vs. target rate: the long-run rate matches
 * `weights[name] / sum(weights)` only when every round is size-feasible
 * for every treatment and every player is eligible for every position.
 * See `docs/researcher/dispatchers.md` for a worked example.
 */
export function weightedRandom({
  playerIds,
  treatments,
  weights,
  eligibility,
  rng,
}: WeightedRandomArgs): DispatchResult {
  const n = treatments.length;
  const names = treatments.map((t) => t.name);

  validateLabelSet("weightedRandom", "weights", weights, names);

  // Internally we work positionally — same inner loop as the v0.13
  // positional implementation. The labels are converted at the
  // boundary so the algorithm itself never juggles strings.
  const positionalWeights: number[] = names.map((name) => weights[name]);

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
        // Reject 0, negative, NaN, ±Infinity. Validation rejects
        // these at config-time but the per-round filter defends in
        // depth — an Infinity that slipped through would make
        // `totalWeight = ∞` and the weighted-sample fallback would
        // always select the last pool entry.
        if (!Number.isFinite(positionalWeights[i]) || positionalWeights[i] <= 0)
          continue;
        if (treatments[i].playerCount === 0) continue;
        if (treatments[i].playerCount > available.size) continue;
        pool.push(i);
        totalWeight += positionalWeights[i];
      }
      if (pool.length === 0 || totalWeight <= 0) break;

      const target = rng() * totalWeight;
      let cumulative = 0;
      let treatmentIdx = pool[pool.length - 1];
      for (const i of pool) {
        cumulative += positionalWeights[i];
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
        break;
      }
      tried.add(treatmentIdx);
    }
    if (!progress) break;
  }

  return { assignments };
}
