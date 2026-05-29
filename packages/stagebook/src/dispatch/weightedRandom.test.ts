import { describe, test, expect } from "vitest";
import { weightedRandom } from "./weightedRandom.js";
import { makeEligibilityTable } from "./makeEligibilityTable.js";
import { mulberry32 } from "./contract.js";
import type { Treatment } from "./types.js";

function emptyEligibility(playerIds: string[], treatments: Treatment[]) {
  return makeEligibilityTable({ playerIds, treatments, playerData: {} });
}

describe("weightedRandom", () => {
  test("rejects mismatched weights/treatments length", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 1 },
      { name: "t1", playerCount: 1 },
    ];
    expect(() =>
      weightedRandom({
        playerIds: ["p0"],
        treatments,
        weights: [1],
        eligibility: emptyEligibility(["p0"], treatments),
        rng: mulberry32(0),
      }),
    ).toThrow(/weights.length/);
  });

  test("empty players → empty assignments", () => {
    const treatments: Treatment[] = [{ name: "t0", playerCount: 2 }];
    const result = weightedRandom({
      playerIds: [],
      treatments,
      weights: [1],
      eligibility: emptyEligibility([], treatments),
      rng: mulberry32(0),
    });
    expect(result.assignments).toEqual([]);
  });

  test("all-zero weights → no assignments (silent, not error)", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = ["p0", "p1", "p2", "p3"];
    const result = weightedRandom({
      playerIds,
      treatments,
      weights: [0, 0],
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(0),
    });
    expect(result.assignments).toEqual([]);
  });

  test("zero weight on one treatment → that treatment is never picked", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = Array.from({ length: 100 }, (_, i) => `p${i}`);
    const result = weightedRandom({
      playerIds,
      treatments,
      weights: [0, 1],
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of result.assignments) {
      expect(a.treatment.name).toBe("t1");
    }
  });

  test("equal weights produce equal long-run rates (sanity)", () => {
    const K = 3;
    const treatments: Treatment[] = Array.from({ length: K }, (_, i) => ({
      name: `t${i}`,
      playerCount: 2,
    }));
    const weights = [1, 1, 1];
    const counts = treatments.map(() => 0);
    const M = 500;
    for (let m = 0; m < M; m += 1) {
      const playerIds = Array.from({ length: 6 }, (_, i) => `p_${m}_${i}`);
      const result = weightedRandom({
        playerIds,
        treatments,
        weights,
        eligibility: emptyEligibility(playerIds, treatments),
        rng: mulberry32(m + 1),
      });
      for (const a of result.assignments) {
        const idx = treatments.findIndex((t) => t.name === a.treatment.name);
        counts[idx] += 1;
      }
    }
    const total = counts.reduce((s, x) => s + x, 0);
    // Loose bounds; the statistical-properties suite tightens this to
    // α=1e-4. Here we just sanity-check the algorithm runs and
    // produces roughly equal counts.
    expect(total).toBeGreaterThan(0);
    for (const c of counts) {
      expect(c / total).toBeGreaterThan(0.25);
      expect(c / total).toBeLessThan(0.42);
    }
  });

  test("4:1 weights produce roughly 4:1 long-run rates (sanity)", () => {
    const treatments: Treatment[] = [
      { name: "tA", playerCount: 2 },
      { name: "tB", playerCount: 2 },
    ];
    const weights = [4, 1];
    const counts = [0, 0];
    const M = 2000;
    for (let m = 0; m < M; m += 1) {
      const playerIds = [`p_${m}_0`, `p_${m}_1`];
      const result = weightedRandom({
        playerIds,
        treatments,
        weights,
        eligibility: emptyEligibility(playerIds, treatments),
        rng: mulberry32(m + 1),
      });
      for (const a of result.assignments) {
        const idx = treatments.findIndex((t) => t.name === a.treatment.name);
        counts[idx] += 1;
      }
    }
    const total = counts.reduce((s, x) => s + x, 0);
    // Target 4/5 = 0.80, 1/5 = 0.20. ±0.05 is well outside the binomial
    // noise floor at M=2000 (SE ≈ 0.009) but inside any plausible bug.
    expect(counts[0] / total).toBeGreaterThan(0.75);
    expect(counts[0] / total).toBeLessThan(0.85);
  });

  test("seeded determinism: same seed + inputs → identical assignments", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = ["p0", "p1", "p2", "p3"];
    const weights = [3, 1];
    const a = weightedRandom({
      playerIds,
      treatments,
      weights,
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    const b = weightedRandom({
      playerIds,
      treatments,
      weights,
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    const c = weightedRandom({
      playerIds,
      treatments,
      weights,
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(43),
    });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.assignments).not.toEqual(c.assignments);
  });

  test("rejects NaN / ±Infinity weights at the per-round filter", () => {
    // Non-finite weights are validated out by validateDispatcherConfig
    // at config-time; if one slips through, the dispatcher's filter
    // excludes the treatment rather than producing a corrupt weighted
    // sample (an Infinity would make totalWeight=∞ and the fallback
    // would always pick the last pool entry). Pinning that defense.
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = ["p0", "p1", "p2", "p3"];

    const nan = weightedRandom({
      playerIds,
      treatments,
      weights: [Number.NaN, 1],
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of nan.assignments) expect(a.treatment.name).toBe("t1");

    const inf = weightedRandom({
      playerIds,
      treatments,
      weights: [Number.POSITIVE_INFINITY, 1],
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of inf.assignments) expect(a.treatment.name).toBe("t1");

    const negInf = weightedRandom({
      playerIds,
      treatments,
      weights: [Number.NEGATIVE_INFINITY, 1],
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of negInf.assignments) expect(a.treatment.name).toBe("t1");
  });

  test("renormalization when a treatment drops out of the pool", () => {
    // Three treatments, weights [1, 1, 5]. T2 needs 6 players; ticks
    // only supply 4. So every tick's pool is {T0, T1} weighted [1, 1]
    // (T2 dropped for size-infeasibility); the absorbed mass from T2
    // is split 50/50 between T0 and T1, *not* allocated to T2 with
    // the rest of the round failing. Confirms the docstring claim that
    // renormalization is implicit-proportional over the surviving pool.
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
      { name: "t2", playerCount: 6 },
    ];
    const weights = [1, 1, 5];
    const counts = [0, 0, 0];
    const M = 1000;
    for (let m = 0; m < M; m += 1) {
      const playerIds = [`p_${m}_0`, `p_${m}_1`, `p_${m}_2`, `p_${m}_3`];
      const result = weightedRandom({
        playerIds,
        treatments,
        weights,
        eligibility: emptyEligibility(playerIds, treatments),
        rng: mulberry32(m + 1),
      });
      for (const a of result.assignments) {
        const idx = treatments.findIndex((t) => t.name === a.treatment.name);
        counts[idx] += 1;
      }
    }
    const total = counts.reduce((s, x) => s + x, 0);
    // T2 should never be picked (playerCount > tick size). T0 and T1
    // should split the runs ~50/50.
    expect(counts[2]).toBe(0);
    expect(total).toBeGreaterThan(0);
    expect(counts[0] / total).toBeGreaterThan(0.42);
    expect(counts[0] / total).toBeLessThan(0.58);
  });

  test("greedy-fill failure on the picked treatment re-samples from the rest", () => {
    // Set up: two treatments, weights [9, 1]. T0 has a strict role
    // condition that NO player satisfies, so greedy-fill always fails
    // on T0. The dispatcher must mark T0 "tried this round" and pick
    // T1 from the remaining pool — every successful round must end up
    // on T1, even though T0 was picked first 90% of the time.
    const treatments: Treatment[] = [
      {
        name: "t0",
        playerCount: 2,
        groupComposition: [
          {
            position: 0,
            conditions: [
              {
                reference: "self.prompt.role",
                comparator: "equals",
                value: "nonexistent",
              },
            ],
          },
          {
            position: 1,
            conditions: [
              {
                reference: "self.prompt.role",
                comparator: "equals",
                value: "nonexistent",
              },
            ],
          },
        ],
      },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = ["p0", "p1", "p2", "p3"];
    const eligibility = emptyEligibility(playerIds, treatments);
    let t1Count = 0;
    let totalAssignments = 0;
    for (let m = 0; m < 200; m += 1) {
      const result = weightedRandom({
        playerIds,
        treatments,
        weights: [9, 1],
        eligibility,
        rng: mulberry32(m + 1),
      });
      for (const a of result.assignments) {
        totalAssignments += 1;
        if (a.treatment.name === "t1") t1Count += 1;
      }
    }
    // Every assignment must be on t1 (t0 was never fillable).
    expect(totalAssignments).toBeGreaterThan(0);
    expect(t1Count).toBe(totalAssignments);
  });
});
