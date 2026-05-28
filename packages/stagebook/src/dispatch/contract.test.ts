// Run the generic dispatcher-contract gauntlet (10 structural
// invariants) against each dispatcher stagebook ships. Adding a new
// dispatcher means appending one `runContractSuite(...)` call; the
// same invariants run automatically.

import { buildEligibilityForScenario, runContractSuite } from "./contract.js";
import { uniformRandom } from "./uniformRandom.js";
import { urnRandomization } from "./urnRandomization.js";

runContractSuite("uniform-random", ({ scenario, rng }) => {
  const eligibility = buildEligibilityForScenario(scenario);
  return {
    params: {},
    dispatch: () =>
      uniformRandom({
        playerIds: scenario.players.map((p) => p.id),
        treatments: scenario.treatments,
        eligibility,
        rng,
      }),
  };
});

runContractSuite("urn", ({ scenario, rng }) => {
  const eligibility = buildEligibilityForScenario(scenario);
  // Random per-scenario counts in [0, 5]. Some zeros so the dispatcher
  // exercises the "no balls left for this treatment" branch.
  const counts = scenario.treatments.map(() => Math.floor(rng() * 6));
  // Random decrement matrix: either identity (50%) or a sparse matrix
  // with integer entries small enough to avoid validation rejections.
  let decrements: number[][] | undefined;
  if (rng() < 0.5) {
    decrements = undefined; // identity default
  } else {
    decrements = buildSafeDecrementMatrix(counts, rng);
  }
  return {
    params: { counts, decrements },
    dispatch: () =>
      urnRandomization({
        playerIds: scenario.players.map((p) => p.id),
        treatments: scenario.treatments,
        counts,
        decrements,
        eligibility,
        rng,
      }),
  };
});

/** Build a random decrement matrix where each `decrements[i][j] ≤ counts[j]`
 *  so the dispatcher doesn't immediately clamp to zero on the first use.
 *  Diagonal entries are at least 1 so a treatment's own counter
 *  actually decreases when the treatment is used. */
function buildSafeDecrementMatrix(
  counts: number[],
  rng: () => number,
): number[][] {
  const n = counts.length;
  const m: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    for (let j = 0; j < n; j += 1) {
      if (i === j) {
        // Self-decrement at least 1 (when there's a ball to take).
        row.push(counts[j] > 0 ? 1 : 0);
      } else {
        // Off-diagonal in [0, min(1, counts[j])] — usually 0, sometimes 1.
        row.push(rng() < 0.25 && counts[j] > 0 ? 1 : 0);
      }
    }
    m.push(row);
  }
  return m;
}
