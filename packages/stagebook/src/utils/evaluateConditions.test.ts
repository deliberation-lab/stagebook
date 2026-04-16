import { describe, test, expect } from "vitest";
import { evaluateCondition, evaluateConditions } from "./evaluateConditions.js";

// --------------- evaluateCondition ---------------

describe("evaluateCondition", () => {
  describe("default position (all)", () => {
    test("all values satisfy equals", () => {
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          ["yes", "yes", "yes"],
        ),
      ).toBe(true);
    });

    test("fails if any value doesn't satisfy", () => {
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          ["yes", "no", "yes"],
        ),
      ).toBe(false);
    });

    test("single value satisfies", () => {
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "isAbove", value: 5 },
          [10],
        ),
      ).toBe(true);
    });

    test("empty values array fails for value comparators", () => {
      // Empty array means no data to compare against — the condition
      // cannot be satisfied. (Previously returned true via vacuous truth
      // of [].every(), which caused conditional submit buttons gated on
      // "exists" to appear before any prompt was answered.)
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          [],
        ),
      ).toBe(false);
    });

    test("exists comparator", () => {
      expect(
        evaluateCondition({ reference: "prompt.q1", comparator: "exists" }, [
          "some value",
        ]),
      ).toBe(true);
    });

    test("exists fails for undefined", () => {
      expect(
        evaluateCondition({ reference: "prompt.q1", comparator: "exists" }, [
          undefined,
        ]),
      ).toBe(false);
    });

    test("exists fails for empty array (nothing exists)", () => {
      expect(
        evaluateCondition({ reference: "prompt.q1", comparator: "exists" }, []),
      ).toBe(false);
    });

    test("doesNotExist passes for empty array", () => {
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "doesNotExist" },
          [],
        ),
      ).toBe(true);
    });
  });

  describe("position: any", () => {
    test("passes if at least one value satisfies", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "any",
            comparator: "equals",
            value: "yes",
          },
          ["no", "no", "yes"],
        ),
      ).toBe(true);
    });

    test("fails if no values satisfy", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "any",
            comparator: "equals",
            value: "yes",
          },
          ["no", "no", "no"],
        ),
      ).toBe(false);
    });

    test("passes with single satisfying value", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "any",
            comparator: "isAbove",
            value: 50,
          },
          [10, 20, 75],
        ),
      ).toBe(true);
    });

    test("fails on empty array (no value to satisfy)", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "any",
            comparator: "equals",
            value: "yes",
          },
          [],
        ),
      ).toBe(false);
    });
  });

  describe("position: percentAgreement", () => {
    test("80% agreement meets isAtLeast 80", () => {
      // 4 out of 5 agree → 80%
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "isAtLeast",
            value: 80,
          },
          ["yes", "yes", "yes", "yes", "no"],
        ),
      ).toBe(true);
    });

    test("60% agreement fails isAtLeast 80", () => {
      // 3 out of 5 agree → 60%
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "isAtLeast",
            value: 80,
          },
          ["yes", "yes", "yes", "no", "no"],
        ),
      ).toBe(false);
    });

    test("100% agreement", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "equals",
            value: 100,
          },
          ["yes", "yes", "yes"],
        ),
      ).toBe(true);
    });

    test("undefined values count toward total but not toward agreement", () => {
      // 2 defined "yes" out of 4 total (2 undefined) → 50%
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "isAtLeast",
            value: 50,
          },
          ["yes", "yes", undefined, undefined],
        ),
      ).toBe(true);
    });

    test("all undefined returns false", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "isAtLeast",
            value: 50,
          },
          [undefined, undefined],
        ),
      ).toBe(false);
    });

    test("case insensitive agreement", () => {
      // "Yes" and "yes" should count as the same response
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "equals",
            value: 100,
          },
          ["Yes", "yes", "YES"],
        ),
      ).toBe(true);
    });
  });

  describe("comparator edge cases", () => {
    test("doesNotEqual with undefined lhs returns true", () => {
      expect(
        evaluateCondition(
          { reference: "prompt.q1", comparator: "doesNotEqual", value: "x" },
          [undefined],
        ),
      ).toBe(true);
    });

    test("string includes", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            comparator: "includes",
            value: "world",
          },
          ["hello world"],
        ),
      ).toBe(true);
    });

    test("isOneOf with array value", () => {
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            comparator: "isOneOf",
            value: ["a", "b", "c"],
          },
          ["b"],
        ),
      ).toBe(true);
    });
  });
});

// --------------- evaluateConditions ---------------

describe("evaluateConditions", () => {
  const mockResolve = (values: Record<string, unknown[]>) => {
    return (reference: string) => values[reference] ?? [];
  };

  test("empty conditions returns true", () => {
    expect(evaluateConditions([], mockResolve({}))).toBe(true);
  });

  test("single condition met", () => {
    expect(
      evaluateConditions(
        [{ reference: "prompt.q1", comparator: "equals", value: "yes" }],
        mockResolve({ "prompt.q1": ["yes"] }),
      ),
    ).toBe(true);
  });

  test("single condition not met", () => {
    expect(
      evaluateConditions(
        [{ reference: "prompt.q1", comparator: "equals", value: "yes" }],
        mockResolve({ "prompt.q1": ["no"] }),
      ),
    ).toBe(false);
  });

  test("multiple conditions: all must be true (AND logic)", () => {
    expect(
      evaluateConditions(
        [
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          { reference: "prompt.q2", comparator: "isAbove", value: 5 },
        ],
        mockResolve({ "prompt.q1": ["yes"], "prompt.q2": [10] }),
      ),
    ).toBe(true);
  });

  test("multiple conditions: fails if any is false", () => {
    expect(
      evaluateConditions(
        [
          { reference: "prompt.q1", comparator: "equals", value: "yes" },
          { reference: "prompt.q2", comparator: "isAbove", value: 5 },
        ],
        mockResolve({ "prompt.q1": ["yes"], "prompt.q2": [3] }),
      ),
    ).toBe(false);
  });

  test("condition with missing reference (empty array) fails", () => {
    // Missing references resolve to [] — the condition cannot be satisfied
    // without data. (Regression test: previously returned true via the
    // vacuous truth of [].every(), which caused conditional submit buttons
    // gated on "exists" to appear before any prompt was answered.)
    expect(
      evaluateConditions(
        [{ reference: "prompt.missing", comparator: "equals", value: "yes" }],
        mockResolve({}),
      ),
    ).toBe(false);
  });

  test("exists on missing reference fails", () => {
    expect(
      evaluateConditions(
        [{ reference: "prompt.missing", comparator: "exists" }],
        mockResolve({}),
      ),
    ).toBe(false);
  });

  test("doesNotExist on missing reference passes", () => {
    expect(
      evaluateConditions(
        [{ reference: "prompt.missing", comparator: "doesNotExist" }],
        mockResolve({}),
      ),
    ).toBe(true);
  });
});
