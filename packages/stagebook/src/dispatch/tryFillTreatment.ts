import type {
  EligibilityTable,
  PositionAssignment,
  Treatment,
} from "./types.js";

/**
 * Greedy-randomized attempt to fill a treatment's `playerCount` slots
 * from the available player pool, respecting per-slot eligibility.
 *
 * Algorithm:
 *   1. Shuffle the positions [0, playerCount).
 *   2. For each position in shuffled order, list available players who
 *      are eligible and haven't been claimed by an earlier position in
 *      this same proposal, then pick one uniformly at random.
 *   3. If any position has no eligible candidate, abort and return
 *      `null` — the caller decides whether to retry a different
 *      treatment.
 *
 * Why greedy + shuffled positions:
 *   - Shuffled positions remove the systematic bias that would arise
 *     from always assigning position 0 first when eligibility classes
 *     overlap (e.g. a strict-eligibility position would always be
 *     filled before an unconstrained position even though the
 *     unconstrained position has a much larger candidate pool).
 *   - Greedy can theoretically miss a bipartite matching that exists
 *     when eligibility classes are tightly coupled; the caller is
 *     expected to handle the `null` case (skip + try another treatment).
 *     For the loose eligibility patterns we see in practice this is
 *     never a problem.
 *
 * The returned `positionAssignments` is a fresh array — the caller
 * owns mutating the available-players pool based on the result.
 */
export function tryFillTreatment(
  treatmentIndex: number,
  treatment: Treatment,
  available: ReadonlySet<string>,
  eligibility: EligibilityTable,
  rng: () => number,
): PositionAssignment[] | null {
  if (treatment.playerCount > available.size) return null;

  const positions: number[] = [];
  for (let i = 0; i < treatment.playerCount; i += 1) positions.push(i);
  fisherYatesShuffle(positions, rng);

  const used = new Set<string>();
  const result: PositionAssignment[] = [];
  for (const position of positions) {
    const candidates: string[] = [];
    for (const pid of available) {
      if (used.has(pid)) continue;
      if (eligibility.isEligible(pid, treatmentIndex, position)) {
        candidates.push(pid);
      }
    }
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    used.add(pick);
    result.push({ playerId: pick, position });
  }
  // Sort by position for deterministic output order (the algorithm
  // randomized which slot was filled first, but the returned assignment
  // ought not to leak that processing order).
  result.sort((a, b) => a.position - b.position);
  return result;
}

/** In-place Fisher-Yates shuffle using the supplied PRNG. */
export function fisherYatesShuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}
