import { describe, test, expect } from "vitest";
import { validateDispatcherConfig } from "./validateDispatcherConfig.js";

describe("validateDispatcherConfig", () => {
  test("rejects non-object configs", () => {
    expect(validateDispatcherConfig(null, 2).ok).toBe(false);
    expect(validateDispatcherConfig("urn", 2).ok).toBe(false);
    expect(validateDispatcherConfig(42, 2).ok).toBe(false);
  });

  test("rejects missing or non-string `type`", () => {
    expect(validateDispatcherConfig({}, 2).ok).toBe(false);
    expect(validateDispatcherConfig({ type: "" }, 2).ok).toBe(false);
  });

  test("rejects unknown `type`", () => {
    const r = validateDispatcherConfig({ type: "nope" }, 2);
    expect(r.ok).toBe(false);
    expect(r.diagnostics[0].path).toBe("type");
  });

  describe("uniform-random", () => {
    test("accepts the bare `type` form", () => {
      const r = validateDispatcherConfig({ type: "uniform-random" }, 3);
      expect(r.ok).toBe(true);
      expect(r.diagnostics).toEqual([]);
    });

    test("rejects stray fields (would mislead the author)", () => {
      const r = validateDispatcherConfig(
        { type: "uniform-random", counts: [1, 2, 3] },
        3,
      );
      expect(r.ok).toBe(false);
      expect(r.diagnostics[0].path).toBe("counts");
    });
  });

  describe("weighted-random", () => {
    test("accepts a well-formed weights array", () => {
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: [4, 1, 1] },
        3,
      );
      expect(r.ok).toBe(true);
    });

    test("accepts float weights", () => {
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: [0.8, 0.1, 0.1] },
        3,
      );
      expect(r.ok).toBe(true);
    });

    test("rejects unresolved file references on `weights`", () => {
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: { from: "./weights.json" } },
        3,
      );
      expect(r.ok).toBe(false);
      expect(r.diagnostics[0].path).toBe("weights");
    });

    test("rejects mismatched weights.length vs treatments", () => {
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: [1, 2, 3] },
        2,
      );
      expect(r.ok).toBe(false);
      const messages = r.diagnostics.map((d) => d.message);
      expect(messages.some((m) => m.includes("weights.length"))).toBe(true);
    });

    test("rejects negative / NaN / non-finite entries", () => {
      const r = validateDispatcherConfig(
        {
          type: "weighted-random",
          weights: [1, -1, Number.NaN, Infinity],
        },
        4,
      );
      expect(r.ok).toBe(false);
      const paths = r.diagnostics.map((d) => d.path).sort();
      expect(paths).toContain("weights.1");
      expect(paths).toContain("weights.2");
      expect(paths).toContain("weights.3");
    });

    test("zero entries are allowed (deactivate a treatment)", () => {
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: [4, 0, 1] },
        3,
      );
      expect(r.ok).toBe(true);
    });

    test("all-zero weights warn but don't fail validation (gated-off batch)", () => {
      // Per #451, a researcher may legitimately gate a batch off
      // temporarily by zeroing every weight. We surface a warning so
      // the empty-batch isn't surprising, but `ok` stays true so the
      // batch can still be deployed.
      const r = validateDispatcherConfig(
        { type: "weighted-random", weights: [0, 0, 0] },
        3,
      );
      expect(r.ok).toBe(true);
      const warnings = r.diagnostics.filter((d) => d.severity === "warning");
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toMatch(/all zero|no assignments/i);
    });
  });

  describe("urn", () => {
    test("accepts a well-formed counts array", () => {
      const r = validateDispatcherConfig({ type: "urn", counts: [2, 2, 2] }, 3);
      expect(r.ok).toBe(true);
    });

    test("rejects unresolved file references on `counts`", () => {
      const r = validateDispatcherConfig(
        { type: "urn", counts: { from: "./counts.json" } },
        3,
      );
      expect(r.ok).toBe(false);
      expect(r.diagnostics[0].path).toBe("counts");
    });

    test("rejects mismatched counts.length vs treatments", () => {
      const r = validateDispatcherConfig({ type: "urn", counts: [1, 2, 3] }, 2);
      expect(r.ok).toBe(false);
      const messages = r.diagnostics.map((d) => d.message);
      expect(messages.some((m) => m.includes("counts.length"))).toBe(true);
    });

    test("rejects non-integer / negative count entries", () => {
      const r = validateDispatcherConfig(
        { type: "urn", counts: [2, -1, 1.5] },
        3,
      );
      expect(r.ok).toBe(false);
      const paths = r.diagnostics.map((d) => d.path).sort();
      expect(paths).toContain("counts.1");
      expect(paths).toContain("counts.2");
    });

    test("accepts a well-formed identity-decrement matrix", () => {
      const r = validateDispatcherConfig(
        {
          type: "urn",
          counts: [4, 4, 4],
          decrements: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
        3,
      );
      expect(r.ok).toBe(true);
    });

    test("rejects non-square decrement matrix", () => {
      const r = validateDispatcherConfig(
        {
          type: "urn",
          counts: [2, 2, 2],
          decrements: [
            [1, 0],
            [0, 1],
          ],
        },
        3,
      );
      expect(r.ok).toBe(false);
    });

    test("rejects decrement[i][j] > counts[j] (would underflow on first use)", () => {
      const r = validateDispatcherConfig(
        {
          type: "urn",
          counts: [1, 1],
          decrements: [
            [1, 2],
            [0, 1],
          ],
        },
        2,
      );
      expect(r.ok).toBe(false);
      const messages = r.diagnostics.map((d) => d.message).join("\n");
      expect(messages).toMatch(/underflow|exceeds counts/);
    });
  });

  describe("local-penalization", () => {
    test("is recognized but not deeply validated by stagebook", () => {
      // Stagebook just confirms the discriminator; deliberation-lab
      // owns the payoffs/knockdowns shape check.
      const r = validateDispatcherConfig(
        { type: "local-penalization", payoffs: "equal", knockdowns: "none" },
        2,
      );
      expect(r.ok).toBe(true);
    });
  });
});
