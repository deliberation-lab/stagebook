import { describe, it, expect } from "vitest";
import type { Diagnostic } from "stagebook/validate";
import { sortDiagnostics, summarizeDiagnostics } from "./diagnostics";

const at = (
  startLine: number,
  startCol: number,
  severity: Diagnostic["severity"] = "error",
  message = "msg",
): Diagnostic => ({
  message,
  severity,
  range: { startLine, startCol, endLine: startLine, endCol: startCol + 1 },
});

const nowhere = (
  severity: Diagnostic["severity"] = "error",
  message = "msg",
): Diagnostic => ({ message, severity, range: null });

describe("summarizeDiagnostics", () => {
  it("counts errors and warnings", () => {
    const summary = summarizeDiagnostics([
      at(1, 0, "error"),
      at(2, 0, "warning"),
      nowhere("error"),
    ]);
    expect(summary).toEqual({ errors: 2, warnings: 1 });
  });

  it("returns zeroes for an empty list", () => {
    expect(summarizeDiagnostics([])).toEqual({ errors: 0, warnings: 0 });
  });
});

describe("sortDiagnostics", () => {
  it("orders by line then column", () => {
    const sorted = sortDiagnostics([at(5, 2), at(1, 9), at(1, 3), at(5, 1)]);
    expect(sorted.map((d) => [d.range!.startLine, d.range!.startCol])).toEqual([
      [1, 3],
      [1, 9],
      [5, 1],
      [5, 2],
    ]);
  });

  it("places unpositioned diagnostics last", () => {
    const a = nowhere("error", "no range");
    const b = at(3, 0, "error", "has range");
    const sorted = sortDiagnostics([a, b]);
    expect(sorted.map((d) => d.message)).toEqual(["has range", "no range"]);
  });

  it("sorts errors before warnings at the same position", () => {
    const warn = at(2, 4, "warning", "warn");
    const err = at(2, 4, "error", "err");
    const sorted = sortDiagnostics([warn, err]);
    expect(sorted.map((d) => d.message)).toEqual(["err", "warn"]);
  });

  it("sorts errors before warnings among unpositioned diagnostics", () => {
    const warn = nowhere("warning", "warn");
    const err = nowhere("error", "err");
    const sorted = sortDiagnostics([warn, err]);
    expect(sorted.map((d) => d.message)).toEqual(["err", "warn"]);
  });

  it("does not mutate the input array", () => {
    const input = [at(3, 0), at(1, 0)];
    const snapshot = [...input];
    sortDiagnostics(input);
    expect(input).toEqual(snapshot);
  });
});
