import { describe, test, expect } from "vitest";
import { urnRandomization } from "./urnRandomization.js";
import { makeEligibilityTable } from "./makeEligibilityTable.js";
import { mulberry32 } from "./contract.js";
import type { Treatment } from "./types.js";

function emptyEligibility(playerIds: string[], treatments: Treatment[]) {
  return makeEligibilityTable({ playerIds, treatments, playerData: {} });
}

describe("urnRandomization", () => {
  const TREATMENTS: Treatment[] = [
    { name: "t0", playerCount: 2 },
    { name: "t1", playerCount: 2 },
    { name: "t2", playerCount: 2 },
  ];

  test("rejects counts with extra / missing labels", () => {
    // missing t2
    expect(() =>
      urnRandomization({
        playerIds: ["p0", "p1"],
        treatments: TREATMENTS,
        counts: { t0: 1, t1: 1 },
        eligibility: emptyEligibility(["p0", "p1"], TREATMENTS),
        rng: mulberry32(0),
      }),
    ).toThrow(/labels do not match.*missing.*t2/);
    // extra tX
    expect(() =>
      urnRandomization({
        playerIds: ["p0", "p1"],
        treatments: TREATMENTS,
        counts: { t0: 1, t1: 1, t2: 1, tX: 1 },
        eligibility: emptyEligibility(["p0", "p1"], TREATMENTS),
        rng: mulberry32(0),
      }),
    ).toThrow(/labels do not match.*extra.*tX/);
  });

  test("rejects decrements when a row is missing (strict-literal rule)", () => {
    // No layered-on-identity: if you specify decrements, you specify
    // every row.
    expect(() =>
      urnRandomization({
        playerIds: ["p0", "p1", "p2", "p3"],
        treatments: TREATMENTS,
        counts: { t0: 2, t1: 2, t2: 2 },
        decrements: {
          t0: { t0: 1, t1: 1 },
          // t1 and t2 rows missing
        },
        eligibility: emptyEligibility(["p0", "p1", "p2", "p3"], TREATMENTS),
        rng: mulberry32(0),
      }),
    ).toThrow(/labels do not match/);
  });

  test("rejects decrements with unknown column labels", () => {
    expect(() =>
      urnRandomization({
        playerIds: ["p0", "p1"],
        treatments: TREATMENTS,
        counts: { t0: 1, t1: 1, t2: 1 },
        decrements: {
          t0: { t0: 1, tX: 1 }, // unknown column
          t1: { t1: 1 },
          t2: { t2: 1 },
        },
        eligibility: emptyEligibility(["p0", "p1"], TREATMENTS),
        rng: mulberry32(0),
      }),
    ).toThrow(/column label.*tX/);
  });

  test("omitted decrements equals fully-written identity (behavioral parity)", () => {
    // Pins the "matrix off = identity" default path. If the default
    // ever drifts away from identity, this catches it.
    //
    // Sweep multiple seeds so a parity break that only surfaces for
    // specific RNG sequences doesn't slip through.
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
    const playerIds = players.map((p) => p.id);
    const eligibility = emptyEligibility(playerIds, TREATMENTS);
    const counts = { t0: 1, t1: 1, t2: 1 };
    const identity = {
      t0: { t0: 1 },
      t1: { t1: 1 },
      t2: { t2: 1 },
    };

    for (const seed of [42, 100, 7, 0xdeadbeef, 1234567]) {
      const omitted = urnRandomization({
        playerIds,
        treatments: TREATMENTS,
        counts,
        eligibility,
        rng: mulberry32(seed),
      });
      const explicit = urnRandomization({
        playerIds,
        treatments: TREATMENTS,
        counts,
        decrements: identity,
        eligibility,
        rng: mulberry32(seed),
      });
      expect(omitted.assignments, `seed ${seed}`).toEqual(explicit.assignments);
      expect(omitted.remainingCounts, `seed ${seed}`).toEqual(
        explicit.remainingCounts,
      );
    }
  });

  test("missing column within a present row defaults to 0 (behavioral parity)", () => {
    // The two forms should produce identical output: a sparse row is
    // identical to a dense row with explicit zeros. Swept across seeds
    // to catch parity breaks visible only on specific RNG sequences.
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
    const playerIds = players.map((p) => p.id);
    const eligibility = emptyEligibility(playerIds, TREATMENTS);
    const counts = { t0: 1, t1: 1, t2: 1 };
    const sparseDecrements = {
      t0: { t0: 1 }, // t1 and t2 columns omitted → default to 0
      t1: { t1: 1 },
      t2: { t2: 1 },
    };
    const denseDecrements = {
      t0: { t0: 1, t1: 0, t2: 0 },
      t1: { t0: 0, t1: 1, t2: 0 },
      t2: { t0: 0, t1: 0, t2: 1 },
    };

    for (const seed of [42, 100, 7, 0xdeadbeef, 1234567]) {
      const sparse = urnRandomization({
        playerIds,
        treatments: TREATMENTS,
        counts,
        decrements: sparseDecrements,
        eligibility,
        rng: mulberry32(seed),
      });
      const dense = urnRandomization({
        playerIds,
        treatments: TREATMENTS,
        counts,
        decrements: denseDecrements,
        eligibility,
        rng: mulberry32(seed),
      });
      expect(sparse.assignments, `seed ${seed}`).toEqual(dense.assignments);
      expect(sparse.remainingCounts, `seed ${seed}`).toEqual(
        dense.remainingCounts,
      );
    }
  });

  test("key order in counts is not significant (semantics are by-label)", () => {
    // counts {t1: 2, t0: 1, t2: 1} should produce identical output to
    // counts {t0: 1, t1: 2, t2: 1} given the same treatments + seed.
    // The dispatcher must read counts by label, not by Object.keys()
    // iteration order.
    const players = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}` }));
    const playerIds = players.map((p) => p.id);
    const eligibility = emptyEligibility(playerIds, TREATMENTS);

    const inOrder = urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts: { t0: 1, t1: 2, t2: 1 },
      eligibility,
      rng: mulberry32(42),
    });

    const reordered = urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts: { t1: 2, t0: 1, t2: 1 },
      eligibility,
      rng: mulberry32(42),
    });

    expect(inOrder.assignments).toEqual(reordered.assignments);
    expect(inOrder.remainingCounts).toEqual(reordered.remainingCounts);
  });

  test("remainingCounts round-trips into a follow-up call", () => {
    // The host pattern is to persist remainingCounts across ticks and
    // feed it back into the next call as `counts`. Pin that the label
    // set survives the round-trip exactly — no string-key drift.
    const players1 = Array.from({ length: 4 }, (_, i) => ({ id: `p1_${i}` }));
    const players2 = Array.from({ length: 4 }, (_, i) => ({ id: `p2_${i}` }));
    const eligibility1 = emptyEligibility(
      players1.map((p) => p.id),
      TREATMENTS,
    );
    const eligibility2 = emptyEligibility(
      players2.map((p) => p.id),
      TREATMENTS,
    );

    const first = urnRandomization({
      playerIds: players1.map((p) => p.id),
      treatments: TREATMENTS,
      counts: { t0: 3, t1: 3, t2: 3 },
      eligibility: eligibility1,
      rng: mulberry32(42),
    });

    // The label set survives exactly.
    expect(Object.keys(first.remainingCounts).sort()).toEqual([
      "t0",
      "t1",
      "t2",
    ]);

    // And feeding it straight back into a subsequent call works (i.e.,
    // doesn't trip the validateLabelSet defense in depth).
    expect(() =>
      urnRandomization({
        playerIds: players2.map((p) => p.id),
        treatments: TREATMENTS,
        counts: first.remainingCounts,
        eligibility: eligibility2,
        rng: mulberry32(43),
      }),
    ).not.toThrow();
  });

  test("empty players → empty assignments, counts pass through unchanged", () => {
    const result = urnRandomization({
      playerIds: [],
      treatments: TREATMENTS,
      counts: { t0: 5, t1: 5, t2: 5 },
      eligibility: emptyEligibility([], TREATMENTS),
      rng: mulberry32(0),
    });
    expect(result.assignments).toEqual([]);
    expect(result.remainingCounts).toEqual({ t0: 5, t1: 5, t2: 5 });
  });

  test("seeded determinism: same seed + inputs → identical output", () => {
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
    const playerIds = players.map((p) => p.id);
    const eligibility = emptyEligibility(playerIds, TREATMENTS);
    const counts = { t0: 2, t1: 2, t2: 2 };

    const a = urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts,
      eligibility,
      rng: mulberry32(42),
    });
    const b = urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts,
      eligibility,
      rng: mulberry32(42),
    });
    const c = urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts,
      eligibility,
      rng: mulberry32(43),
    });

    expect(a.assignments).toEqual(b.assignments);
    expect(a.remainingCounts).toEqual(b.remainingCounts);
    expect(a.assignments).not.toEqual(c.assignments);
  });

  test("input `counts` is not mutated", () => {
    const counts = { t0: 3, t1: 3, t2: 3 };
    const snapshot = { ...counts };
    const players = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}` }));
    const playerIds = players.map((p) => p.id);
    urnRandomization({
      playerIds,
      treatments: TREATMENTS,
      counts,
      eligibility: emptyEligibility(playerIds, TREATMENTS),
      rng: mulberry32(42),
    });
    expect(counts).toEqual(snapshot);
  });
});
