import { describe, test, expect } from "vitest";
import { weightedRandom } from "./weightedRandom.js";
import { makeEligibilityTable } from "./makeEligibilityTable.js";
import { mulberry32 } from "./contract.js";
import type { Treatment } from "./types.js";

function emptyEligibility(playerIds: string[], treatments: Treatment[]) {
  return makeEligibilityTable({ playerIds, treatments, playerData: {} });
}

describe("weightedRandom", () => {
  test("rejects weights with extra / missing labels", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 1 },
      { name: "t1", playerCount: 1 },
    ];
    // Missing t1
    expect(() =>
      weightedRandom({
        playerIds: ["p0"],
        treatments,
        weights: { t0: 1 },
        eligibility: emptyEligibility(["p0"], treatments),
        rng: mulberry32(0),
      }),
    ).toThrow(/labels do not match.*missing.*t1/);
    // Extra t2
    expect(() =>
      weightedRandom({
        playerIds: ["p0"],
        treatments,
        weights: { t0: 1, t1: 1, t2: 1 },
        eligibility: emptyEligibility(["p0"], treatments),
        rng: mulberry32(0),
      }),
    ).toThrow(/labels do not match.*extra.*t2/);
  });

  test("empty players → empty assignments", () => {
    const treatments: Treatment[] = [{ name: "t0", playerCount: 2 }];
    const result = weightedRandom({
      playerIds: [],
      treatments,
      weights: { t0: 1 },
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
      weights: { t0: 0, t1: 0 },
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
      weights: { t0: 0, t1: 1 },
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
    const weights = { t0: 1, t1: 1, t2: 1 };
    const counts: Record<string, number> = { t0: 0, t1: 0, t2: 0 };
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
        counts[a.treatment.name] += 1;
      }
    }
    const total = Object.values(counts).reduce((s, x) => s + x, 0);
    expect(total).toBeGreaterThan(0);
    for (const c of Object.values(counts)) {
      expect(c / total).toBeGreaterThan(0.25);
      expect(c / total).toBeLessThan(0.42);
    }
  });

  test("4:1 weights produce roughly 4:1 long-run rates (sanity)", () => {
    const treatments: Treatment[] = [
      { name: "tA", playerCount: 2 },
      { name: "tB", playerCount: 2 },
    ];
    const weights = { tA: 4, tB: 1 };
    const counts: Record<string, number> = { tA: 0, tB: 0 };
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
        counts[a.treatment.name] += 1;
      }
    }
    const total = counts.tA + counts.tB;
    expect(counts.tA / total).toBeGreaterThan(0.75);
    expect(counts.tA / total).toBeLessThan(0.85);
  });

  test("seeded determinism: same seed + inputs → identical assignments", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
    ];
    const playerIds = ["p0", "p1", "p2", "p3"];
    const weights = { t0: 3, t1: 1 };
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
      weights: { t0: Number.NaN, t1: 1 },
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of nan.assignments) expect(a.treatment.name).toBe("t1");

    const inf = weightedRandom({
      playerIds,
      treatments,
      weights: { t0: Number.POSITIVE_INFINITY, t1: 1 },
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of inf.assignments) expect(a.treatment.name).toBe("t1");

    const negInf = weightedRandom({
      playerIds,
      treatments,
      weights: { t0: Number.NEGATIVE_INFINITY, t1: 1 },
      eligibility: emptyEligibility(playerIds, treatments),
      rng: mulberry32(42),
    });
    for (const a of negInf.assignments) expect(a.treatment.name).toBe("t1");
  });

  test("renormalization when a treatment drops out of the pool", () => {
    // Three treatments, weights {t0:1, t1:1, t2:5}. t2 needs 6 players;
    // ticks only supply 4. So every tick's pool is {t0, t1} weighted
    // [1, 1] (t2 dropped for size-infeasibility); the absorbed mass
    // from t2 is split 50/50 between t0 and t1.
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 2 },
      { name: "t2", playerCount: 6 },
    ];
    const weights = { t0: 1, t1: 1, t2: 5 };
    const counts: Record<string, number> = { t0: 0, t1: 0, t2: 0 };
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
        counts[a.treatment.name] += 1;
      }
    }
    const total = counts.t0 + counts.t1 + counts.t2;
    expect(counts.t2).toBe(0);
    expect(total).toBeGreaterThan(0);
    expect(counts.t0 / total).toBeGreaterThan(0.42);
    expect(counts.t0 / total).toBeLessThan(0.58);
  });

  test("greedy-fill failure on the picked treatment re-samples from the rest", () => {
    // Two treatments, weights {t0:9, t1:1}. t0 has a strict role
    // condition that NO player satisfies, so greedy-fill always fails
    // on t0. The dispatcher must mark t0 "tried this round" and pick
    // t1 from the remaining pool — every successful round must end up
    // on t1, even though t0 was picked first 90% of the time.
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
        weights: { t0: 9, t1: 1 },
        eligibility,
        rng: mulberry32(m + 1),
      });
      for (const a of result.assignments) {
        totalAssignments += 1;
        if (a.treatment.name === "t1") t1Count += 1;
      }
    }
    expect(totalAssignments).toBeGreaterThan(0);
    expect(t1Count).toBe(totalAssignments);
  });
});
