import { describe, test, expect } from "vitest";
import { makeEligibilityTable } from "./makeEligibilityTable.js";
import type { Treatment } from "./types.js";

describe("makeEligibilityTable", () => {
  test("treatments without groupComposition: every player eligible for every slot", () => {
    const treatments: Treatment[] = [
      { name: "t0", playerCount: 2 },
      { name: "t1", playerCount: 3 },
    ];
    const table = makeEligibilityTable({
      playerIds: ["p0", "p1"],
      treatments,
      playerData: {},
    });
    expect(table.isEligible("p0", 0, 0)).toBe(true);
    expect(table.isEligible("p0", 0, 1)).toBe(true);
    expect(table.isEligible("p1", 1, 2)).toBe(true);
  });

  test("slot without conditions: unconstrained", () => {
    const treatments: Treatment[] = [
      {
        name: "t0",
        playerCount: 2,
        groupComposition: [{ position: 0 }, { position: 1 }],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["p0"],
      treatments,
      playerData: {},
    });
    expect(table.isEligible("p0", 0, 0)).toBe(true);
    expect(table.isEligible("p0", 0, 1)).toBe(true);
  });

  test("evaluates `self.prompt.X` equality conditions per candidate", () => {
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
                value: "moderator",
              },
            ],
          },
          {
            position: 1,
            conditions: [
              {
                reference: "self.prompt.role",
                comparator: "equals",
                value: "participant",
              },
            ],
          },
        ],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["mod", "part"],
      treatments,
      playerData: {
        mod: { prompt_role: { value: "moderator" } },
        part: { prompt_role: { value: "participant" } },
      },
    });
    expect(table.isEligible("mod", 0, 0)).toBe(true);
    expect(table.isEligible("mod", 0, 1)).toBe(false);
    expect(table.isEligible("part", 0, 0)).toBe(false);
    expect(table.isEligible("part", 0, 1)).toBe(true);
  });

  test("unknown player returns false (defensive lookup)", () => {
    const treatments: Treatment[] = [{ name: "t0", playerCount: 1 }];
    const table = makeEligibilityTable({
      playerIds: ["p0"],
      treatments,
      playerData: {},
    });
    expect(table.isEligible("never-seen", 0, 0)).toBe(false);
  });

  test("missing storage-key data → positive comparator fails, negative passes", () => {
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
                value: "x",
              },
            ],
          },
          {
            position: 1,
            conditions: [
              {
                reference: "self.prompt.role",
                comparator: "doesNotEqual",
                value: "x",
              },
            ],
          },
        ],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["p0"],
      treatments,
      playerData: { p0: {} },
    });
    // No data → `equals` collapses to false at the boundary.
    expect(table.isEligible("p0", 0, 0)).toBe(false);
    // No data → `doesNotEqual` is satisfied by absence (#348).
    expect(table.isEligible("p0", 0, 1)).toBe(true);
  });

  test("non-self references resolve to empty (no group composition yet)", () => {
    const treatments: Treatment[] = [
      {
        name: "t0",
        playerCount: 1,
        groupComposition: [
          {
            position: 0,
            conditions: [
              {
                // Numeric / shared / all selectors can't resolve from the
                // candidate alone — they'd need the eventual group.
                reference: "0.prompt.role",
                comparator: "equals",
                value: "anything",
              },
            ],
          },
        ],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["p0"],
      treatments,
      playerData: { p0: { prompt_role: { value: "anything" } } },
    });
    expect(table.isEligible("p0", 0, 0)).toBe(false);
  });

  test("operator-tree conditions (any/none) evaluate correctly", () => {
    const treatments: Treatment[] = [
      {
        name: "t0",
        playerCount: 1,
        groupComposition: [
          {
            position: 0,
            conditions: {
              any: [
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "a",
                },
                {
                  reference: "self.prompt.role",
                  comparator: "equals",
                  value: "b",
                },
              ],
            },
          },
        ],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["pa", "pb", "pc"],
      treatments,
      playerData: {
        pa: { prompt_role: { value: "a" } },
        pb: { prompt_role: { value: "b" } },
        pc: { prompt_role: { value: "c" } },
      },
    });
    expect(table.isEligible("pa", 0, 0)).toBe(true);
    expect(table.isEligible("pb", 0, 0)).toBe(true);
    expect(table.isEligible("pc", 0, 0)).toBe(false);
  });

  test("external-source reference (`self.entryUrl.params.X`)", () => {
    const treatments: Treatment[] = [
      {
        name: "t0",
        playerCount: 1,
        groupComposition: [
          {
            position: 0,
            conditions: [
              {
                reference: "self.entryUrl.params.condition",
                comparator: "equals",
                value: "treatment",
              },
            ],
          },
        ],
      },
    ];
    const table = makeEligibilityTable({
      playerIds: ["p0", "p1"],
      treatments,
      playerData: {
        p0: { entryUrl: { params: { condition: "treatment" } } },
        p1: { entryUrl: { params: { condition: "control" } } },
      },
    });
    expect(table.isEligible("p0", 0, 0)).toBe(true);
    expect(table.isEligible("p1", 0, 0)).toBe(false);
  });
});
