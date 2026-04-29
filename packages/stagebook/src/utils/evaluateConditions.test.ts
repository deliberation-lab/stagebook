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

    test("response values matching Object.prototype keys count correctly", () => {
      // Regression: the counts map must not inherit from Object.prototype,
      // or responses like "constructor" produce NaN counts.
      expect(
        evaluateCondition(
          {
            reference: "prompt.q1",
            position: "percentAgreement",
            comparator: "equals",
            value: 100,
          },
          ["constructor", "constructor", "constructor"],
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

  // ----- Positional comparators by name (issue #232) -----
  //
  // `position: shared`, `position: "0"`, `position: "1"` are host-resolver
  // concerns — stagebook itself doesn't know what "shared" or numeric
  // positions mean, it just forwards the position string through to the
  // host's `resolve(reference, position)` callback. These tests pin the
  // forwarding contract (so deliberation-empirica-style hosts can rely on
  // it) and confirm that once values come back, the comparator runs with
  // default `all` semantics — every returned value must satisfy.

  // A position-aware resolver that returns different values for the same
  // reference depending on the position string. Modeled on the kind of
  // resolver a multi-position host would supply.
  const resolveByPosition = (
    table: Record<string, Record<string, unknown[]>>,
  ) => {
    return (reference: string, position?: string) => {
      const key = position ?? "__default";
      return table[reference]?.[key] ?? [];
    };
  };

  test("position: shared — forwards the string and uses the resolved value", () => {
    const resolve = resolveByPosition({
      "prompt.flag": {
        shared: ["yes"],
        "0": ["no"],
        "1": ["maybe"],
      },
    });
    // Resolving with `position: "shared"` returns ["yes"], which equals "yes".
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.flag",
            position: "shared",
            comparator: "equals",
            value: "yes",
          },
        ],
        resolve,
      ),
    ).toBe(true);
  });

  test("position: shared — failure case (shared value doesn't match)", () => {
    const resolve = resolveByPosition({
      "prompt.flag": {
        shared: ["no"],
        "0": ["yes"],
      },
    });
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.flag",
            position: "shared",
            comparator: "equals",
            value: "yes",
          },
        ],
        resolve,
      ),
    ).toBe(false);
  });

  test("position: 0 — resolves to the position-0 player's value", () => {
    const resolve = resolveByPosition({
      "prompt.q": {
        "0": ["red"],
        "1": ["blue"],
      },
    });
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.q",
            position: "0",
            comparator: "equals",
            value: "red",
          },
        ],
        resolve,
      ),
    ).toBe(true);
    // Failure case: position 0's value is "red", not "blue".
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.q",
            position: "0",
            comparator: "equals",
            value: "blue",
          },
        ],
        resolve,
      ),
    ).toBe(false);
  });

  test("position: 1 — resolves to the position-1 player's value", () => {
    const resolve = resolveByPosition({
      "prompt.q": {
        "0": ["red"],
        "1": ["blue"],
      },
    });
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.q",
            position: "1",
            comparator: "equals",
            value: "blue",
          },
        ],
        resolve,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        [
          {
            reference: "prompt.q",
            position: "1",
            comparator: "equals",
            value: "red",
          },
        ],
        resolve,
      ),
    ).toBe(false);
  });

  test("position string is forwarded to resolver verbatim (spy)", () => {
    // Hosts implement `resolve` and can interpret any position string —
    // stagebook's only contract is to pass it through. Verify with a spy.
    const calls: { reference: string; position: string | undefined }[] = [];
    const resolve = (reference: string, position?: string) => {
      calls.push({ reference, position });
      return ["x"];
    };
    evaluateConditions(
      [
        {
          reference: "prompt.q",
          position: "shared",
          comparator: "equals",
          value: "x",
        },
        {
          reference: "prompt.q",
          position: "0",
          comparator: "equals",
          value: "x",
        },
        {
          reference: "prompt.q",
          // position omitted — resolver receives undefined.
          comparator: "equals",
          value: "x",
        },
      ],
      resolve,
    );
    expect(calls).toEqual([
      { reference: "prompt.q", position: "shared" },
      { reference: "prompt.q", position: "0" },
      { reference: "prompt.q", position: undefined },
    ]);
  });
});
